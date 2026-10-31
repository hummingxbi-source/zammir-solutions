import type { LengthUnit } from '../../../shared-kernel/measure/length';
import { addDays, mexicoDate } from '../../../shared-kernel/date/mx-date';
import type { CustomerId, ProductId, QuoteId, UserId } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { ChargeUnit } from '../../catalog/domain/product';

/** Estados guardados de una cotización. *Vencida* no se guarda: se deriva de la vigencia y el reloj
 *  [RF-M2-07, MODELO_DE_DATOS M2]. */
export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';

/** Lo que se muestra: los estados guardados más *vencida*. */
export type QuoteDisplayStatus = QuoteStatus | 'EXPIRED';

/** Una línea de la cotización: instantánea del producto al momento de armarla [RN-03]. Los importes van
 *  en centavos enteros con IVA ya desglosado por línea [ADR-0011]. */
export interface QuoteLine {
  readonly id: string;
  readonly productId: ProductId | null;
  readonly name: string;
  readonly chargeUnit: ChargeUnit;
  /** Precio unitario con IVA incluido que se usó (el del catálogo, o el ajustado con autorización). */
  readonly unitPriceCents: number;
  /** Precio del catálogo al armar la línea; difiere de `unitPriceCents` solo si hubo descuento. */
  readonly catalogPriceCents: number;
  readonly ruleId: string;
  readonly ruleParams: unknown;
  readonly widthMm: number | null;
  readonly heightMm: number | null;
  readonly quantity: number;
  /** Unidad en que se capturó y se muestra el cálculo [RN-04]. */
  readonly displayUnit: LengthUnit;
  readonly baseCents: number;
  readonly taxCents: number;
  readonly lineTotalCents: number;
  readonly isTaxExempt: boolean;
  /** El cálculo tal como se muestra: `1.20 m × 0.80 m = 0.96 m² × $280.00 = $268.80`. */
  readonly detail: string;
}

/** Estado de envío de la cotización respecto al servidor [GLOSARIO]. */
export type QuoteSyncStatus = 'DRAFT' | 'SAVED_ON_TABLET' | 'SENT';

export interface Quote {
  readonly id: QuoteId;
  readonly status: QuoteStatus;
  readonly customerId: CustomerId;
  readonly siteAddress: string | null;
  readonly lines: readonly QuoteLine[];
  /** Persona que la armó (la que entró con su PIN). */
  readonly userId: UserId;
  /** Folio provisional del dispositivo (`T1-0004`); los borradores no tienen [RN-16]. */
  readonly tempFolio: string | null;
  /** Folio definitivo (`COT-2026-0012`), asignado por el servidor al recibirla. */
  readonly folio: string | null;
  readonly publicCode: string | null;
  /** Instante de emisión (ISO, UTC). */
  readonly issuedAt: string | null;
  /** Último día de vigencia (`AAAA-MM-DD`, hora de México). */
  readonly validUntil: string | null;
  /** Copia de las condiciones vigentes al emitir [RN-13]. */
  readonly conditionsText: string | null;
  readonly privacyNoticeVersion: number | null;
  readonly catalogVersion: number | null;
  /** Administrador que autorizó un descuento en alguna línea [RN-19]; viaja en la operación al emitir. */
  readonly discountAuthorizedBy: UserId | null;
  readonly syncStatus: QuoteSyncStatus;
  /** Motivo por el que un administrador debe revisarla, si el servidor la marcó. */
  readonly reviewReason: string | null;
  /** Última modificación local (ISO, UTC). */
  readonly updatedAt: string;
}

export interface QuoteTotals {
  readonly subtotalCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
}

/** El total es la suma de las líneas: subtotal e IVA son las sumas de los de cada línea [ADR-0011]. */
export function quoteTotals(lines: readonly QuoteLine[]): QuoteTotals {
  let subtotalCents = 0;
  let taxCents = 0;
  for (const linea of lines) {
    subtotalCents += linea.baseCents;
    taxCents += linea.taxCents;
  }
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

/** Tabla de transiciones válidas [RF-M2-07]. Aceptada y rechazada son finales. */
export const QUOTE_TRANSITIONS: Readonly<Record<QuoteStatus, readonly QuoteStatus[]>> = {
  DRAFT: ['SENT'],
  SENT: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: [],
};

export interface InvalidTransition {
  readonly code: 'INVALID_TRANSITION';
  readonly from: QuoteStatus;
  readonly to: QuoteStatus;
}

/** Valida un cambio de estado contra la tabla de transiciones. */
export function checkTransition(
  from: QuoteStatus,
  to: QuoteStatus,
): Result<QuoteStatus, InvalidTransition> {
  return QUOTE_TRANSITIONS[from].includes(to)
    ? ok(to)
    : err({ code: 'INVALID_TRANSITION', from, to });
}

/** Último día de vigencia: la fecha de emisión (en hora de México) más los días configurados [RN-12]. */
export function validUntil(issuedAt: Date, validityDays: number): string {
  return addDays(mexicoDate(issuedAt), validityDays);
}

/** Estado que se muestra. Una enviada pasa a *vencida* cuando el día de hoy (en México) es posterior al
 *  último día de vigencia: hasta las 23:59:59 de ese día sigue vigente. No hay proceso aparte: se
 *  calcula con el reloj [RN-12, RN-17]. */
export function displayStatus(
  quote: Pick<Quote, 'status' | 'validUntil'>,
  ahora: Date,
): QuoteDisplayStatus {
  if (
    quote.status === 'SENT' &&
    quote.validUntil !== null &&
    mexicoDate(ahora) > quote.validUntil
  ) {
    return 'EXPIRED';
  }
  return quote.status;
}
