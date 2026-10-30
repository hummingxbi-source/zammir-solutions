import { sameTextConstantTime, type PinHasher, type PinVerifier } from '@zammir/core';

const BYTES_DE_SAL = 16;
const BITS_DE_HASH = 256;
const VERSION_DEL_VERIFICADOR = 1;

function aBase64(bytes: Uint8Array): string {
  let texto = '';
  for (const byte of bytes) {
    texto += String.fromCharCode(byte);
  }
  return btoa(texto);
}

function deBase64(texto: string): Uint8Array<ArrayBuffer> {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}

async function derivar(
  pin: string,
  sal: Uint8Array<ArrayBuffer>,
  vueltas: number,
): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: vueltas },
    material,
    BITS_DE_HASH,
  );
  return aBase64(new Uint8Array(bits));
}

/** PinHasher real: PBKDF2-HMAC-SHA256 con WebCrypto, sal propia de 16 bytes y comparación en tiempo
 *  constante [ADR-0013]. Corre igual en la computadora del administrador y en la tablet. */
export const webCryptoPinHasher: PinHasher = {
  async hash(pin, iterations) {
    const sal = crypto.getRandomValues(new Uint8Array(BYTES_DE_SAL));
    const verificador: PinVerifier = {
      salt: aBase64(sal),
      iterations,
      hash: await derivar(pin, sal, iterations),
      version: VERSION_DEL_VERIFICADOR,
    };
    return verificador;
  },

  async verify(pin, verificador) {
    if (!Number.isInteger(verificador.iterations) || verificador.iterations <= 0) {
      return false;
    }
    const calculado = await derivar(pin, deBase64(verificador.salt), verificador.iterations);
    return sameTextConstantTime(calculado, verificador.hash);
  },
};
