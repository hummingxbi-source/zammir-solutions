import { describe, expect, it } from 'vitest';

import { createCounterSalePayloadSchema, issueQuotePayloadSchema } from './operation';

const linea = (cambios: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Felpa',
  chargeUnit: 'PIECE',
  unitPriceCents: 5_800,
  ruleId: 'PIECE',
  quantity: 2,
  lineTotalCents: 11_600,
  baseCents: 10_000,
  taxCents: 1_600,
  detail: '2 rollos × $58.00 = $116.00',
  ...cambios,
});

const venta = (l: Record<string, unknown>) => ({
  id: '22222222-2222-4222-8222-222222222222',
  tempFolio: 'T1-0001',
  publicCode: 'DDDDDDDD',
  issuedAt: '2026-11-27T18:00:00.000Z',
  subtotalCents: 10_000,
  taxCents: 1_600,
  totalCents: 11_600,
  lines: [l],
  payment: {
    groupId: '33333333-3333-4333-8333-333333333333',
    rows: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        method: 'CASH',
        amountCents: 11_600,
        cashReceivedCents: 11_600,
      },
    ],
  },
});

describe('unidad de venta en el envío [RF-M1-11]', () => {
  it('la línea la puede traer, y una tablet de antes que no la manda sigue siendo válida', () => {
    const con = createCounterSalePayloadSchema.safeParse(venta(linea({ saleUnitName: 'rollo' })));
    expect(con.success && con.data.lines[0]?.saleUnitName).toBe('rollo');
    const sin = createCounterSalePayloadSchema.safeParse(venta(linea()));
    expect(sin.success).toBe(true);
    expect(sin.success && 'saleUnitName' in (sin.data.lines[0] ?? {})).toBe(false);
  });

  it('vacía o de más de 20 caracteres no es válida', () => {
    expect(
      createCounterSalePayloadSchema.safeParse(venta(linea({ saleUnitName: ' ' }))).success,
    ).toBe(false);
    expect(
      createCounterSalePayloadSchema.safeParse(venta(linea({ saleUnitName: 'a'.repeat(21) })))
        .success,
    ).toBe(false);
    expect(
      createCounterSalePayloadSchema.safeParse(venta(linea({ saleUnitName: 'a'.repeat(20) })))
        .success,
    ).toBe(true);
  });

  it('la cotización usa el mismo renglón', () => {
    const forma = issueQuotePayloadSchema.shape.lines.element;
    expect(forma.safeParse(linea({ saleUnitName: 'par' })).success).toBe(true);
    expect(forma.safeParse(linea({ saleUnitName: 'a'.repeat(21) })).success).toBe(false);
  });
});
