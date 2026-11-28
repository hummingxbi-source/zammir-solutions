import { err, ok, type Result } from '../result';

/** Cuántos decimales puede llevar una cantidad: 1.5 kg, 2.5 h, 0.333 kg [ADR-0048, D2]. */
export const MAX_QUANTITY_DECIMALS = 3;

const MILESIMAS = 1000;
/** Tope de una cantidad: 9 cifras enteras, lo mismo que se puede escribir. Así las milésimas siempre son un
 *  entero exacto y una suma de dos nunca desborda. */
const MAXIMA = 999_999_999.999;

/** La cantidad en milésimas enteras (1.5 → 1500), o `null` si no es positiva, pasa de 3 decimales o no cabe.
 *  Es la única puerta entre la cantidad que se ve y el entero con que se calcula el dinero [RN-05, ADR-0048].
 *  Tolera el error de punto flotante de un número escrito con 3 decimales (1.255 × 1000 = 1254.999…). */
export function quantityToMilli(cantidad: number): number | null {
  if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > MAXIMA) {
    return null;
  }
  const escalada = cantidad * MILESIMAS;
  const milesimas = Math.round(escalada);
  if (Math.abs(escalada - milesimas) > 1e-6) {
    return null;
  }
  return milesimas;
}

/** La cantidad que corresponde a unas milésimas enteras, sin arrastrar error de punto flotante (1500 → 1.5). */
export function milliToQuantity(milesimas: number): number {
  return Number((milesimas / MILESIMAS).toFixed(MAX_QUANTITY_DECIMALS));
}

/** ¿Es una cantidad válida: positiva y con hasta 3 decimales? */
export function isValidQuantity(cantidad: number): boolean {
  return quantityToMilli(cantidad) !== null;
}

/** ¿Es una cantidad entera de 1 en adelante (piezas, visitas)? */
export function isWholeQuantity(cantidad: number): boolean {
  return Number.isSafeInteger(cantidad) && cantidad >= 1;
}

/** Suma dos cantidades en milésimas, para que 0.1 + 0.2 dé 0.3 y no 0.30000000000000004. `null` si alguna no
 *  es válida. */
export function addQuantities(a: number, b: number): number | null {
  const ma = quantityToMilli(a);
  const mb = quantityToMilli(b);
  if (ma === null || mb === null) {
    return null;
  }
  // La suma puede pasar del tope de una cantidad; quien la use la revisa como cualquier otra.
  return milliToQuantity(ma + mb);
}

export interface QuantityError {
  readonly code: 'QUANTITY_INVALID';
}

/** Lee una cantidad escrita: "2", "1.5", "0.333". Con `conDecimales` en falso solo acepta enteros de 1 en
 *  adelante. Con texto, sin pasar por `Number` de algo como "1e3" o "0x10". */
export function parseQuantity(texto: string, conDecimales: boolean): Result<number, QuantityError> {
  const limpio = texto.trim();
  const patron = conDecimales ? /^\d{1,9}(?:\.\d{1,3})?$/ : /^\d{1,9}$/;
  if (!patron.test(limpio)) {
    return err({ code: 'QUANTITY_INVALID' });
  }
  const cantidad = Number(limpio);
  return quantityToMilli(cantidad) === null ? err({ code: 'QUANTITY_INVALID' }) : ok(cantidad);
}
