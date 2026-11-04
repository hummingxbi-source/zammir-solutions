import { isValidRfc, isValidZip } from '../../customers/domain/customer';
import type { BillingErrorCode, CfdiRecipient } from '../domain/invoice';
import { paymentFormFor } from '../domain/payment-form';
import { isFiscalRegime, isPortalCfdiUse } from '../domain/sat-catalogs';
import type { SelfInvoicingBlock } from '../domain/self-invoicing';
import { issueInvoice, type IssueInvoiceDeps } from './issue-invoice';
import {
  accessPortalDocument,
  type PortalLookupDeps,
  type PortalLookupInput,
} from './portal-lookup';

export interface RequestPortalInvoiceDeps extends PortalLookupDeps {
  readonly issue: IssueInvoiceDeps;
}

/** Los datos fiscales que el cliente captura en el portal [RF-M10-13]. */
export interface PortalRecipientInput {
  readonly rfc: string;
  readonly name: string;
  readonly fiscalZip: string;
  readonly regime: string;
  readonly cfdiUse: string;
}

export interface RequestPortalInvoiceInput extends PortalLookupInput {
  /** Identificador de esta solicitud, generado al abrir el formulario: reenviar no duplica el timbre [RN-24]. */
  readonly requestId: string;
  readonly recipient: PortalRecipientInput;
  /** La casilla del aviso de privacidad, que menciona la transferencia de los datos al PAC [RF-M9-05]. */
  readonly acceptedPrivacy: boolean;
}

export type RequestPortalInvoiceOutcome =
  | { readonly kind: 'STAMPED'; readonly uuid: string; readonly folio: string }
  /** El PAC no respondió: se reintenta solo con el mismo identificador. */
  | { readonly kind: 'IN_PROCESS' }
  | { readonly kind: 'PRIVACY_NOT_ACCEPTED' }
  | { readonly kind: 'INVALID'; readonly fields: readonly string[] }
  /** Pago mixto o sin pagos: la forma de pago la define el contador (PD-28); se pide en el negocio. */
  | { readonly kind: 'PAYMENT_FORM_UNDEFINED' }
  | {
      readonly kind: 'NOT_BILLABLE';
      readonly reason: 'NO_LINES' | 'FISCAL_DATA_MISSING' | 'LINE_TOTAL_MISMATCH';
    }
  | { readonly kind: 'INELIGIBLE'; readonly reason: SelfInvoicingBlock }
  | { readonly kind: 'ALREADY_INVOICED' }
  | { readonly kind: 'REJECTED'; readonly code: BillingErrorCode }
  | { readonly kind: 'NOT_AVAILABLE' }
  | { readonly kind: 'BLOCKED'; readonly retryAfterSeconds: number }
  | { readonly kind: 'UNAVAILABLE' };

/** Deja los datos del receptor como los pide el SAT: RFC en mayúsculas y sin espacios, y el resto sin espacios
 *  de más. El nombre se respeta tal como lo escribió la persona: debe ser el de su constancia. */
export function normalizeRecipient(entrada: PortalRecipientInput): CfdiRecipient {
  return {
    rfc: entrada.rfc.replace(/\s/g, '').toUpperCase(),
    name: entrada.name.trim().replace(/\s+/g, ' '),
    fiscalZip: entrada.fiscalZip.trim(),
    regime: entrada.regime.trim(),
    cfdiUse: entrada.cfdiUse.trim().toUpperCase(),
  };
}

/** Qué campos del receptor no valen, antes de gastar un timbre: formato del RFC (12 o 13) y del código postal
 *  (5 dígitos), nombre capturado, y régimen fiscal y uso de CFDI de los catálogos del SAT que el portal ofrece
 *  [RF-M10-13]. La compatibilidad entre el régimen y el uso la revisa el PAC al timbrar. */
export function validatePortalRecipient(receptor: CfdiRecipient): readonly string[] {
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
  if (!isPortalCfdiUse(receptor.cfdiUse)) {
    campos.push('recipient.cfdiUse');
  }
  return campos;
}

/** Atiende la solicitud de factura del portal: la persona acepta el aviso de privacidad, el servidor comprueba
 *  que el folio y el código cuadran y que se puede facturar, valida los datos fiscales y emite la factura
 *  [RF-M10-10, RF-M10-13, RF-M10-14, RN-24]. Todo se decide en el servidor, aunque la pantalla ya haya validado. */
export async function requestPortalInvoice(
  deps: RequestPortalInvoiceDeps,
  entrada: RequestPortalInvoiceInput,
): Promise<RequestPortalInvoiceOutcome> {
  if (!entrada.acceptedPrivacy) {
    return { kind: 'PRIVACY_NOT_ACCEPTED' };
  }
  const acceso = await accessPortalDocument(deps, entrada);
  if (acceso.kind !== 'MATCHED') {
    return acceso;
  }
  const { eligibility } = acceso;
  if (!eligibility.ok && eligibility.reason !== 'ALREADY_INVOICED') {
    return { kind: 'INELIGIBLE', reason: eligibility.reason };
  }
  // Si ya tiene factura, se sigue: reenviar el mismo formulario (un doble toque, una red que se cayó al
  // responder) devuelve la factura de esa misma solicitud en vez de un error [RN-24].
  const yaFacturada = !eligibility.ok;
  const yaFacturadaPorOtra: RequestPortalInvoiceOutcome = {
    kind: 'INELIGIBLE',
    reason: 'ALREADY_INVOICED',
  };

  const receptor = normalizeRecipient(entrada.recipient);
  const invalidos = validatePortalRecipient(receptor);
  if (invalidos.length > 0) {
    return yaFacturada ? yaFacturadaPorOtra : { kind: 'INVALID', fields: invalidos };
  }
  const formaDePago = paymentFormFor(acceso.record.paymentMethods);
  if (formaDePago === null) {
    return yaFacturada ? yaFacturadaPorOtra : { kind: 'PAYMENT_FORM_UNDEFINED' };
  }

  const r = await issueInvoice(deps.issue, {
    requestId: entrada.requestId,
    source: { type: acceso.record.type, id: acceso.record.id },
    channel: 'PORTAL',
    recipient: receptor,
    lines: acceso.record.lines,
    paymentForm: formaDePago,
  });
  return r.kind === 'ALREADY_INVOICED' ? yaFacturadaPorOtra : r;
}
