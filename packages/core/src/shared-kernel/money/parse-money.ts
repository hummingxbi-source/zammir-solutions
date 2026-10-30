import { err, type Result } from '../result';
import { money, type Money, type MoneyError } from './money';

export type MoneyParseErrorCode =
  /** No se reconoce como una cantidad de pesos (letras, vacío, coma como decimal, formato raro). */
  | 'INVALID_FORMAT'
  /** Más de dos decimales: un centavo es lo más fino que existe [RN-05]. */
  | 'TOO_MANY_DECIMALS'
  | MoneyError['code'];

export interface MoneyParseError {
  readonly code: MoneyParseErrorCode;
}

// Signo opcional, `$` opcional, miles con coma opcionales (`1,234` pero no `1,23`) y hasta dos decimales.
const FORMATO = /^(-)?\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/;
const MAXIMO_DE_DIGITOS = 15;

/** Lee pesos tal como se escriben (`280`, `280.5`, `$1,234.56`, `-12.00`) y los convierte a centavos
 *  leyendo los dígitos como texto: nunca pasa por números de coma flotante [RN-05]. Acepta negativos
 *  para que quien valida pueda decir "el precio no puede ser negativo" en lugar de "formato inválido". */
export function parseMoney(texto: string): Result<Money, MoneyParseError> {
  const partes = FORMATO.exec(texto.trim());
  if (partes === null) {
    return err({ code: 'INVALID_FORMAT' });
  }
  const [, signo, enteros = '', decimales = ''] = partes;
  if (decimales.length > 2) {
    return err({ code: 'TOO_MANY_DECIMALS' });
  }
  const digitos = `${enteros.replace(/,/g, '')}${decimales.padEnd(2, '0')}`.replace(
    /^0+(?=\d)/,
    '',
  );
  if (digitos.length > MAXIMO_DE_DIGITOS) {
    return err({ code: 'OUT_OF_RANGE' });
  }
  const centavos = Number(digitos);
  // Con hasta 15 dígitos siempre es un entero seguro: `money` solo confirma el monto.
  return money(signo === '-' ? -centavos : centavos);
}
