import { describe, expect, it } from 'vitest';

import { addDays, isCalendarDate, mexicoDate } from './mx-date';

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

describe('isCalendarDate', () => {
  it.each(['2026-01-01', '2026-12-31', '2028-02-29', '2000-02-29'])('%s es una fecha real', (f) => {
    expect(isCalendarDate(f)).toBe(true);
  });

  it.each(['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31', '1900-02-29'])(
    '%s tiene la forma, pero no existe',
    (f) => {
      expect(isCalendarDate(f)).toBe(false);
    },
  );

  it.each(['', '2026-1-01', '2026/01/01', '01-01-2026', ' 2026-01-01', '2026-01-01T00:00'])(
    '"%s" no tiene la forma AAAA-MM-DD',
    (f) => {
      expect(isCalendarDate(f)).toBe(false);
    },
  );
});
