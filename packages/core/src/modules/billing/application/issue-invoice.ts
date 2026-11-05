import type { Clock } from '../../../shared-kernel/clock';
import {
  isRetryable,
  validateStampRequest,
  type BillingErrorCode,
  type CfdiRecipient,
  type PaymentForm,
  type StampRequest,
} from '../domain/invoice';
import { buildInvoiceConcepts, type InvoiceSourceLine } from '../domain/invoice-concepts';
import type { BillingProvider } from './ports';

export type InvoiceSourceType = 'COUNTER_SALE' | 'WORK_ORDER';

export interface InvoiceRecord {
  readonly status: 'IN_PROCESS' | 'STAMPED' | 'FAILED';
  readonly uuid: string | null;
  readonly folio: string | null;
}

/** Puerto: las facturas que ya se pidieron, para no timbrar dos veces la misma operación [RN-24]. Quien lo
 *  implementa asigna el folio `F-AAAA-0001` sin huecos al guardar el timbre [RN-15, RN-16]. */
export interface InvoiceRequestStore {
  /** Abre la solicitud y guarda lo que se le va a mandar al PAC, para poder reintentarla. Con el mismo
   *  `requestId` devuelve la que ya existe; si la venta u orden ya tiene otra factura vigente o en proceso,
   *  `ALREADY_INVOICED`. */
  begin(entrada: {
    readonly requestId: string;
    readonly source: { readonly type: InvoiceSourceType; readonly id: string };
    readonly channel: 'PORTAL' | 'SYSTEM';
    readonly snapshot: StampRequest;
  }): Promise<
    | { readonly kind: 'STARTED' }
    | { readonly kind: 'EXISTING'; readonly record: InvoiceRecord }
    | { readonly kind: 'ALREADY_INVOICED' }
  >;
  /** Guarda el timbre y los archivos, y devuelve el folio que se le asignó. */
  markStamped(
    requestId: string,
    entrada: {
      readonly uuid: string;
      readonly stampedAt: Date;
      readonly recipient: CfdiRecipient;
      readonly paymentForm: PaymentForm;
      readonly xml: string;
      readonly pdf: Uint8Array;
    },
  ): Promise<{ readonly folio: string }>;
  /** Anota un intento que no terminó (el PAC no respondió) y por qué, para saber cuántos van [RF-M10-15]. */
  recordAttempt(requestId: string, error: BillingErrorCode): Promise<void>;
  /** El PAC rechazó la solicitud y no tiene caso reintentarla con ese identificador. */
  markFailed(requestId: string): Promise<void>;
}

export interface IssueInvoiceDeps {
  readonly provider: BillingProvider;
  readonly store: InvoiceRequestStore;
  readonly clock: Clock;
}

export interface IssueInvoiceInput {
  /** Identificador de esta solicitud: reintentar con el mismo nunca duplica el timbre [RN-24]. */
  readonly requestId: string;
  readonly source: { readonly type: InvoiceSourceType; readonly id: string };
  readonly channel: 'PORTAL' | 'SYSTEM';
  readonly recipient: CfdiRecipient;
  readonly lines: readonly InvoiceSourceLine[];
  readonly paymentForm: PaymentForm;
}

export type IssueInvoiceOutcome =
  | { readonly kind: 'STAMPED'; readonly uuid: string; readonly folio: string }
  /** El PAC no respondió: la solicitud queda en proceso y se reintenta con el mismo identificador. */
  | { readonly kind: 'IN_PROCESS' }
  | { readonly kind: 'ALREADY_INVOICED' }
  /** Datos del receptor o del documento que no valen; `fields` dice cuáles. */
  | { readonly kind: 'INVALID'; readonly fields: readonly string[] }
  /** A estas líneas les faltan las claves del SAT, o sus importes no cuadran: no se factura (PD-29). */
  | {
      readonly kind: 'NOT_BILLABLE';
      readonly reason: 'NO_LINES' | 'FISCAL_DATA_MISSING' | 'LINE_TOTAL_MISMATCH';
    }
  | { readonly kind: 'REJECTED'; readonly code: BillingErrorCode }
  | { readonly kind: 'UNAVAILABLE' };

