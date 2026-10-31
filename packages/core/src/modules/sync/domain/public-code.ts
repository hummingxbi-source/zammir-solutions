import type { Random } from '../../../shared-kernel/random';

/** Alfabeto del código público: sin 0, O, 1, I ni L, para que se pueda dictar y leer sin confusión. */
export const PUBLIC_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PUBLIC_CODE_LENGTH = 8;

/** Código público de un documento [RN-16, ADR-0023]: lo genera la tablet junto con el documento y el
 *  servidor lo reconoce después. Identifica el comprobante impreso sin conexión. */
export function generatePublicCode(random: Random): string {
  let codigo = '';
  for (let i = 0; i < PUBLIC_CODE_LENGTH; i += 1) {
    codigo += PUBLIC_CODE_ALPHABET.charAt(random.nextInt(PUBLIC_CODE_ALPHABET.length));
  }
  return codigo;
}

/** ¿Tiene la forma de un código público? (el servidor y la tablet usan la misma comprobación). */
export function isPublicCode(texto: string): boolean {
  return /^[A-HJKMNP-Z2-9]{8}$/.test(texto);
}
