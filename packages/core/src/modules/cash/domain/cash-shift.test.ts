import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { summarizeDay, summarizeShift, type ShiftPayment } from './cash-shift';

const pago = (
  metodo: 'CASH' | 'TRANSFER',
  centavos: number,
  destino: 'WORK_ORDER' | 'COUNTER_SALE' = 'COUNTER_SALE',
  id = 'x',
): ShiftPayment => ({
  method: metodo,
  amountCents: centavos,
  kind: destino === 'COUNTER_SALE' ? 'SALE' : 'DEPOSIT',
  targetType: destino,
  targetId: id,
});

describe('corte de un turno', () => {
  it('un turno sin cobros espera solo el fondo', () => {
    const r = summarizeShift({
      openingFloatCents: 50_000,
      payments: [],
      cancelledSaleIds: new Set(),
      countedCashCents: null,
    });
    expect(r).toMatchObject({
      cashCents: 0,
      transferCents: 0,
      expectedCashCents: 50_000,
      differenceCents: null,
      cancelledSalesCents: 0,
    });
  });

  it('el efectivo esperado es el fondo más lo cobrado en efectivo; la transferencia no entra al cajón', () => {
    const r = summarizeShift({
      openingFloatCents: 10_000,
      payments: [pago('CASH', 5_800), pago('TRANSFER', 20_000), pago('CASH', 1_200, 'WORK_ORDER')],
      cancelledSaleIds: new Set(),
      countedCashCents: null,
    });
    expect(r.cashCents).toBe(7_000);
    expect(r.transferCents).toBe(20_000);
    expect(r.expectedCashCents).toBe(17_000);
    expect(r.salesCents).toBe(25_800);
    expect(r.orderPaymentsCents).toBe(1_200);
  });

  it('la diferencia es contado − esperado: exacto, sobrante y faltante', () => {
    const base = {
      openingFloatCents: 0,
      payments: [pago('CASH', 10_000)],
      cancelledSaleIds: new Set<string>(),
    };
    expect(summarizeShift({ ...base, countedCashCents: 10_000 }).differenceCents).toBe(0);
    expect(summarizeShift({ ...base, countedCashCents: 10_150 }).differenceCents).toBe(150);
    expect(summarizeShift({ ...base, countedCashCents: 9_900 }).differenceCents).toBe(-100);
  });

  it('una venta cancelada sale del cobro y queda aparte, contada una sola vez', () => {
    const r = summarizeShift({
      openingFloatCents: 0,
      payments: [
        pago('CASH', 3_000, 'COUNTER_SALE', 'v1'),
        pago('TRANSFER', 2_000, 'COUNTER_SALE', 'v1'),
        pago('CASH', 4_000, 'COUNTER_SALE', 'v2'),
      ],
      cancelledSaleIds: new Set(['v1']),
      countedCashCents: null,
    });
    expect(r.cashCents).toBe(4_000);
    expect(r.transferCents).toBe(0);
    expect(r.cancelledSalesCents).toBe(5_000);
    expect(r.cancelledSalesCount).toBe(1);
    expect(r.expectedCashCents).toBe(4_000);
  });

  it('el pago de una orden nunca se descarta por una venta cancelada con el mismo id', () => {
    const r = summarizeShift({
      openingFloatCents: 0,
      payments: [pago('CASH', 1_000, 'WORK_ORDER', 'v1')],
      cancelledSaleIds: new Set(['v1']),
      countedCashCents: null,
    });
    expect(r.cashCents).toBe(1_000);
    expect(r.cancelledSalesCents).toBe(0);
  });

  it('propiedad: por método suma el total del turno, y esperado = fondo + efectivo', () => {
    const metodo = fc.constantFrom<'CASH' | 'TRANSFER'>('CASH', 'TRANSFER');
    const destino = fc.constantFrom<'WORK_ORDER' | 'COUNTER_SALE'>('WORK_ORDER', 'COUNTER_SALE');
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.array(
          fc.record({
            m: metodo,
            c: fc.integer({ min: 1, max: 500_000 }),
            d: destino,
            id: fc.constantFrom('a', 'b', 'c'),
          }),
          { maxLength: 40 },
        ),
        fc.array(fc.constantFrom('a', 'b', 'c'), { maxLength: 3 }),
        (fondo, filas, canceladas) => {
          const pagos = filas.map((f) => pago(f.m, f.c, f.d, f.id));
          const cancel = new Set<string>(canceladas);
          const r = summarizeShift({
            openingFloatCents: fondo,
            payments: pagos,
            cancelledSaleIds: cancel,
            countedCashCents: null,
          });
          const cuentan = pagos.filter(
            (p) => !(p.targetType === 'COUNTER_SALE' && cancel.has(p.targetId)),
          );
          const suma = cuentan.reduce((s, p) => s + p.amountCents, 0);
          expect(r.cashCents + r.transferCents).toBe(suma);
          expect(r.salesCents + r.orderPaymentsCents).toBe(suma);
          expect(r.expectedCashCents).toBe(fondo + r.cashCents);
          const fuera = pagos.length - cuentan.length;
          expect(r.cancelledSalesCount).toBeLessThanOrEqual(fuera);
        },
      ),
    );
  });
});

