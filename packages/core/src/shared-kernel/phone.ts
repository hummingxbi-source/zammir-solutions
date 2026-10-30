import { err, ok, type Result } from './result';

export type PhoneErrorCode = 'PHONE_MUST_HAVE_10_DIGITS';

export interface PhoneError {
  readonly code: PhoneErrorCode;
}

/** Quita lo que se escribe para que se lea mejor: espacios, guiones, puntos y paréntesis. */
const SEPARADORES = /[\s\-().]/g;

/** Teléfono mexicano de 10 dígitos [RN-22]. Acepta espacios, guiones, paréntesis y la clave de país
 *  (`+52 55 1234 5678`, `52 55 1234 5678`), y siempre devuelve solo los 10 dígitos, para poder
 *  comparar el mismo número escrito de distintas formas (aviso de duplicados, RF-M5-04). */
export function normalizePhone(texto: string): Result<string, PhoneError> {
  const sinSeparadores = texto.replace(SEPARADORES, '');
  const sinPais = /^(\+52|52)(\d{10})$/.exec(sinSeparadores)?.[2] ?? sinSeparadores;
  return /^\d{10}$/.test(sinPais) ? ok(sinPais) : err({ code: 'PHONE_MUST_HAVE_10_DIGITS' });
}
