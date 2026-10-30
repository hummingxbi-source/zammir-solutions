import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { lockDurationSeconds, type LockoutPolicy } from './pin-lockout';

const politica: LockoutPolicy = { maxAttempts: 5, baseSeconds: 30, capSeconds: 900 };

describe('lockDurationSeconds', () => {
  it.each([0, 1, 2, 3, 4])('con %i intentos fallidos todavía no bloquea', (fallos) => {
    expect(lockDurationSeconds(fallos, politica)).toBe(0);
  });

  it.each([
    [5, 30],
    [6, 60],
    [7, 120],
    [8, 240],
    [9, 480],
    [10, 900],
    [11, 900],
    [50, 900],
    [100_000, 900],
  ])(
    'con %i intentos fallidos bloquea %i segundos (se duplica hasta el tope)',
    (fallos, segundos) => {
      expect(lockDurationSeconds(fallos, politica)).toBe(segundos);
    },
  );

  it('usa los valores de la configuración, no unos fijos', () => {
    const otra: LockoutPolicy = { maxAttempts: 3, baseSeconds: 10, capSeconds: 40 };
    expect([2, 3, 4, 5, 6].map((f) => lockDurationSeconds(f, otra))).toEqual([0, 10, 20, 40, 40]);
  });

  it('propiedad: nunca baja al fallar más y nunca pasa del tope', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), (fallos) => {
        const ahora = lockDurationSeconds(fallos, politica);
        const despues = lockDurationSeconds(fallos + 1, politica);
        expect(despues).toBeGreaterThanOrEqual(ahora);
        expect(despues).toBeLessThanOrEqual(politica.capSeconds);
      }),
    );
  });
});
