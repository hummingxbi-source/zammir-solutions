import { err, ok, type Result } from '../result';

declare const marca: unique symbol;

/** Dinero en centavos enteros. Nunca se usan decimales para dinero [RN-05, RNF-33]:
 *  el único modo de crear uno es `money()`, que rechaza lo que no sea un entero seguro. */
export type Money = number & { readonly [marca]: 'Money' };

export type MoneyErrorCode =
  /** Los centavos no son un número entero (incluye NaN e infinitos). */
  | 'NOT_INTEGER'
  /** El monto, o el resultado de la operación, sale del rango de enteros seguros. */
  | 'OUT_OF_RANGE'
  /** Una cantidad negativa no tiene sentido al multiplicar un monto. */
  | 'NEGATIVE_QUANTITY'
  /** Bajar más del 100 % dejaría el monto en negativo. */
  | 'NEGATIVE_RESULT';

export interface MoneyError {
  readonly code: MoneyErrorCode;
}

/** Crea un monto a partir de centavos enteros. */
export function money(cents: number): Result<Money, MoneyError> {
  if (!Number.isInteger(cents)) {
    return err({ code: 'NOT_INTEGER' });
  }
  if (!Number.isSafeInteger(cents)) {
    return err({ code: 'OUT_OF_RANGE' });
  }
  // `|| 0` convierte -0 en 0; la única aserción de tipo de este módulo (la marca solo existe al compilar).
  return ok((cents || 0) as Money);
}

export const ZERO: Money = 0 as Money;

export function add(a: Money, b: Money): Result<Money, MoneyError> {
  return money(a + b);
}

export function subtract(a: Money, b: Money): Result<Money, MoneyError> {
  return money(a - b);
}

/** Monto por una cantidad entera de piezas (0 o más). */
export function multiply(a: Money, cantidad: number): Result<Money, MoneyError> {
  if (!Number.isInteger(cantidad)) {
    return err({ code: 'NOT_INTEGER' });
  }
  if (cantidad < 0) {
    return err({ code: 'NEGATIVE_QUANTITY' });
  }
  return money(a * cantidad);
}

/** Monto por una cantidad con hasta 3 decimales (1.5 kg, 2.5 h) [RF-M1-12, ADR-0048, ADR-0011]: precio por
 *  milésimas ÷ 1000, redondeado **una sola vez** al centavo, la mitad hacia arriba. Todo con enteros: la
 *  cantidad entra en milésimas enteras (`quantityToMilli`). Con una cantidad entera da lo mismo que `multiply`. */
export function multiplyByQuantity(a: Money, milesimas: number): Result<Money, MoneyError> {
  if (!Number.isSafeInteger(milesimas)) {
    return err({ code: 'NOT_INTEGER' });
  }
  if (milesimas < 0) {
    return err({ code: 'NEGATIVE_QUANTITY' });
  }
  const escalado = a * milesimas;
  if (!Number.isSafeInteger(escalado)) {
    return err({ code: 'OUT_OF_RANGE' });
  }
  const residuo = escalado % 1000;
  const centavos = (escalado - residuo) / 1000;
  return money(residuo * 2 >= 1000 ? centavos + 1 : centavos);
}

/** Suma una lista de montos; se detiene si alguna suma sale del rango. */
export function sum(montos: readonly Money[]): Result<Money, MoneyError> {
  let total = ZERO;
  for (const monto of montos) {
    const siguiente = add(total, monto);
    if (!siguiente.ok) {
      return siguiente;
    }
    total = siguiente.value;
  }
  return ok(total);
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

export function isZero(a: Money): boolean {
  return a === 0;
}

/** `$1,234.56`; los negativos llevan el signo antes del `$`: `-$1,234.56` [RN-22]. */
export function formatMoney(a: Money): string {
  const signo = a < 0 ? '-' : '';
  const absolutos = Math.abs(a);
  const pesos = Math.floor(absolutos / 100);
  const centavos = String(absolutos % 100).padStart(2, '0');
  const conComas = String(pesos).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${signo}$${conComas}.${centavos}`;
}

/** Cómo se redondea al peso un precio que se sube o se baja por porcentaje [ADR-0048, D3]. */
export type PesoRounding = 'UP' | 'NEAREST' | 'DOWN';

const PUNTOS_BASE = 10_000;
/** Un peso en centavos por puntos base: la unidad del producto `centavos × (10 000 + puntos base)`. */
const PESO_POR_PUNTOS_BASE = 100 * PUNTOS_BASE;

/** Sube o baja un monto por un porcentaje en puntos base (800 = +8 %, -500 = -5 %) y lo deja en pesos
 *  completos: hacia arriba, al más cercano (la mitad sube) o hacia abajo [RF-M1-15, ADR-0048, D3]. Todo con
 *  enteros: `centavos × (10 000 + puntos base)` y el residuo de dividir entre un peso. */
export function changeByPercentToPeso(
  a: Money,
  puntosBase: number,
  redondeo: PesoRounding,
): Result<Money, MoneyError> {
  if (!Number.isSafeInteger(puntosBase)) {
    return err({ code: 'NOT_INTEGER' });
  }
  const factor = PUNTOS_BASE + puntosBase;
  if (factor < 0) {
    return err({ code: 'NEGATIVE_RESULT' });
  }
  const escalado = a * factor;
  if (!Number.isSafeInteger(escalado)) {
    return err({ code: 'OUT_OF_RANGE' });
  }
  const residuo = escalado % PESO_POR_PUNTOS_BASE;
  const pesos = (escalado - residuo) / PESO_POR_PUNTOS_BASE;
  const sube =
    residuo > 0 &&
    (redondeo === 'UP' || (redondeo === 'NEAREST' && residuo * 2 >= PESO_POR_PUNTOS_BASE));
  return money((sube ? pesos + 1 : pesos) * 100);
}
