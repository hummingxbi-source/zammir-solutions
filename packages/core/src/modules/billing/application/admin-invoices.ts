import type { PaymentForm } from '../domain/invoice';
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

/** Puerto de la pantalla de facturas del administrador: lo facturable, emitir y bajar los archivos. */
export interface AdminInvoices {
  /** Lo que se puede facturar ahora; `null` si no se pudo leer (sin conexión o sin permiso). */
  candidates(): Promise<readonly InvoiceCandidate[] | null>;
  issue(entrada: AdminIssueInput): Promise<AdminIssueResult>;
  /** Los archivos de una factura por su folio `F-AAAA-0001`; `null` si no existe o no se pudo leer. */
  files(folio: string): Promise<AdminInvoiceFiles | null>;
}
