import { err, ok, type Result } from '../result';

declare const marcaMm: unique symbol;
declare const marcaMm2: unique symbol;

/** Longitud en milímetros enteros: así se guardan las medidas, sin decimales [RN-04]. */
export type Millimeters = number & { readonly [marcaMm]: 'Millimeters' };
/** Área en milímetros cuadrados enteros. */
export type SquareMillimeters = number & { readonly [marcaMm2]: 'SquareMillimeters' };

export type LengthUnit = 'cm' | 'm';

export type LengthErrorCode =
  /** El texto no es un número (letras, vacío, varios puntos…). */
  | 'INVALID_FORMAT'
  /** Cero o negativa. */
  | 'NOT_POSITIVE'
  /** Más grande que el límite configurado (o que un entero seguro). */
  | 'TOO_LARGE'
  /** Trae más decimales de los que caben en un milímetro (más de 1 en cm, más de 3 en m). */
  | 'SUB_MILLIMETER';

export interface LengthError {
  readonly code: LengthErrorCode;
}

/** Decimales que caben en un milímetro por unidad: 1 cm = 10 mm, 1 m = 1 000 mm. */
const DECIMALES_POR_UNIDAD: Record<LengthUnit, number> = { cm: 1, m: 3 };
const MAXIMO_DE_DIGITOS = 15;
const FORMATO = /^(-)?(\d+)(?:[.,](\d+))?$/;

/** Convierte lo que se teclea (`125.5` cm, `1.255` m) a milímetros enteros leyendo los dígitos
 *  como texto: nunca pasa por números de coma flotante [RN-04]. El punto y la coma valen como decimal.
 *  `maxMm` es el límite configurable de una medida. */
export function parseLength(
  texto: string,
  unidad: LengthUnit,
  maxMm: number,
): Result<Millimeters, LengthError> {
  const partes = FORMATO.exec(texto.trim());
  if (partes === null) {
    return err({ code: 'INVALID_FORMAT' });
  }
  const [, signo, enteros = '', fraccion = ''] = partes;
  const decimales = DECIMALES_POR_UNIDAD[unidad];

  if (fraccion.length > decimales) {
    return err({ code: 'SUB_MILLIMETER' });
  }
  const digitos = `${enteros}${fraccion.padEnd(decimales, '0')}`.replace(/^0+(?=\d)/, '');
  if (digitos.length > MAXIMO_DE_DIGITOS) {
    return err({ code: 'TOO_LARGE' });
  }
  const milimetros = Number(digitos);
  if (milimetros === 0 || signo === '-') {
    return err({ code: 'NOT_POSITIVE' });
  }
  if (milimetros > maxMm) {
    return err({ code: 'TOO_LARGE' });
  }
  // Única aserción de tipo del módulo: la marca solo existe al compilar.
  return ok(milimetros as Millimeters);
}

/** Área de una pieza en mm² enteros. */
export function areaMm2(
  ancho: Millimeters,
  alto: Millimeters,
): Result<SquareMillimeters, LengthError> {
  const area = ancho * alto;
  if (!Number.isSafeInteger(area)) {
    return err({ code: 'TOO_LARGE' });
  }
  return ok(area as SquareMillimeters);
}