describe('corte consolidado del día', () => {
  const turno = (id: string, cashierId: string, openedAt: string) => ({
    shift: { id, cashierId: cashierId as never, openedAt },
    summary: summarizeShift({
      openingFloatCents: 1_000,
      payments: [pago('CASH', 2_000), pago('TRANSFER', 3_000)],
      cancelledSaleIds: new Set(),
      countedCashCents: null,
    }),
  });

  it('suma los turnos del día por método y por cajero, en hora de México', () => {
    const r = summarizeDay('2026-10-31', [
      turno('t1', 'ana', '2026-10-31T15:00:00.000Z'),
      turno('t2', 'beto', '2026-10-31T20:00:00.000Z'),
      turno('t3', 'ana', '2026-10-31T22:00:00.000Z'),
      // 1 nov 03:00 UTC es todavía 31 oct 21:00 en México.
      turno('t4', 'beto', '2026-11-01T03:00:00.000Z'),
      // 1 nov 07:00 UTC ya es 1 nov 01:00 en México: otro día.
      turno('t5', 'ana', '2026-11-01T07:00:00.000Z'),
    ]);
    expect(r.shiftCount).toBe(4);
    expect(r.cashCents).toBe(8_000);
    expect(r.transferCents).toBe(12_000);
    expect(r.totalCents).toBe(20_000);
    expect(r.expectedCashCents).toBe(12_000);
    expect(r.byCashier).toEqual([
      {
        cashierId: 'ana',
        cashCents: 4_000,
        transferCents: 6_000,
        shiftCount: 2,
        totalCents: 10_000,
      },
      {
        cashierId: 'beto',
        cashCents: 4_000,
        transferCents: 6_000,
        shiftCount: 2,
        totalCents: 10_000,
      },
    ]);
  });

  it('un día sin turnos da todo en cero', () => {
    expect(summarizeDay('2026-10-31', [])).toEqual({
      date: '2026-10-31',
      cashCents: 0,
      transferCents: 0,
      totalCents: 0,
      expectedCashCents: 0,
      shiftCount: 0,
      byCashier: [],
    });
  });

  it('un turno que cruza la medianoche cuenta en el día en que se abrió', () => {
    const r = summarizeDay('2026-10-31', [turno('t', 'ana', '2026-11-01T05:30:00.000Z')]);
    expect(r.shiftCount).toBe(1);
  });

  it('propiedad: el consolidado es la suma de los cortes de cada turno, por método y por cajero', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            quien: fc.constantFrom('ana', 'beto', 'carla'),
            efectivo: fc.integer({ min: 0, max: 100_000 }),
            banco: fc.integer({ min: 0, max: 100_000 }),
          }),
          { maxLength: 15 },
        ),
        (turnos) => {
          const lista = turnos.map((t, i) => ({
            shift: {
              id: String(i),
              cashierId: t.quien as never,
              openedAt: '2026-10-31T18:00:00.000Z',
            },
            summary: summarizeShift({
              openingFloatCents: 0,
              payments: [
                ...(t.efectivo > 0 ? [pago('CASH', t.efectivo)] : []),
                ...(t.banco > 0 ? [pago('TRANSFER', t.banco)] : []),
              ],
              cancelledSaleIds: new Set(),
              countedCashCents: null,
            }),
          }));
          const r = summarizeDay('2026-10-31', lista);
          expect(r.cashCents).toBe(turnos.reduce((s, t) => s + t.efectivo, 0));
          expect(r.transferCents).toBe(turnos.reduce((s, t) => s + t.banco, 0));
          expect(r.totalCents).toBe(r.cashCents + r.transferCents);
          expect(r.byCashier.reduce((s, c) => s + c.totalCents, 0)).toBe(r.totalCents);
          expect(r.byCashier.reduce((s, c) => s + c.shiftCount, 0)).toBe(r.shiftCount);
        },
      ),
    );
  });
});
