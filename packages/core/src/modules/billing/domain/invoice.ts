import { err, ok, type Result } from '../../../shared-kernel/result';
import { isValidRfc, isValidZip } from '../../customers/domain/customer';

/** Forma de pago del CFDI: `01` efectivo, `03` transferencia [RN-28]. Los pagos mixtos esperan a PD-28. */
export type PaymentForm = '01' | '03';

/** Objeto de impuesto del SAT: `01` no objeto, `02` sí objeto, `03` sí objeto y no obligado al desglose. */
export type TaxObject = '01' | '02' | '03';

/** Quien recibe la factura, tal como aparece en su constancia de situación fiscal [RF-M10-05]. */
export interface CfdiRecipient {
  readonly rfc: string;
  readonly name: string;
  /** Código postal fiscal: 5 dígitos. */
  readonly fiscalZip: string;
  readonly regime: string;
  readonly cfdiUse: string;
}

/** Un concepto de la factura. Los importes van en centavos y **sin IVA** (el CFDI desglosa el impuesto);
 *  los precios del sistema incluyen IVA y se separan con el módulo de dinero antes de llegar aquí [RN-05]. */
export interface CfdiConcept {
  readonly productServiceKey: string;
  readonly unitKey: string;
  readonly description: string;
  /** Cantidad, puede ser decimal (metros cuadrados). No es dinero. */
  readonly quantity: number;
  readonly unitValueCents: number;
  readonly amountCents: number;
  readonly taxObject: TaxObject;
  /** IVA trasladado del concepto, en centavos. Cero cuando no es objeto de impuesto o está exento. */
  readonly taxCents: number;
}

/** Lo que se le pide al PAC para timbrar. */
export interface StampRequest {
  /** Una solicitud, un timbre: con el mismo `requestId` el PAC nunca timbra dos veces [RN-24]. */
  readonly requestId: string;
  readonly paymentForm: PaymentForm;
  /** `PUE`: una sola exhibición [RN-28]. */
  readonly paymentMethod: 'PUE';
  readonly recipient: CfdiRecipient;
  readonly concepts: readonly CfdiConcept[];
  readonly issuedAt: Date;
  /** UUID de la factura que esta relaciona (anticipo o sustitución), si la hay. */
  readonly relatedUuid?: string;
}

export interface StampedInvoice {
  readonly uuid: string;
  readonly stampedAt: Date;
  readonly subtotalCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
}

export type InvoiceStatus = 'VALID' | 'CANCELLATION_PENDING' | 'CANCELLED';

/** Motivos de cancelación del SAT [RN-28]: `01` con relación (exige la factura que sustituye), `02` sin
 *  relación, `03` no se llevó a cabo la operación, `04` operación nominativa en factura global. */
export type CancellationMotive = '01' | '02' | '03' | '04';

export interface CancelRequest {
  readonly uuid: string;
  readonly motive: CancellationMotive;
  /** Obligatorio con el motivo `01`: el UUID de la factura que la sustituye. */
  readonly substituteUuid?: string;
}

export interface CancelOutcome {
  readonly uuid: string;
  readonly status: InvoiceStatus;
}

export interface InvoiceFiles {
  readonly xml: string;
  readonly pdf: Uint8Array;
}

export type BillingErrorCode =
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'ALREADY_CANCELLED'
  | 'CANCELLATION_REJECTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT';

export interface BillingError {
  readonly code: BillingErrorCode;
  /** Qué campos no valen, cuando el error es `INVALID_REQUEST`. */
  readonly fields?: readonly string[];
}

/** ¿Vale la pena reintentar? Solo cuando el PAC no respondió: la solicitud queda "en proceso" y se
 *  reintenta con el mismo `requestId`, así que no se duplica el timbre [RN-24, RF-M10-15]. */
export function isRetryable(code: BillingErrorCode): boolean {
  return code === 'PROVIDER_UNAVAILABLE' || code === 'TIMEOUT';
}

/** Suma de los importes de una solicitud: subtotal, IVA y total, en centavos. */
export function invoiceTotals(concepts: readonly CfdiConcept[]): {
  readonly subtotalCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
} {
  const subtotalCents = concepts.reduce((s, c) => s + c.amountCents, 0);
  const taxCents = concepts.reduce((s, c) => s + c.taxCents, 0);
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

const entero = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** Revisa en la frontera lo que se manda al PAC, para no gastar un timbre en una solicitud que va a fallar:
 *  RFC de 12 o 13 caracteres, código postal de 5 dígitos, datos del receptor completos y conceptos con
 *  importes enteros que cuadran (cantidad × valor unitario = importe) [RF-M10-13, RN-28]. Devuelve los
 *  campos que no valen. */
export function validateStampRequest(
  solicitud: StampRequest,
): Result<StampRequest, BillingError & { readonly fields: readonly string[] }> {
  const fields: string[] = [];
  const r = solicitud.recipient;
  if (solicitud.requestId.trim() === '') {
    fields.push('requestId');
  }
  if (!isValidRfc(r.rfc)) {
    fields.push('recipient.rfc');
  }
  if (r.name.trim() === '') {
    fields.push('recipient.name');
  }
  if (!isValidZip(r.fiscalZip)) {
    fields.push('recipient.fiscalZip');
  }
  if (r.regime.trim() === '') {
    fields.push('recipient.regime');
  }
  if (r.cfdiUse.trim() === '') {
    fields.push('recipient.cfdiUse');
  }
  if (solicitud.concepts.length === 0) {
    fields.push('concepts');
  }
  solicitud.concepts.forEach((c, i) => {
    const campo = (nombre: string): string => `concepts[${String(i)}].${nombre}`;
    if (c.productServiceKey.trim() === '') {
      fields.push(campo('productServiceKey'));
    }
    if (c.unitKey.trim() === '') {
      fields.push(campo('unitKey'));
    }
    if (c.description.trim() === '') {
      fields.push(campo('description'));
    }
    if (!(c.quantity > 0) || !Number.isFinite(c.quantity)) {
      fields.push(campo('quantity'));
    }
    if (!entero(c.unitValueCents) || !entero(c.amountCents) || !entero(c.taxCents)) {
      fields.push(campo('amountCents'));
    } else if (Math.round(c.quantity * c.unitValueCents) !== c.amountCents) {
      fields.push(campo('amountCents'));
    }
    if (c.taxObject === '01' && c.taxCents !== 0) {
      fields.push(campo('taxCents'));
    }
  });
  if (fields.length > 0) {
    return err({ code: 'INVALID_REQUEST', fields });
  }
  return ok(solicitud);
}

/** Valida una cancelación: el motivo `01` exige la factura sustituta y los demás no la llevan. */
export function validateCancelRequest(
  solicitud: CancelRequest,
): Result<CancelRequest, BillingError & { readonly fields: readonly string[] }> {
  const fields: string[] = [];
  if (solicitud.uuid.trim() === '') {
    fields.push('uuid');
  }
  const conSustituta =
    solicitud.substituteUuid !== undefined && solicitud.substituteUuid.trim() !== '';
  if (solicitud.motive === '01' && !conSustituta) {
    fields.push('substituteUuid');
  }
  if (solicitud.motive !== '01' && solicitud.substituteUuid !== undefined) {
    fields.push('substituteUuid');
  }
  return fields.length > 0 ? err({ code: 'INVALID_REQUEST', fields }) : ok(solicitud);
}
