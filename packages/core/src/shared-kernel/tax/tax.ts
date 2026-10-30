import { err, ok, type Result } from '../result';
import { money, sum, ZERO, type Money } from '../money/money';

/** Puntos base: 1 600 = 16 %. Las tasas viven en la configuración, no en el código [RN-06]. */
const PUNTOS_BASE_TOTAL = 10_000n;

export type TaxErrorCode =
  /** Tasa, porcentaje o cantidad que no es un entero dentro de su rango. */
  | 'INVALID_INPUT'
  /** Un total negativo no se desglosa (las cancelaciones se registran aparte). */
  | 'NEGATIVE_TOTAL'
  /** El resultado sale del rango de enteros seguros. */
  | 'OUT_OF_RANGE';

export interface TaxError {
  readonly code: TaxErrorCode;
}

/** Cómo se reparte el total de una línea: `base + iva = total`, siempre al centavo. */
export interface TaxSplit {
  readonly base: Money;
  readonly tax: Money;
  readonly total: Money;
}

export interface TaxableLine {
  readonly total: Money;
  /** Productos exentos: no llevan IVA y su base es igual al total. */
  readonly exempt: boolean;
}

export interface DocumentTax {
  readonly lines: readonly TaxSplit[];
  readonly base: Money;
  readonly tax: Money;
  readonly total: Money;
}

export interface Deposit {
  readonly deposit: Money;
  readonly balance: Money;
}

/** Divide y redondea con la mitad hacia arriba [ADR-0011]. Solo para numerador ≥ 0 y divisor > 0. */
function dividirMitadArriba(numerador: bigint, divisor: bigint): bigint {
  return (2n * numerador + divisor) / (2n * divisor);
}

/** Divide y redondea siempre hacia arriba. Solo para numerador ≥ 0 y divisor > 0. */
function dividirHaciaArriba(numerador: bigint, divisor: bigint): bigint {
  return (numerador + divisor - 1n) / divisor;
}

function aMoney(valor: bigint): Result<Money, TaxError> {
  const centavos = money(Number(valor));
  return centavos.ok ? ok(centavos.value) : err({ code: 'OUT_OF_RANGE' });
}

/** Para resultados que se saben dentro del rango porque nunca superan un total que ya es un monto
 *  válido (base, IVA, anticipo y saldo). Única aserción de tipo del módulo junto con `aMoney`. */
function dentroDelTotal(valor: bigint): Money {
  return Number(valor) as Money;
}

