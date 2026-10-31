import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { seededRandom } from '../../../shared-kernel/random';
import { generatePublicCode, isPublicCode, PUBLIC_CODE_ALPHABET } from './public-code';

describe('generatePublicCode', () => {
  it('tiene 8 caracteres del alfabeto sin ambiguos', () => {
    const r = seededRandom(1);
    for (let i = 0; i < 500; i += 1) {
      const codigo = generatePublicCode(r);
      expect(codigo).toHaveLength(8);
      expect(Array.from(codigo).every((c) => PUBLIC_CODE_ALPHABET.includes(c))).toBe(true);
      expect(codigo).not.toMatch(/[01OIL]/);
      expect(isPublicCode(codigo)).toBe(true);
    }
  });

  it('con la misma semilla da el mismo código', () => {
    expect(generatePublicCode(seededRandom(42))).toBe(generatePublicCode(seededRandom(42)));
  });

  it('no se repite en 5000 códigos', () => {
    const r = seededRandom(2026);
    const vistos = new Set(Array.from({ length: 5000 }, () => generatePublicCode(r)));
    expect(vistos.size).toBe(5000);
  });

  it('el alfabeto tiene 31 caracteres distintos', () => {
    expect(new Set(PUBLIC_CODE_ALPHABET).size).toBe(31);
  });
});

describe('isPublicCode', () => {
  it.each(['ABCDEFGH', 'A2B3C4D5', 'ZZZZ9999'])('%s es un código', (c) => {
    expect(isPublicCode(c)).toBe(true);
  });

  it.each([
    'abcdefgh',
    'ABCDEFG',
    'ABCDEFGHJ',
    'ABCD0FGH',
    'ABCD1FGH',
    'ABCDOFGH',
    'ABCDIFGH',
    'ABCDLFGH',
    '',
  ])('%j no es un código', (c) => {
    expect(isPublicCode(c)).toBe(false);
  });

  it('propiedad: todo texto de otro largo se rechaza', () => {
    fc.assert(fc.property(fc.string({ maxLength: 20 }), (t) => t.length === 8 || !isPublicCode(t)));
  });
});
