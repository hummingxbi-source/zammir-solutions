import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  buildReceivables,
  DEFAULT_OVERDUE_DAYS,
  fillTemplate,
  summarizeReceivables,
} from './receivables';

type Orden = Parameters<typeof buildReceivables>[0]['orders'][number];
type Pago = Parameters<typeof buildReceivables>[0]['payments'][number];

const orden = (
  id: string,
  total: number,
  issuedAt: string,
  cambios: Partial<Orden> = {},
): Orden => ({
  id: id as never,
  status: 'IN_PROCESS',
  customerId: `c-${id}` as never,
  totalCents: total,
  folio: `OT-${id}`,
  tempFolio: `T1-${id}`,
  issuedAt,
  ...cambios,
});
const pago = (
  ordenId: string,
  centavos: number,
  tipo: Pago['targetType'] = 'WORK_ORDER',
): Pago => ({
  targetType: tipo,
  targetId: ordenId,
  amountCents: centavos,
});

const HOY = '2026-11-20';

describe('cuentas por cobrar', () => {
  it('el umbral por omisión es de 10 días (PD-33)', () => {
    expect(DEFAULT_OVERDUE_DAYS).toBe(10);
  });

  it('muestra folio, saldo y días calculados con el día de México', () => {
    const [fila] = buildReceivables({
      orders: [orden('1', 50_000, '2026-11-10T18:00:00.000Z')],
      payments: [pago('1', 20_000)],
      today: HOY,
    });
    expect(fila).toEqual({
      orderId: '1',
      folio: 'OT-1',
      customerId: 'c-1',
      totalCents: 50_000,
      paidCents: 20_000,
      balanceCents: 30_000,
      issuedOn: '2026-11-10',
      daysOutstanding: 10,
      overdue: true,
    });
  });

  it('un instante de madrugada UTC cuenta como el día anterior en México', () => {
    const [fila] = buildReceivables({
      orders: [orden('1', 1_000, '2026-11-11T03:00:00.000Z')],
      payments: [],
      today: HOY,
    });
    expect(fila?.issuedOn).toBe('2026-11-10');
    expect(fila?.daysOutstanding).toBe(10);
  });

  it('se resalta justo en el umbral y no un día antes; el umbral se puede cambiar', () => {
    const base = { payments: [], today: HOY };
    const nueve = buildReceivables({
      ...base,
      orders: [orden('1', 100, '2026-11-11T18:00:00.000Z')],
    });
    const diez = buildReceivables({
      ...base,
      orders: [orden('1', 100, '2026-11-10T18:00:00.000Z')],
    });
    expect(nueve[0]?.overdue).toBe(false);
    expect(diez[0]?.overdue).toBe(true);
    const mas = buildReceivables({
      ...base,
      overdueDays: 15,
      orders: [orden('1', 100, '2026-11-10T18:00:00.000Z')],
    });
    expect(mas[0]?.overdue).toBe(false);
  });

  it('no aparecen las saldadas, las pagadas de más ni las canceladas', () => {
    const filas = buildReceivables({
      orders: [
        orden('1', 10_000, '2026-11-01T18:00:00.000Z'),
        orden('2', 10_000, '2026-11-01T18:00:00.000Z'),
        orden('3', 10_000, '2026-11-01T18:00:00.000Z', { status: 'CANCELLED' }),
        orden('4', 10_000, '2026-11-01T18:00:00.000Z'),
      ],
      payments: [pago('1', 10_000), pago('2', 12_000)],
      today: HOY,
    });
    expect(filas.map((f) => f.orderId)).toEqual(['4']);
  });

  it('una orden entregada con saldo sí se cobra', () => {
    const filas = buildReceivables({
      orders: [orden('1', 10_000, '2026-11-01T18:00:00.000Z', { status: 'DELIVERED' })],
      payments: [],
      today: HOY,
    });
    expect(filas).toHaveLength(1);
  });

  it('el pago de una venta con el mismo id no reduce el saldo de la orden', () => {
    const [fila] = buildReceivables({
      orders: [orden('1', 10_000, '2026-11-01T18:00:00.000Z')],
      payments: [pago('1', 10_000, 'COUNTER_SALE')],
      today: HOY,
    });
    expect(fila?.balanceCents).toBe(10_000);
  });

  it('una fecha futura da 0 días y una inválida no da días ni atraso', () => {
    const filas = buildReceivables({
      orders: [orden('1', 100, '2027-01-01T18:00:00.000Z'), orden('2', 100, 'no-es-fecha')],
      payments: [],
      today: HOY,
    });
    const futura = filas.find((f) => f.orderId === '1');
    const mala = filas.find((f) => f.orderId === '2');
    expect(futura).toMatchObject({ daysOutstanding: 0, overdue: false });
    expect(mala).toMatchObject({ daysOutstanding: null, issuedOn: null, overdue: false });
  });

  it('se ordena de la más atrasada a la más reciente, y a igual atraso, por saldo; sin fecha al final', () => {
    const filas = buildReceivables({
      orders: [
        orden('nueva', 1_000, '2026-11-19T18:00:00.000Z'),
        orden('vieja-chica', 1_000, '2026-11-01T18:00:00.000Z'),
        orden('vieja-grande', 9_000, '2026-11-01T18:00:00.000Z'),
        orden('rota', 5_000, 'x'),
      ],
      payments: [],
      today: HOY,
    });
    expect(filas.map((f) => f.orderId)).toEqual(['vieja-grande', 'vieja-chica', 'nueva', 'rota']);
  });

  it('usa el folio provisional mientras no hay definitivo', () => {
    const [fila] = buildReceivables({
      orders: [orden('1', 100, '2026-11-01T18:00:00.000Z', { folio: null })],
      payments: [],
      today: HOY,
    });
    expect(fila?.folio).toBe('T1-1');
  });

  it('el resumen suma saldos y separa lo atrasado', () => {
    const filas = buildReceivables({
      orders: [
        orden('1', 10_000, '2026-11-01T18:00:00.000Z'),
        orden('2', 5_000, '2026-11-19T18:00:00.000Z'),
      ],
      payments: [],
      today: HOY,
    });
    expect(summarizeReceivables(filas)).toEqual({
      count: 2,
      totalBalanceCents: 15_000,
      overdueCount: 1,
      overdueBalanceCents: 10_000,
    });
    expect(summarizeReceivables([])).toEqual({
      count: 0,
      totalBalanceCents: 0,
      overdueCount: 0,
      overdueBalanceCents: 0,
    });
  });

  it('propiedad: saldo = total − pagado y nunca es cero ni negativo; los días nunca son negativos', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            total: fc.integer({ min: 1, max: 1_000_000 }),
            pagado: fc.integer({ min: 0, max: 1_200_000 }),
            dias: fc.integer({ min: -30, max: 400 }),
          }),
          { maxLength: 15 },
        ),
        (casos) => {
          const ordenes = casos.map((c, i) => {
            const d = new Date(Date.UTC(2026, 10, 20 - c.dias, 18));
            return orden(String(i), c.total, d.toISOString());
          });
          const pagos = casos.map((c, i) => pago(String(i), c.pagado));
          const filas = buildReceivables({ orders: ordenes, payments: pagos, today: HOY });
          for (const f of filas) {
            expect(f.balanceCents).toBeGreaterThan(0);
            expect(f.balanceCents).toBe(f.totalCents - f.paidCents);
            expect(f.daysOutstanding ?? 0).toBeGreaterThanOrEqual(0);
          }
          expect(filas.length).toBe(casos.filter((c) => c.pagado < c.total).length);
        },
      ),
    );
  });
});

describe('plantilla de mensaje', () => {
  it('llena cliente, folio, saldo y negocio', () => {
    expect(
      fillTemplate('Hola {cliente}, {folio} debe {saldo} a {negocio}.', {
        cliente: 'Ana',
        folio: 'OT-1',
        saldo: '$10.00',
        negocio: 'ZAMMIR',
      }),
    ).toBe('Hola Ana, OT-1 debe $10.00 a ZAMMIR.');
  });

  it('repite lo que aparece varias veces y deja a la vista lo que no se conoce', () => {
    expect(fillTemplate('{a} {a} {b}', { a: 'x' })).toBe('x x {b}');
  });
});
