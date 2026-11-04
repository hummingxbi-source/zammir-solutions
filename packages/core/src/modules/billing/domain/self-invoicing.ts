import { mexicoDate } from '../../../shared-kernel/date/mx-date';
import { err, ok, type Result } from '../../../shared-kernel/result';

// ---------------------------------------------------------------------------------------------------------
// Lo que el cliente teclea o trae en el QR [RF-M10-09]
// ---------------------------------------------------------------------------------------------------------

// Folio definitivo (`OT-2026-0001`, `V-2026-0012`) o provisional de una tablet (`T1-0004`) [RN-15, RN-16].
const FOLIO = /^(?:(?:OT|V)-\d{4}-\d{4,}|T\d+-\d+)$/;
// Código público: 8 caracteres, letras y dígitos del 2 al 9 (sin 0 ni 1), igual que la base lo exige.
const CODIGO = /^[A-Z2-9]{8}$/;

/** El folio como se compara: sin espacios y en mayúsculas. `null` si no tiene forma de folio. */
export function normalizeFolio(texto: string): string | null {
  const folio = texto.trim().toUpperCase();
  return FOLIO.test(folio) ? folio : null;
}

/** El código de verificación como se compara: sin espacios ni guiones (se escribe `ABCD-2345` a mano) y en
 *  mayúsculas. `null` si no tiene forma de código. */
export function normalizeVerificationCode(texto: string): string | null {
  const codigo = texto.replace(/[\s-]/g, '').toUpperCase();
  return CODIGO.test(codigo) ? codigo : null;
}

// ---------------------------------------------------------------------------------------------------------
// Qué se puede autofacturar y hasta cuándo [RN-24, RN-25, RN-26]
// ---------------------------------------------------------------------------------------------------------

/** Regla del plazo (PD-09). Hoy solo existe una: hasta el último día del mes de la compra. */
export type DeadlineRule = 'end_of_month';

export interface SelfInvoicingSource {
  readonly type: 'COUNTER_SALE' | 'WORK_ORDER';
  /** `CANCELLED` en ventas y órdenes canceladas. */
  readonly cancelled: boolean;
  readonly totalCents: number;
  /** Suma de lo pagado y aplicado a la venta u orden. */
  readonly paidCents: number;
  /** Cuándo se hizo la compra (venta) o se liquidó el trabajo (último pago que lo dejó en saldo cero). */
  readonly settledAt: string | null;
  /** Ya tiene una factura vigente o en proceso [RN-24]. */
  readonly invoiced: boolean;
}

export type SelfInvoicingBlock =
  /** Cancelada: no se factura. */
  | 'CANCELLED'
  /** Ya tiene una factura vigente o en proceso: una operación, una factura [RN-24]. */
  | 'ALREADY_INVOICED'
  /** Todavía tiene saldo: solo se factura lo liquidado [RN-25]. */
  | 'NOT_SETTLED'
  /** Pasó el último día del mes: la factura se pide directamente al negocio [RN-26]. */
  | 'EXPIRED';

/** Último día en que se puede autofacturar lo que se liquidó en `liquidadoEn`, en hora de México:
 *  el último día de ese mes, inclusive [RN-26]. `AAAA-MM-DD`. */
export function selfInvoicingDeadline(
  liquidadoEn: Date,
  regla: DeadlineRule = 'end_of_month',
): string {
  return PLAZOS[regla](mexicoDate(liquidadoEn));
}

/** Cada regla de plazo dice, dado el día de la compra (`AAAA-MM-DD`), cuál es el último día para facturar. */
const PLAZOS: Readonly<Record<DeadlineRule, (diaDeLaCompra: string) => string>> = {
  end_of_month: (dia) => {
    const [anio, mes] = dia.split('-').map(Number);
    const ultimo = new Date(Date.UTC(anio ?? 1970, mes ?? 1, 0)).getUTCDate();
    return `${String(anio ?? 1970)}-${String(mes ?? 1).padStart(2, '0')}-${String(ultimo)}`;
  },
};

export interface SelfInvoicingPermit {
  /** Último día para pedirla, `AAAA-MM-DD`. */
  readonly deadline: string;
}

/** ¿Puede el cliente autofacturar esta venta u orden ahora? Solo si no está cancelada ni facturada, está
 *  liquidada y no pasó el plazo [RN-24, RN-25, RN-26]. La fecha de hoy es la de México. */
export function evaluateSelfInvoicing(entrada: {
  readonly source: SelfInvoicingSource;
  readonly now: Date;
  readonly rule?: DeadlineRule;
}): Result<SelfInvoicingPermit, SelfInvoicingBlock> {
  const { source } = entrada;
  if (source.cancelled) {
    return err('CANCELLED');
  }
  if (source.invoiced) {
    return err('ALREADY_INVOICED');
  }
  if (source.paidCents < source.totalCents || source.settledAt === null) {
    return err('NOT_SETTLED');
  }
  const liquidadoEn = new Date(source.settledAt);
  if (Number.isNaN(liquidadoEn.getTime())) {
    return err('NOT_SETTLED');
  }
  const deadline = selfInvoicingDeadline(liquidadoEn, entrada.rule);
  if (mexicoDate(entrada.now) > deadline) {
    return err('EXPIRED');
  }
  return ok({ deadline });
}

// ---------------------------------------------------------------------------------------------------------
// Límite de intentos por IP y por folio [RF-M10-11, RNF-12]
// ---------------------------------------------------------------------------------------------------------

export interface RateLimitPolicy {
  /** Cuánto tiempo hacia atrás se cuentan los intentos fallidos. */
  readonly windowSeconds: number;
  readonly maxFailuresPerIp: number;
  readonly maxFailuresPerFolio: number;
}

/** Valores por omisión: 15 minutos, 15 fallos por IP y 5 por folio. Son de seguridad, no del negocio; el
 *  servidor puede cambiarlos con variables de entorno. */
export const DEFAULT_RATE_LIMIT: RateLimitPolicy = {
  windowSeconds: 900,
  maxFailuresPerIp: 15,
  maxFailuresPerFolio: 5,
};

export type RateLimitDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly scope: 'IP' | 'FOLIO';
      readonly retryAfterSeconds: number;
    };

/** Decide si se atiende un intento, según cuántos fallos recientes tienen esa IP y ese folio. Los fallos
 *  cuentan aunque el folio no exista: así el límite tampoco delata cuáles folios existen. */
export function evaluateRateLimit(
  fallos: { readonly ip: number; readonly folio: number },
  politica: RateLimitPolicy = DEFAULT_RATE_LIMIT,
): RateLimitDecision {
  if (fallos.ip >= politica.maxFailuresPerIp) {
    return { allowed: false, scope: 'IP', retryAfterSeconds: politica.windowSeconds };
  }
  if (fallos.folio >= politica.maxFailuresPerFolio) {
    return { allowed: false, scope: 'FOLIO', retryAfterSeconds: politica.windowSeconds };
  }
  return { allowed: true };
}
