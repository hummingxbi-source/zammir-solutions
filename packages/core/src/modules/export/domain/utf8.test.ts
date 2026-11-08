import { describe, expect, it } from 'vitest';

import { encodeUtf8 } from './utf8';

const bytes = (texto: string): number[] => [...encodeUtf8(texto)];

/** Vectores de referencia del estándar UTF-8, escritos a mano (sin `TextEncoder`, que el núcleo no usa). */
describe('encodeUtf8', () => {
  it('el texto vacío son cero bytes', () => {
    expect(bytes('')).toEqual([]);
  });

  it('ASCII: un byte por carácter', () => {
    expect(bytes('Az09 ~')).toEqual([0x41, 0x7a, 0x30, 0x39, 0x20, 0x7e]);
    expect(bytes('\u0000')).toEqual([0x00]);
    expect(bytes('\u007f')).toEqual([0x7f]);
  });

  it('dos bytes de U+0080 a U+07FF', () => {
    expect(bytes('\u0080')).toEqual([0xc2, 0x80]);
    expect(bytes('ñ')).toEqual([0xc3, 0xb1]);
    expect(bytes('é')).toEqual([0xc3, 0xa9]);
    expect(bytes('߿')).toEqual([0xdf, 0xbf]);
  });

  it('tres bytes de U+0800 a U+FFFF', () => {
    expect(bytes('ࠀ')).toEqual([0xe0, 0xa0, 0x80]);
    expect(bytes('€')).toEqual([0xe2, 0x82, 0xac]);
    expect(bytes('日')).toEqual([0xe6, 0x97, 0xa5]);
    expect(bytes('퟿')).toEqual([0xed, 0x9f, 0xbf]);
    expect(bytes('')).toEqual([0xee, 0x80, 0x80]);
    expect(bytes('￿')).toEqual([0xef, 0xbf, 0xbf]);
  });

  it('cuatro bytes desde U+10000 (emojis y otros)', () => {
    expect(bytes('\u{10000}')).toEqual([0xf0, 0x90, 0x80, 0x80]);
    expect(bytes('😀')).toEqual([0xf0, 0x9f, 0x98, 0x80]);
    expect(bytes('\u{10ffff}')).toEqual([0xf4, 0x8f, 0xbf, 0xbf]);
  });

  it('un carácter suelto sin pareja (alto o bajo) se escribe como U+FFFD', () => {
    expect(bytes('\ud800')).toEqual([0xef, 0xbf, 0xbd]);
    expect(bytes('\udbff')).toEqual([0xef, 0xbf, 0xbd]);
    expect(bytes('\udc00')).toEqual([0xef, 0xbf, 0xbd]);
    expect(bytes('\udfff')).toEqual([0xef, 0xbf, 0xbd]);
    expect(bytes('a\ud800b')).toEqual([0x61, 0xef, 0xbf, 0xbd, 0x62]);
  });

  it('una pareja válida no se rompe aunque tenga texto alrededor', () => {
    expect(bytes('a😀b')).toEqual([0x61, 0xf0, 0x9f, 0x98, 0x80, 0x62]);
  });

  it('mezcla de largos', () => {
    expect(bytes('Peña €')).toEqual([0x50, 0x65, 0xc3, 0xb1, 0x61, 0x20, 0xe2, 0x82, 0xac]);
  });
});
