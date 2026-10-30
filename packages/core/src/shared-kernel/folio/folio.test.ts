import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { formatFolio, formatTempFolio, folioYear, parseTempFolio } from './folio';

describe('formatFolio', () => {
  it.each([
    ['QUOTE', 2026, 12, 'COT-2026-0012'],
    ['WORK_ORDER', 2026, 1, 'OT-2026-0001'],
    ['COUNTER_SALE', 2027, 345, 'V-2027-0345'],
    ['INVOICE', 2026, 9999, 'F-2026-9999'],
    ['QUOTE', 2026, 10000, 'COT-2026-10000'],
    ['QUOTE', 2000, 1, 'COT-2000-0001'],
    ['QUOTE', 9999, 1, 'COT-9999-0001'],
  ] as const)('%s %i #%i → %s', (tipo, anio, n, esperado) => {
    const r = formatFolio(tipo, anio, n);
    expect(r.ok && r.value).toBe(esperado);
  });

  it.each([1999, 10000, 2026.5, Number.NaN])('el año %s se rechaza', (anio) => {
    const r = formatFolio('QUOTE', anio, 1);
    expect(!r.ok && r.error.code).toBe('INVALID_YEAR');
  });

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2])('el número %s se rechaza', (n) => {
    const r = formatFolio('QUOTE', 2026, n);
    expect(!r.ok && r.error.code).toBe('INVALID_NUMBER');
  });

  it('propiedad: cualquier año y número válidos dan un folio con su prefijo, año y número', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 9999 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        (a, n) => {
          const r = formatFolio('QUOTE', a, n);
          return (
            r.ok &&
            r.value.startsWith(`COT-${String(a)}-`) &&
            Number(r.value.slice(-Math.max(4, String(n).length))) === n
          );
        },
      ),
    );
  });
});

describe('formatTempFolio', () => {
  it.each([
    [1, 4, 'T1-0004'],
    [12, 123, 'T12-0123'],
    [2, 10000, 'T2-10000'],
  ])('serie %i #%i → %s', (serie, n, esperado) => {
    const r = formatTempFolio(serie, n);
    expect(r.ok && r.value).toBe(esperado);
  });

  it.each([0, -3, 1.2])('la serie %s se rechaza', (serie) => {
    const r = formatTempFolio(serie, 1);
    expect(!r.ok && r.error.code).toBe('INVALID_SERIES');
  });

  it.each([0, -1, 2.5])('el número %s se rechaza', (n) => {
    const r = formatTempFolio(1, n);
    expect(!r.ok && r.error.code).toBe('INVALID_NUMBER');
  });
});

describe('folioYear (hora de México)', () => {
  it('el 31 de diciembre a las 23:59:59 en México sigue siendo ese año', () => {
    // 2027-01-01T05:59:59Z = 31 dic 2026 23:59:59 en México (UTC-6, sin horario de verano en 2026).
    expect(folioYear(new Date('2027-01-01T05:59:59.000Z'))).toBe(2026);
  });

  it('un segundo después ya es el año nuevo', () => {
    expect(folioYear(new Date('2027-01-01T06:00:00.000Z'))).toBe(2027);
  });

  it('en UTC ya es enero pero en México todavía no: manda México', () => {
    expect(folioYear(new Date('2026-01-01T03:00:00.000Z'))).toBe(2025);
  });

  it('a mitad de año coincide con el año de la fecha', () => {
    expect(folioYear(new Date('2026-06-15T12:00:00.000Z'))).toBe(2026);
  });
});

describe('parseTempFolio', () => {
  it.each([
    ['T1-0004', { series: 1, n: 4 }],
    [' t12-0123 ', { series: 12, n: 123 }],
  ])('%j se entiende', (texto, esperado) => {
    expect(parseTempFolio(texto)).toEqual(esperado);
  });

  it.each(['COT-2026-0012', 'T-0004', 'T1-', 'T0-0001', 'T1-0000', '', 'T1-0004x'])(
    '%j no es un folio provisional',
    (texto) => {
      expect(parseTempFolio(texto)).toBeNull();
    },
  );

  it('lo que formatTempFolio produce se vuelve a entender', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 1, max: 100_000 }),
        (s, n) => {
          const f = formatTempFolio(s, n);
          return (
            f.ok && JSON.stringify(parseTempFolio(f.value)) === JSON.stringify({ series: s, n })
          );
        },
      ),
    );
  });
});
