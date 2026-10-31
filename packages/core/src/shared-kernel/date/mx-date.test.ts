import { describe, expect, it } from 'vitest';

import { addDays, mexicoDate } from './mx-date';

describe('mexicoDate', () => {
  it('a medio día es la misma fecha', () => {
    expect(mexicoDate(new Date('2026-06-15T18:00:00.000Z'))).toBe('2026-06-15');
  });

  it('en la madrugada de UTC todavía es el día anterior en México', () => {
    expect(mexicoDate(new Date('2026-06-16T03:00:00.000Z'))).toBe('2026-06-15');
  });

  it('el último segundo del año en México sigue siendo ese año; un segundo después, el nuevo', () => {
    expect(mexicoDate(new Date('2027-01-01T05:59:59.000Z'))).toBe('2026-12-31');
    expect(mexicoDate(new Date('2027-01-01T06:00:00.000Z'))).toBe('2027-01-01');
  });
});

describe('addDays', () => {
  it.each([
    ['2026-10-30', 15, '2026-11-14'],
    ['2026-12-25', 15, '2027-01-09'],
    ['2028-02-20', 10, '2028-03-01'],
    ['2026-02-20', 10, '2026-03-02'],
    ['2026-10-30', 0, '2026-10-30'],
    ['2026-03-01', -1, '2026-02-28'],
  ])('%s + %i días = %s', (fecha, dias, esperado) => {
    expect(addDays(fecha, dias)).toBe(esperado);
  });
});
