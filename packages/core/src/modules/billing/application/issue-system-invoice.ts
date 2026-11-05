import { isValidRfc, isValidZip } from '../../customers/domain/customer';
import type { Authorization } from '../../identity/application/authorize-with-admin-pin';
import type { PermissionPolicy } from '../../identity/domain/permissions';
import type { BillingErrorCode, CfdiRecipient, PaymentForm } from '../domain/invoice';
import { supportsDepositTreatment, type DepositTreatment } from '../domain/deposit-treatment';
import { paymentFormFor } from '../domain/payment-form';
import { isCfdiUse, isFiscalRegime } from '../domain/sat-catalogs';
import { evaluateSelfInvoicing, type SelfInvoicingBlock } from '../domain/self-invoicing';
import { authorizeInvoiceIssue, type InvoiceActor, type InvoiceIssueError } from './invoice-issue';
import { issueInvoice, type IssueInvoiceDeps, type InvoiceSourceType } from './issue-invoice';
import type { PortalDocumentRecord } from './portal-lookup';
import { normalizeRecipient, type PortalRecipientInput } from './request-portal-invoice';

/** Puerto: la venta u orden que se quiere facturar, por su identificador y no por su código del QR. Solo lo
 *  usan funciones del servidor, después de comprobar quién llama. */
export interface InvoiceSourceStore {
  find(source: {
    readonly type: InvoiceSourceType;
    readonly id: string;
  }): Promise<PortalDocumentRecord | null>;
}

export interface IssueSystemInvoiceDeps {
  readonly sources: InvoiceSourceStore;
  readonly issue: IssueInvoiceDeps;
  readonly policy?: PermissionPolicy;
  /** Ajuste de anticipos [RN-27]; sin él se usa la opción (a). */
  readonly depositTreatment?: DepositTreatment;
}

export interface IssueSystemInvoiceInput {
  /** Quién factura: un administrador, o un cajero con la autorización de un administrador [RF-M10-08]. */
  readonly actor: InvoiceActor;
  readonly authorization?: Authorization;
  readonly source: { readonly type: InvoiceSourceType; readonly id: string };
  /** Identificador de esta solicitud: reintentar con el mismo nunca duplica el timbre [RN-24]. */
  readonly requestId: string;
  readonly recipient: PortalRecipientInput;
  /** Forma de pago elegida por quien factura. Solo cuenta cuando el pago fue mixto o no se puede deducir:
   *  la regla la define el contador (PD-28) y por eso no se supone una. */
  readonly paymentForm?: PaymentForm | null;
}

export type IssueSystemInvoiceOutcome =
  | { readonly kind: 'STAMPED'; readonly uuid: string; readonly folio: string }
  | { readonly kind: 'IN_PROCESS' }
  | { readonly kind: InvoiceIssueError['code'] }
  | { readonly kind: 'NOT_FOUND' }
  /** El ajuste de anticipos está en la opción (b), que no se construyó [RN-27]. */
  | { readonly kind: 'DEPOSIT_TREATMENT_UNSUPPORTED' }
  /** Cancelada, ya facturada o con saldo: no se factura [RN-24, RN-25]. El plazo del portal no aplica. */
  | { readonly kind: 'INELIGIBLE'; readonly reason: Exclude<SelfInvoicingBlock, 'EXPIRED'> }
  /** Pago mixto: quien factura debe elegir la forma de pago `01` o `03` (PD-28). */
  | { readonly kind: 'PAYMENT_FORM_REQUIRED' }
  | { readonly kind: 'INVALID'; readonly fields: readonly string[] }
  | {
      readonly kind: 'NOT_BILLABLE';
      readonly reason: 'NO_LINES' | 'FISCAL_DATA_MISSING' | 'LINE_TOTAL_MISMATCH';
    }
  | { readonly kind: 'REJECTED'; readonly code: BillingErrorCode }
  | { readonly kind: 'UNAVAILABLE' };

/** Qué campos del receptor no valen: formato del RFC (12 o 13) y del código postal (5 dígitos), nombre
 *  capturado, y régimen fiscal y uso de CFDI del catálogo del SAT [RF-M10-05]. */
export function validateSystemRecipient(receptor: CfdiRecipient): readonly string[] {
  const campos: string[] = [];
  if (!isValidRfc(receptor.rfc)) {
    campos.push('recipient.rfc');
  }
  if (receptor.name === '') {
    campos.push('recipient.name');
  }
  if (!isValidZip(receptor.fiscalZip)) {
    campos.push('recipient.fiscalZip');
  }
  if (!isFiscalRegime(receptor.regime)) {
    campos.push('recipient.regime');
  }
  if (!isCfdiUse(receptor.cfdiUse)) {
    campos.push('recipient.cfdiUse');
  }
  return campos;
}

/** Factura desde el sistema una venta de mostrador o una orden liquidada [RF-M10-04 a RF-M10-08, RN-24, RN-25].
 *  Un administrador factura; un cajero solo con la autorización de otro [S4-17]. A diferencia del portal, no hay
 *  plazo de fin de mes: un administrador sí puede facturar fuera de él [RN-26]. */
export async function issueSystemInvoice(
  deps: IssueSystemInvoiceDeps,
  entrada: IssueSystemInvoiceInput,
): Promise<IssueSystemInvoiceOutcome> {
  const permiso = authorizeInvoiceIssue(entrada.actor, entrada.authorization, deps.policy);
  if (!permiso.ok) {
    return { kind: permiso.error.code };
  }

  let documento: PortalDocumentRecord | null;
  try {
    documento = await deps.sources.find(entrada.source);
  } catch {
    return { kind: 'UNAVAILABLE' };
  }
  if (documento === null) {
    return { kind: 'NOT_FOUND' };
  }

  if (!supportsDepositTreatment(deps.depositTreatment, documento.type)) {
    return { kind: 'DEPOSIT_TREATMENT_UNSUPPORTED' };
  }

  // Se sigue aunque ya tenga factura: reenviar la misma solicitud devuelve su factura en vez de un error [RN-24].
  const elegibilidad = evaluateSelfInvoicing({ source: documento, now: deps.issue.clock.now() });
  if (
    !elegibilidad.ok &&
    elegibilidad.error !== 'EXPIRED' &&
    elegibilidad.error !== 'ALREADY_INVOICED'
  ) {
    return { kind: 'INELIGIBLE', reason: elegibilidad.error };
  }
  const yaFacturada = !elegibilidad.ok && elegibilidad.error === 'ALREADY_INVOICED';

  const receptor = normalizeRecipient(entrada.recipient);
  const invalidos = validateSystemRecipient(receptor);
  if (invalidos.length > 0) {
    return yaFacturada
      ? { kind: 'INELIGIBLE', reason: 'ALREADY_INVOICED' }
      : { kind: 'INVALID', fields: invalidos };
  }
  const formaDePago = paymentFormFor(documento.paymentMethods) ?? entrada.paymentForm ?? null;
  if (formaDePago === null) {
    return yaFacturada
      ? { kind: 'INELIGIBLE', reason: 'ALREADY_INVOICED' }
      : { kind: 'PAYMENT_FORM_REQUIRED' };
  }

  const r = await issueInvoice(deps.issue, {
    requestId: entrada.requestId,
    source: entrada.source,
    channel: 'SYSTEM',
    recipient: receptor,
    lines: documento.lines,
    paymentForm: formaDePago,
  });
  if (r.kind === 'ALREADY_INVOICED') {
    return { kind: 'INELIGIBLE', reason: 'ALREADY_INVOICED' };
  }
  return r;
}