function esEnteroNoNegativo(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

/** Importe de una línea vendida por área: `precio_m² × ancho × alto × cantidad / 1 000 000`,
 *  redondeado con la mitad hacia arriba [RN-05, ADR-0011]. El precio va en centavos por m²;
 *  las medidas, en milímetros enteros. */
export function areaLineTotal(
  precioPorM2: Money,
  anchoMm: number,
  altoMm: number,
  cantidad: number,
): Result<Money, TaxError> {
  if (
    !Number.isInteger(anchoMm) ||
    anchoMm <= 0 ||
    !Number.isInteger(altoMm) ||
    altoMm <= 0 ||
    !Number.isInteger(cantidad) ||
    cantidad <= 0 ||
    precioPorM2 < 0
  ) {
    return err({ code: 'INVALID_INPUT' });
  }
  const numerador = BigInt(precioPorM2) * BigInt(anchoMm) * BigInt(altoMm) * BigInt(cantidad);
  return aMoney(dividirMitadArriba(numerador, 1_000_000n));
}

/** Importe por área ya conocida: `precio_m² × área_mm² × cantidad / 1 000 000`, mitad hacia arriba.
 *  Sirve cuando el área no es ancho × alto (área mínima cobrable, medidas redondeadas). */
export function areaAmount(
  precioPorM2: Money,
  areaMm2: number,
  cantidad: number,
): Result<Money, TaxError> {
  if (
    !Number.isSafeInteger(areaMm2) ||
    areaMm2 <= 0 ||
    !Number.isInteger(cantidad) ||
    cantidad <= 0 ||
    precioPorM2 < 0
  ) {
    return err({ code: 'INVALID_INPUT' });
  }
  const numerador = BigInt(precioPorM2) * BigInt(areaMm2) * BigInt(cantidad);
  return aMoney(dividirMitadArriba(numerador, 1_000_000n));
}

/** Importe por metro lineal: `precio_m × largo_mm × cantidad / 1 000`, mitad hacia arriba. */
export function linearAmount(
  precioPorMetro: Money,
  largoMm: number,
  cantidad: number,
): Result<Money, TaxError> {
  if (
    !Number.isSafeInteger(largoMm) ||
    largoMm <= 0 ||
    !Number.isInteger(cantidad) ||
    cantidad <= 0 ||
    precioPorMetro < 0
  ) {
    return err({ code: 'INVALID_INPUT' });
  }
  const numerador = BigInt(precioPorMetro) * BigInt(largoMm) * BigInt(cantidad);
  return aMoney(dividirMitadArriba(numerador, 1_000n));
}

/** Desglosa el total de una línea (precio con IVA incluido) en base e IVA [RN-06]:
 *  `base = redondear(total × 10 000 / (10 000 + tasa))` e `iva = total − base`. */
export function splitTax(
  total: Money,
  tasaBps: number,
  exento = false,
): Result<TaxSplit, TaxError> {
  if (!esEnteroNoNegativo(tasaBps)) {
    return err({ code: 'INVALID_INPUT' });
  }
  if (total < 0) {
    return err({ code: 'NEGATIVE_TOTAL' });
  }
  if (exento) {
    return ok({ base: total, tax: ZERO, total });
  }
  // La base nunca supera al total (la tasa no es negativa), por eso siempre cabe.
  const base = dividirMitadArriba(
    BigInt(total) * PUNTOS_BASE_TOTAL,
    PUNTOS_BASE_TOTAL + BigInt(tasaBps),
  );
  // El IVA sale por resta: así base + iva = total sin importar el redondeo.
  return ok({ base: dentroDelTotal(base), tax: dentroDelTotal(BigInt(total) - base), total });
}

/** Desglosa un documento línea por línea y suma los resultados: el subtotal y el IVA del documento
 *  son la suma de los de sus líneas, para que ticket, PDF y factura digan lo mismo [ADR-0011]. */
export function splitDocumentTax(
  lineas: readonly TaxableLine[],
  tasaBps: number,
): Result<DocumentTax, TaxError> {
  const desglosadas: TaxSplit[] = [];
  for (const linea of lineas) {
    const desglose = splitTax(linea.total, tasaBps, linea.exempt);
    if (!desglose.ok) {
      return desglose;
    }
    desglosadas.push(desglose.value);
  }
  const total = sum(desglosadas.map((d) => d.total));
  if (!total.ok) {
    return err({ code: 'OUT_OF_RANGE' });
  }
  // Base e IVA suman menos que el total (todo es no negativo), así que caben si el total cabe.
  const sumar = (monto: (d: TaxSplit) => Money): Money =>
    dentroDelTotal(desglosadas.reduce((acumulado, d) => acumulado + BigInt(monto(d)), 0n));
  return ok({
    lines: desglosadas,
    base: sumar((d) => d.base),
    tax: sumar((d) => d.tax),
    total: total.value,
  });
}

/** Anticipo: el porcentaje del total redondeado hacia arriba; el saldo es la resta [ADR-0011]. */
export function computeDeposit(total: Money, porcentajeBps: number): Result<Deposit, TaxError> {
  if (!esEnteroNoNegativo(porcentajeBps) || porcentajeBps > Number(PUNTOS_BASE_TOTAL)) {
    return err({ code: 'INVALID_INPUT' });
  }
  if (total < 0) {
    return err({ code: 'NEGATIVE_TOTAL' });
  }
  // Con un porcentaje de 0 a 100 %, el anticipo nunca supera al total.
  const anticipo = dividirHaciaArriba(BigInt(total) * BigInt(porcentajeBps), PUNTOS_BASE_TOTAL);
  return ok({
    deposit: dentroDelTotal(anticipo),
    balance: dentroDelTotal(BigInt(total) - anticipo),
  });
}
