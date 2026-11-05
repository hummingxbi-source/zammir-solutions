import type { CancellationMotive, PaymentForm } from '../domain/invoice';
import type { StampUsage } from '../domain/stamp-usage';
import type { InvoiceSourceType } from './issue-invoice';
import type { PortalRecipientInput } from './request-portal-invoice';

/** Una venta u orden que ya se puede facturar: liquidada, sin factura vigente ni en proceso y sin cancelar
 *  [RN-25]. Trae los datos fiscales de la ficha del cliente, si los tiene, para precargar al receptor [RF-M10-05]. */
export interface InvoiceCandidate {
  readonly sourceType: InvoiceSourceType;
  readonly sourceId: string;
  readonly folio: string;
  readonly customerName: string | null;
  readonly customerFiscal: PortalRecipientInput | null;
  readonly totalCents: number;
  /** Cuándo se liquidó (ISO); nulo no debería ocurrir en lo facturable. */
  readonly settledAt: string | null;
}

export interface AdminIssueInput {
  readonly source: { readonly type: InvoiceSourceType; readonly id: string };
  /** Identificador de esta solicitud: reenviarla no duplica el timbre [RN-24]. */
  readonly requestId: string;
  readonly recipient: PortalRecipientInput;
  /** Solo cuando el pago fue mixto: la forma la elige quien factura (PD-28). */
  readonly paymentForm?: PaymentForm;
}

/** Cómo termina pedir una factura desde la aplicación del administrador. */
export type AdminIssueResult =
  | { readonly kind: 'STAMPED'; readonly folio: string; readonly uuid: string }
  | { readonly kind: 'IN_PROCESS' }
  | { readonly kind: 'INVALID'; readonly fields: readonly string[] }
  | { readonly kind: 'PAYMENT_FORM_REQUIRED' }
  /** El ajuste de anticipos está en la opción (b), que no se construyó [RN-27]. */
  | { readonly kind: 'DEPOSIT_TREATMENT_UNSUPPORTED' }
  | { readonly kind: 'INELIGIBLE'; readonly reason: string }
  | { readonly kind: 'NOT_BILLABLE' }
  | { readonly kind: 'REJECTED' }
  | { readonly kind: 'NOT_AUTHORIZED' }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'UNAVAILABLE' }
  | { readonly kind: 'NO_NETWORK' };

/** Los archivos de una factura emitida, tal como se guardaron: el XML como texto y el PDF en base64. */
export interface AdminInvoiceFiles {
  readonly folio: string;
  readonly xml: string;
  readonly pdfBase64: string;
}

export type IssuedInvoiceStatus = 'IN_PROCESS' | 'STAMPED' | 'CANCELLED' | 'FAILED';

/** Una factura pedida, con lo que hace falta para revisarla: emitida, en proceso, cancelada o fallida [S4-20]. */
export interface IssuedInvoice {
  readonly requestId: string;
  readonly status: IssuedInvoiceStatus;
  /** `F-AAAA-0001`; nulo mientras está en proceso. */
  readonly folio: string | null;
  readonly channel: 'SYSTEM' | 'PORTAL';
  readonly sourceType: InvoiceSourceType;
  readonly sourceFolio: string | null;
  readonly customerName: string | null;
  readonly totalCents: number | null;
  readonly stampedAt: string | null;
  readonly createdAt: string;
  /** Cuántos intentos van contra el PAC y el último error, si la solicitud sigue en proceso. */
  readonly attempts: number;
  readonly lastError: string | null;
  readonly cancelMotive: CancellationMotive | null;
  /** Se pidió cancelarla y el receptor todavía no la acepta. */
  readonly cancellationRequested: boolean;
  readonly cancelledAt: string | null;
}

/** Una factura en el historial de un cliente [RF-M10-21, RF-M5-02]. */
export interface CustomerInvoice {
  readonly folio: string;
  readonly status: 'STAMPED' | 'CANCELLED';
  readonly sourceType: InvoiceSourceType;
  readonly sourceFolio: string | null;
  readonly totalCents: number | null;
  readonly stampedAt: string | null;
}

export type AdminRetryResult =
  | { readonly kind: 'STAMPED'; readonly folio: string }
  | { readonly kind: 'IN_PROCESS' }
  | { readonly kind: 'REJECTED' }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'NOT_AUTHORIZED' }
  | { readonly kind: 'UNAVAILABLE' }
  | { readonly kind: 'NO_NETWORK' };

export interface AdminCancelInput {
  readonly folio: string;
  readonly motive: CancellationMotive;
  /** Con el motivo `01`, el folio de la factura que la sustituye [RN-28]. */
  readonly substituteFolio?: string;
}

export type AdminCancelResult =
  | { readonly kind: 'CANCELLED' }
  | { readonly kind: 'CANCELLATION_PENDING' }
  | { readonly kind: 'INVALID'; readonly fields: readonly string[] }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'NOT_CANCELLABLE' }
  | { readonly kind: 'REJECTED' }
  | { readonly kind: 'NOT_AUTHORIZED' }
  | { readonly kind: 'UNAVAILABLE' }
  | { readonly kind: 'NO_NETWORK' };

/** Puerto de la pantalla de facturas del administrador: lo facturable, emitir, revisar lo emitido y en proceso,
 *  reintentar, cancelar, ver los timbres y bajar los archivos. */
export interface AdminInvoices {
  /** Lo que se puede facturar ahora; `null` si no se pudo leer (sin conexión o sin permiso). */
  candidates(): Promise<readonly InvoiceCandidate[] | null>;
  issue(entrada: AdminIssueInput): Promise<AdminIssueResult>;
  /** Las facturas pedidas (emitidas, en proceso, canceladas y fallidas); `null` si no se pudo leer. */
  list(): Promise<readonly IssuedInvoice[] | null>;
  /** Reintenta una solicitud en proceso con su mismo identificador: nunca duplica el timbre [RN-24]. */
  retry(requestId: string): Promise<AdminRetryResult>;
  /** Cancela una factura con un motivo del SAT; queda en la bitácora [RF-M10-19]. */
  cancel(entrada: AdminCancelInput): Promise<AdminCancelResult>;
  /** Timbres usados este año contra el límite del paquete [RF-M10-20]; `null` si no se pudo leer. */
  usage(): Promise<StampUsage | null>;
  /** Las facturas de un cliente para su historial; `null` si no se pudo leer. */
  customerInvoices(customerId: string): Promise<readonly CustomerInvoice[] | null>;
  /** Los archivos de una factura por su folio `F-AAAA-0001`; `null` si no existe o no se pudo leer. */
  files(folio: string): Promise<AdminInvoiceFiles | null>;
}
