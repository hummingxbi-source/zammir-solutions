import { describe, expect, it } from 'vitest';

import { seededRandom } from './random';

describe('seededRandom', () => {
  it('la misma semilla da la misma secuencia', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect(Array.from({ length: 10 }, () => a.nextInt(1000))).toEqual(
      Array.from({ length: 10 }, () => b.nextInt(1000)),
    );
  });

  it('semillas distintas dan secuencias distintas', () => {
    const a = seededRandom(1);
    const b = seededRandom(2);
    expect(Array.from({ length: 5 }, () => a.nextInt(1_000_000))).not.toEqual(
      Array.from({ length: 5 }, () => b.nextInt(1_000_000)),
    );
  });

  it('nextInt se queda dentro de [0, max) y nextFraction dentro de [0, 1)', () => {
    const r = seededRandom(99);
    for (let i = 0; i < 2000; i += 1) {
      const n = r.nextInt(7);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
      const f = r.nextFraction();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('con max 1 siempre da 0', () => {
    const r = seededRandom(5);
    expect(Array.from({ length: 20 }, () => r.nextInt(1)).every((n) => n === 0)).toBe(true);
  });
});
