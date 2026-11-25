import { describe, expect, it } from 'vitest';

import type { CashShift, CashShiftSummary } from '../../cash/domain/cash-shift';
import { buildShiftCutSheet, type ShiftCutLabels } from './shift-cut-sheet';

const etiquetas: ShiftCutLabels = {
  title: 'Corte de caja',
  subtitle: 'Turno de {name}',
  opened: 'Abrió: {date}',
  closed: 'Cerró: {date}',
  collections: 'Cobros del turno',
  openingFloat: 'Fondo inicial',
  counterSales: 'Ventas de mostrador',
  orderPayments: 'Anticipos y saldos de órdenes',
  cashCollected: 'Efectivo cobrado',
  transferCollected: 'Transferencias',
  totalCollected: 'Total cobrado',
  cash: 'Efectivo',
  expectedCash: 'Efectivo esperado',
  countedCash: 'Efectivo contado',
  difference: 'Diferencia',
  exact: 'Exacto',
  over: 'Sobrante',
  short: 'Faltante',
  cancelled: 'Canceladas',
  cancelledSales: 'Ventas canceladas ({count})',
  cancelledNote: 'Los cobros de ventas canceladas no cuentan en el corte.',
  refunds: 'Devoluciones ({count})',
  refundedCash: 'Efectivo devuelto',
  refundedTransfer: 'Devuelto por transferencia',
  differenceNote: 'Explicación',
  page: 'Página {n} de {total}',
};

const turno = (cambios: Partial<CashShift> = {}): CashShift => ({
  id: 't1',
  cashierId: 'u1' as CashShift['cashierId'],
  deviceId: 'd1',
  status: 'CLOSED',
  openedAt: '2026-10-31T15:00:00.000Z',
  openingFloatCents: 50_000,
  closedAt: '2026-11-01T00:30:00.000Z',
  countedCashCents: 170_000,
  expectedCashCents: 170_000,
  differenceCents: 0,
  differenceNote: null,
  pendingAtClose: 0,
  reopenings: [],
  syncStatus: 'SENT',
  reviewReason: null,
  updatedAt: '2026-11-01T00:30:00.000Z',
  ...cambios,
});

const resumen = (cambios: Partial<CashShiftSummary> = {}): CashShiftSummary => ({
  openingFloatCents: 50_000,
  cashCents: 120_000,
  transferCents: 30_000,
  salesCents: 100_000,
  orderPaymentsCents: 50_000,
  expectedCashCents: 170_000,
  refundedCashCents: 0,
  refundedTransferCents: 0,
  refundCount: 0,
  cancelledSalesCents: 0,
  cancelledSalesCount: 0,
  differenceCents: 0,
  ...cambios,
});

function armar(t: CashShift, s: CashShiftSummary) {
  return buildShiftCutSheet({
    shift: t,
    summary: s,
    cashierName: 'Beto',
    business: { name: 'ZAMMIR (datos de prueba)', phone: null, address: null },
    labels: etiquetas,
  });
}

function hoja(t: CashShift, s: CashShiftSummary) {
  const r = armar(t, s);
  if (!r.ok) {
    throw new Error('no se armó la hoja');
  }
  return r.sheet;
}

const filas = (t: CashShift, s: CashShiftSummary) =>
  hoja(t, s).sections.flatMap((x) => x.rows.map((r) => `${r.label}: ${r.value}`));

