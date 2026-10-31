import type { Random } from '@zammir/core';

/** Azar del navegador (`crypto.getRandomValues`), para códigos públicos y la variación de los reintentos.
 *  `nextInt` evita el sesgo de módulo descartando los valores que sobran. */
export const cryptoRandom: Random = {
  nextInt(max) {
    const limite = Math.floor(4294967296 / max) * max;
    const buffer = new Uint32Array(1);
    for (;;) {
      crypto.getRandomValues(buffer);
      const valor = buffer[0] ?? 0;
      if (valor < limite) {
        return valor % max;
      }
    }
  },
  nextFraction() {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return (buffer[0] ?? 0) / 4294967296;
  },
};
