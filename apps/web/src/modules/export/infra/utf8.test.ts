import fc from 'fast-check';
import { encodeUtf8 } from '@zammir/core';
import { describe, expect, it } from 'vitest';

// El núcleo no usa `TextEncoder` (no depende del navegador ni de Node); aquí, donde sí existe, se comprueba que
// su codificación UTF-8 es idéntica a la del navegador.
describe('codificación UTF-8 del núcleo', () => {
  it.each(['', 'a', 'Peña', 'ñandú', '€', '日本語', '😀', 'a😀b', '\u0000\u007f\u0080߿ࠀ￿'])(
    'coincide con TextEncoder: %j',
    (texto) => {
      expect([...encodeUtf8(texto)]).toEqual([...new TextEncoder().encode(texto)]);
    },
  );

  it('coincide con TextEncoder para cualquier texto, incluidos los caracteres rotos', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 40 }), (texto) => {
        expect([...encodeUtf8(texto)]).toEqual([...new TextEncoder().encode(texto)]);
      }),
    );
  });

  it('un carácter suelto sin pareja se escribe como U+FFFD', () => {
    expect([...encodeUtf8('\ud800')]).toEqual([0xef, 0xbf, 0xbd]);
  });
});