describe('hoja del corte de caja', () => {
  it('trae cajero, apertura y cierre en hora de México', () => {
    const h = hoja(turno(), resumen());
    expect(h.title).toBe('Corte de caja');
    expect(h.subtitle).toBe('Turno de Beto');
    expect(h.meta).toEqual(['Abrió: 31 oct 2026, 09:00', 'Cerró: 31 oct 2026, 18:30']);
  });

  it('los importes son los del resumen, al centavo', () => {
    expect(filas(turno(), resumen())).toEqual([
      'Fondo inicial: $500.00',
      'Ventas de mostrador: $1,000.00',
      'Anticipos y saldos de órdenes: $500.00',
      'Efectivo cobrado: $1,200.00',
      'Transferencias: $300.00',
      'Total cobrado: $1,500.00',
      'Efectivo esperado: $1,700.00',
      'Efectivo contado: $1,700.00',
      'Diferencia: Exacto',
    ]);
  });

  it('dice Sobrante o Faltante con el monto', () => {
    expect(
      filas(
        turno({ countedCashCents: 170_500, differenceCents: 500 }),
        resumen({ differenceCents: 500 }),
      ),
    ).toContain('Diferencia: Sobrante $5.00');
    expect(
      filas(
        turno({ countedCashCents: 169_000, differenceCents: -1_000 }),
        resumen({ differenceCents: -1_000 }),
      ),
    ).toContain('Diferencia: Faltante $10.00');
  });

  it('muestra la explicación de la diferencia justo después de ella [RF-M4-09]', () => {
    const conNota = filas(
      turno({
        countedCashCents: 169_000,
        differenceCents: -1_000,
        differenceNote: 'Di mal un cambio',
      }),
      resumen({ differenceCents: -1_000 }),
    );
    expect(conNota.slice(-2)).toEqual([
      'Diferencia: Faltante $10.00',
      'Explicación: Di mal un cambio',
    ]);
    expect(filas(turno(), resumen()).some((f) => f.startsWith('Explicación'))).toBe(false);
    // Un turno guardado antes del cambio no trae el campo.
    const viejo = Object.fromEntries(
      Object.entries(turno()).filter(([campo]) => campo !== 'differenceNote'),
    ) as unknown as CashShift;
    expect(filas(viejo, resumen()).some((f) => f.startsWith('Explicación'))).toBe(false);
  });

  it('las devoluciones del turno restan antes de lo esperado y van en su sección [RF-M4-10]', () => {
    const h = hoja(
      turno(),
      resumen({
        refundedCashCents: 11_600,
        refundedTransferCents: 5_000,
        refundCount: 2,
        expectedCashCents: 158_400,
      }),
    );
    const efectivo = h.sections.find((x) => x.title === 'Efectivo')?.rows.map((r) => r.label);
    expect(efectivo?.slice(0, 2)).toEqual(['Efectivo devuelto', 'Efectivo esperado']);
    const devoluciones = h.sections.find((x) => x.title === 'Devoluciones (2)');
    expect(devoluciones?.rows.map((r) => `${r.label}: ${r.value}`)).toEqual([
      'Efectivo devuelto: $116.00',
      'Devuelto por transferencia: $50.00',
    ]);
    expect(
      hoja(turno(), resumen()).sections.some((x) => (x.title ?? '').startsWith('Devoluciones')),
    ).toBe(false);
  });

  it('resalta el total, lo esperado y la diferencia', () => {
    const fuertes = hoja(turno(), resumen())
      .sections.flatMap((x) => x.rows)
      .filter((r) => r.strong === true)
      .map((r) => r.label);
    expect(fuertes).toEqual(['Total cobrado', 'Efectivo esperado', 'Diferencia']);
  });

  it('las ventas canceladas van aparte y con su aclaración; sin canceladas no hay sección', () => {
    const sin = hoja(turno(), resumen());
    expect(sin.sections.map((x) => x.title)).toEqual(['Cobros del turno', 'Efectivo']);
    expect(sin.note).toBeNull();
    const con = hoja(turno(), resumen({ cancelledSalesCents: 11_600, cancelledSalesCount: 2 }));
    expect(con.sections.map((x) => x.title)).toEqual([
      'Cobros del turno',
      'Efectivo',
      'Canceladas',
    ]);
    expect(con.sections[2]?.rows[0]).toEqual({ label: 'Ventas canceladas (2)', value: '$116.00' });
    expect(con.note).toBe('Los cobros de ventas canceladas no cuentan en el corte.');
  });

  it('sin efectivo contado no inventa contado ni diferencia', () => {
    const f = filas(
      turno({ countedCashCents: null, differenceCents: null }),
      resumen({ differenceCents: null }),
    );
    expect(f.some((x) => x.startsWith('Efectivo contado'))).toBe(false);
    expect(f.some((x) => x.startsWith('Diferencia'))).toBe(false);
  });

  it('un turno abierto no tiene corte todavía', () => {
    expect(armar(turno({ status: 'OPEN', closedAt: null }), resumen())).toEqual({
      ok: false,
      error: 'SHIFT_NOT_CLOSED',
    });
  });
});
