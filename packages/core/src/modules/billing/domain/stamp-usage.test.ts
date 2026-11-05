import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { evaluateStampUsage } from './stamp-usage';

const uso = (used: number, limit: number | null, warningPercent = 80) =>
  evaluateStampUsage({ used, limit, warningPercent });

describe('timbres del año [RF-M10-20]', () => {
  it('con de sobra no hay aviso', () => {
    expect(uso(10, 100)).toEqual({
      used: 10,
      limit: 100,
      remaining: 90,
      percentBps: 1_000,
      level: 'OK',
    });
  });

  it('el aviso sale justo al llegar al 80 % y no antes', () => {
    expect(uso(79, 100).level).toBe('OK');
    expect(uso(80, 100).level).toBe('WARNING');
    expect(uso(99, 100).level).toBe('WARNING');
  });

  it('con un límite que no es múltiplo de 100 también cuenta bien el 80 %', () => {
    // 80 % de 25 son 20 timbres.
    expect(uso(19, 25).level).toBe('OK');
    expect(uso(20, 25).level).toBe('WARNING');
  });

  it('el porcentaje de aviso es configurable', () => {
    expect(uso(50, 100, 50).level).toBe('WARNING');
    expect(uso(49, 100, 50).level).toBe('OK');
  });

  it('al llegar al límite o pasarse se dice aparte y no quedan timbres', () => {
    expect(uso(100, 100)).toMatchObject({ level: 'REACHED', remaining: 0, percentBps: 10_000 });
    expect(uso(130, 100)).toMatchObject({ level: 'REACHED', remaining: 0, percentBps: 13_000 });
  });

  it('sin límite definido (PD-26) no inventa uno y no avisa', () => {
    expect(uso(500, null)).toEqual({
      used: 500,
      limit: null,
      remaining: null,
      percentBps: null,
      level: 'NO_LIMIT',
    });
    expect(uso(5, 0).level).toBe('NO_LIMIT');
  });

  it('un uso negativo o con decimales se toma como un entero no negativo', () => {
    expect(uso(-3, 100).used).toBe(0);
    expect(uso(7.9, 100).used).toBe(7);
  });

  it('el nivel solo sube al usar más timbres', () => {
    const orden = ['OK', 'WARNING', 'REACHED'];
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 0, max: 600 }),
        fc.integer({ min: 0, max: 600 }),
        (limite, a, b) => {
          const [menor, mayor] = a <= b ? [a, b] : [b, a];
          expect(orden.indexOf(uso(menor, limite).level)).toBeLessThanOrEqual(
            orden.indexOf(uso(mayor, limite).level),
          );
        },
      ),
    );
  });
});
