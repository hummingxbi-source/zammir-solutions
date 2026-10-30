import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { formatMoney, money } from './money';
import { parseMoney } from './parse-money';

function centavos(texto: string): number | string {
  const r = parseMoney(texto);
  return r.ok ? r.value : r.error.code;
}

describe('parseMoney', () => {
  it.each([
    ['280', 28_000],
    ['280.5', 28_050],
    ['280.50', 28_050],
    ['280.05', 28_005],
    ['0', 0],
    ['0.05', 5],
    ['0.5', 50],
    ['$1,234.56', 123_456],
    ['1,234', 123_400],
    ['1,000,000.00', 100_000_000],
    ['1234.56', 123_456],
    ['$280', 28_000],
    ['$ 280.00', 28_000],
    ['  280.00  ', 28_000],
    ['007', 700],
    ['00.10', 10],
    ['-12.00', -1200],
    ['-$12.50', -1250],
    ['-0', 0],
    ['9999999999999.99', 999_999_999_999_999],
  ])('%j → %i centavos', (texto, esperado) => {
    expect(centavos(texto)).toBe(esperado);
  });

  it('-0 se convierte en 0 y no en -0', () => {
    const r = parseMoney('-0.00');
    expect(r.ok && Object.is(r.value, 0)).toBe(true);
  });

  it.each([
    '',
    '   ',
    'abc',
    '12abc',
    '1,23',
    '12,34.5',
    '1,2345',
    ',500',
    '.5',
    '5.',
    '1.2.3',
    '1e3',
    '$$5',
    '--5',
    '$-5',
    '5 pesos',
    '1 000',
    '+5',
  ])('rechaza %j por formato', (texto) => {
    expect(centavos(texto)).toBe('INVALID_FORMAT');
  });

  it.each(['1.234', '0.001', '280.505', '5.000'])('rechaza %j: más de dos decimales', (texto) => {
    expect(centavos(texto)).toBe('TOO_MANY_DECIMALS');
  });

  it.each(['10000000000000.00', '99999999999999999', '123456789012345678.90'])(
    'rechaza %j: no cabe',
    (texto) => {
      expect(centavos(texto)).toBe('OUT_OF_RANGE');
    },
  );

  it('propiedad: lo que formatMoney escribe, parseMoney lo lee de vuelta con los mismos centavos', () => {
    fc.assert(
      fc.property(fc.integer({ min: -999_999_999_999, max: 999_999_999_999 }), (c) => {
        const monto = money(c);
        if (!monto.ok) throw new Error('centavos');
        expect(centavos(formatMoney(monto.value))).toBe(c);
      }),
    );
  });

  it('propiedad: pesos y centavos escritos con dos decimales dan exactamente pesos×100+centavos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99_999_999_999 }),
        fc.integer({ min: 0, max: 99 }),
        (pesos, cents) => {
          const texto = `${String(pesos)}.${String(cents).padStart(2, '0')}`;
          expect(centavos(texto)).toBe(pesos * 100 + cents);
        },
      ),
    );
  });
});