/** Timbra una solicitud ya abierta, baja sus archivos y guarda el timbre con su folio. Sirve igual para la
 *  primera vez que para un reintento: con el mismo `requestId` el PAC nunca timbra dos veces [RN-24]. Si el PAC
 *  no responde, anota el intento y deja la solicitud en proceso [RF-M10-15]. */
export async function completeInvoice(
  deps: IssueInvoiceDeps,
  solicitud: StampRequest,
): Promise<IssueInvoiceOutcome> {
  const timbre = await deps.provider.stamp(solicitud);
  if (!timbre.ok) {
    if (isRetryable(timbre.error.code)) {
      await deps.store.recordAttempt(solicitud.requestId, timbre.error.code);
      return { kind: 'IN_PROCESS' };
    }
    await deps.store.markFailed(solicitud.requestId);
    return { kind: 'REJECTED', code: timbre.error.code };
  }
  const archivos = await deps.provider.download(timbre.value.uuid);
  if (!archivos.ok) {
    // Ya está timbrada: se reintenta bajar los archivos con el mismo identificador, sin timbrar otra vez.
    await deps.store.recordAttempt(solicitud.requestId, archivos.error.code);
    return { kind: 'IN_PROCESS' };
  }
  const guardada = await deps.store.markStamped(solicitud.requestId, {
    uuid: timbre.value.uuid,
    stampedAt: timbre.value.stampedAt,
    recipient: solicitud.recipient,
    paymentForm: solicitud.paymentForm,
    xml: archivos.value.xml,
    pdf: archivos.value.pdf,
  });
  return { kind: 'STAMPED', uuid: timbre.value.uuid, folio: guardada.folio };
}

/** Emite la factura de una venta u orden: arma los conceptos, valida lo que se manda al PAC, abre la solicitud
 *  (una operación, una factura vigente), timbra, guarda el timbre con sus archivos y devuelve el folio. Lo usan
 *  el portal del cliente y la factura desde el sistema [RF-M10-04 a RF-M10-07, RN-24]. */
export async function issueInvoice(
  deps: IssueInvoiceDeps,
  entrada: IssueInvoiceInput,
): Promise<IssueInvoiceOutcome> {
  const conceptos = buildInvoiceConcepts(entrada.lines);
  if (!conceptos.ok) {
    return { kind: 'NOT_BILLABLE', reason: conceptos.error.code };
  }
  const solicitud: StampRequest = {
    requestId: entrada.requestId,
    paymentForm: entrada.paymentForm,
    paymentMethod: 'PUE',
    recipient: entrada.recipient,
    concepts: conceptos.value,
    issuedAt: deps.clock.now(),
  };
  const valida = validateStampRequest(solicitud);
  if (!valida.ok) {
    return { kind: 'INVALID', fields: valida.error.fields };
  }

  try {
    const apertura = await deps.store.begin({
      requestId: entrada.requestId,
      source: entrada.source,
      channel: entrada.channel,
      snapshot: solicitud,
    });
    if (apertura.kind === 'ALREADY_INVOICED') {
      return { kind: 'ALREADY_INVOICED' };
    }
    if (apertura.kind === 'EXISTING') {
      const { record } = apertura;
      if (record.status === 'STAMPED' && record.uuid !== null && record.folio !== null) {
        return { kind: 'STAMPED', uuid: record.uuid, folio: record.folio };
      }
      if (record.status === 'FAILED') {
        return { kind: 'REJECTED', code: 'INVALID_REQUEST' };
      }
    }
    return await completeInvoice(deps, solicitud);
  } catch {
    return { kind: 'UNAVAILABLE' };
  }
}
