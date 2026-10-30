import { pinHasherContract } from '@zammir/core/testing';
import { describe, expect, it } from 'vitest';

import { webCryptoPinHasher } from './web-crypto-pin-hasher';

// La misma batería que pasa el adaptador falso del núcleo.
pinHasherContract('WebCrypto (PBKDF2-HMAC-SHA256)', () => webCryptoPinHasher, 1000);

function hexABase64(hex: string): string {
  const pares = hex.match(/../g) ?? [];
  return btoa(String.fromCharCode(...pares.map((par) => parseInt(par, 16))));
}

describe('webCryptoPinHasher', () => {
  it('coincide con un vector público conocido de PBKDF2-HMAC-SHA256', async () => {
    // password "password", sal "salt", 1 vuelta, 32 bytes (vector de referencia ampliamente publicado).
    const verificador = {
      salt: btoa('salt'),
      iterations: 1,
      hash: hexABase64('120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b'),
      version: 1,
    };
    expect(await webCryptoPinHasher.verify('password', verificador)).toBe(true);
    expect(await webCryptoPinHasher.verify('Password', verificador)).toBe(false);
  });

  it('un verificador con vueltas no válidas no verifica', async () => {
    const bueno = await webCryptoPinHasher.hash('482915', 1000);
    expect(await webCryptoPinHasher.verify('482915', { ...bueno, iterations: 0 })).toBe(false);
    expect(await webCryptoPinHasher.verify('482915', { ...bueno, iterations: -5 })).toBe(false);
    expect(await webCryptoPinHasher.verify('482915', { ...bueno, iterations: 1.5 })).toBe(false);
  });

  it('un PIN con caracteres raros no rompe la derivación', async () => {
    const v = await webCryptoPinHasher.hash('48 29', 1000);
    expect(await webCryptoPinHasher.verify('48 29', v)).toBe(true);
    expect(await webCryptoPinHasher.verify('4829', v)).toBe(false);
  });
});
