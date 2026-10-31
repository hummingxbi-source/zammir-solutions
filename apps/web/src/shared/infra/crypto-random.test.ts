import { generatePublicCode, isPublicCode } from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { cryptoRandom } from './crypto-random';

describe('cryptoRandom', () => {
  it('nextInt se queda en [0, max) y recorre todos los valores', () => {
    const vistos = new Set<number>();
    for (let i = 0; i < 2000; i += 1) {
      const n = cryptoRandom.nextInt(6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
      vistos.add(n);
    }
    expect(vistos.size).toBe(6);
  });

  it('nextFraction está en [0, 1)', () => {
    for (let i = 0; i < 500; i += 1) {
      const f = cryptoRandom.nextFraction();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('con él se generan códigos públicos válidos y distintos', () => {
    const codigos = new Set(Array.from({ length: 200 }, () => generatePublicCode(cryptoRandom)));
    expect(codigos.size).toBe(200);
    expect([...codigos].every((c) => isPublicCode(c))).toBe(true);
  });
});
