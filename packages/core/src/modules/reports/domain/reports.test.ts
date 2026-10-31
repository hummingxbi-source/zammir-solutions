import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { compareAmounts } from './comparison';
import {
  comparisonPeriod,
  inPeriod,
  periodContaining,
  periodOf,
  previousPeriod,
} from './periods';
import {
  collectionsByCashier,
  collectionsByMethod,
  countedPayments,
  ordersByStatus,
  receivablesAging,
  salesReport,
  topProducts,
} from './reports';

type Pago = Parameters<typeof salesReport>[0]['payments'][number];

const pago = (
  centavos: number,
  paidAt: string,
  cambios: Partial<Pago> = {},
): Pago => ({
  targetType: 'COUNTER_SALE',
  targetId: 'v1',
  amountCents: centavos,
  paidAt,
  userId: 'ana',
  method: 'CASH',
  ...cambios,
});

describe('periodos en hora de México', () => {
  it('el día de México, no el de UTC', () => {
    // 1 nov 03:00 UTC = 31 oct 21:00 en México.
    expect(periodOf(new Date('2026-11-01T03:00:00.000Z'), 'DAY')).toEqual({
      kind: 'DAY',
      start: '2026-10-31',
      end: '2026-10-31',
    });
  });

  it('la semana va de lunes a domingo', () => {
    // 1 nov 2026 es domingo → la semana empieza el lunes 26 de octubre.
    expect(periodContaining('2026-11-01', 'WEEK')).toEqual({
      kind: 'WEEK',
      start: '2026-10-26',
      end: '2026-11-01',
    });
    // Un lunes abre su propia semana.
    expect(periodContaining('2026-11-02', 'WEEK')).toEqual({
      kind: 'WEEK',
      start: '2026-11-02',
      end: '2026-11-08',
    });
    expect(periodContaining('2026-11-04', 'WEEK').start).toBe('2026-11-02');
  });

  it('el mes de México: a las 21:00 del 31 de octubre todavía es octubre', () => {
    expect(periodOf(new Date('2026-11-01T03:00:00.000Z'), 'MONTH')).toEqual({
      kind: 'MONTH',
      start: '2026-10-01',
      end: '2026-10-31',
    });
    expect(periodOf(new Date('2026-11-01T07:00:00.000Z'), 'MONTH').start).toBe('2026-11-01');
  });

  it('febrero en año bisiesto y no bisiesto', () => {
    expect(periodContaining('2028-02-10', 'MONTH').end).toBe('2028-02-29');
    expect(periodContaining('2027-02-10', 'MONTH').end).toBe('2027-02-28');
  });

  it('el periodo anterior de cada tipo, también al cruzar el año', () => {
    expect(previousPeriod(periodContaining('2026-11-20', 'DAY'))).toMatchObject({ start: '2026-11-19' });
    expect(previousPeriod(periodContaining('2026-11-20', 'WEEK'))).toMatchObject({
      start: '2026-11-09',
      end: '2026-11-15',
    });
    expect(previousPeriod(periodContaining('2027-01-15', 'MONTH'))).toMatchObject({
      start: '2026-12-01',
      end: '2026-12-31',
    });
    expect(previousPeriod(periodContaining('2026-03-15', 'MONTH'))).toMatchObject({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('propiedad: el día cae dentro de su semana y su mes, y los anteriores no se traslapan con ellos', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2035-12-31T00:00:00Z'), noInvalidDate: true }),
        (d) => {
          const dia = periodOf(d, 'DAY').start;
          for (const kind of ['WEEK', 'MONTH'] as const) {
            const p = periodContaining(dia, kind);
            expect(dia >= p.start && dia <= p.end).toBe(true);
            expect(previousPeriod(p).end < p.start).toBe(true);
          }
          const semana = periodContaining(dia, 'WEEK');
          expect(new Date(`${semana.start}T00:00:00Z`).getUTCDay()).toBe(1);
          expect(new Date(`${semana.end}T00:00:00Z`).getUTCDay()).toBe(0);
        },
      ),
    );
  });

  it('inPeriod usa el día de México y no acepta fechas inválidas', () => {
    const octubre = periodContaining('2026-10-15', 'MONTH');
    expect(inPeriod('2026-11-01T03:00:00.000Z', octubre)).toBe(true);
    expect(inPeriod('2026-11-01T07:00:00.000Z', octubre)).toBe(false);
    expect(inPeriod('2026-10-01T05:59:59.000Z', octubre)).toBe(false);
    expect(inPeriod('2026-10-01T06:00:00.000Z', octubre)).toBe(true);
    expect(inPeriod('basura', octubre)).toBe(false);
  });

  it('comparar contra el periodo completo o solo contra el mismo tramo (PP-13)', () => {
    const mes = periodContaining('2026-11-12', 'MONTH');
    expect(comparisonPeriod(mes, '2026-11-12')).toEqual(previousPeriod(mes));
    expect(comparisonPeriod(mes, '2026-11-12', 'SAME_SPAN')).toEqual({
      kind: 'MONTH',
      start: '2026-10-01',
      end: '2026-10-12',
    });
    // Sin pasarse del anterior: 31 de marzo contra febrero de 28 días.
    const marzo = periodContaining('2026-03-31', 'MONTH');
    expect(comparisonPeriod(marzo, '2026-03-31', 'SAME_SPAN').end).toBe('2026-02-28');
    // El primer día del periodo compara con un solo día.
    expect(comparisonPeriod(mes, '2026-11-01', 'SAME_SPAN').end).toBe('2026-10-01');
    const dia = periodContaining('2026-11-12', 'DAY');
    expect(comparisonPeriod(dia, '2026-11-12', 'SAME_SPAN')).toEqual(previousPeriod(dia));
  });
});

describe('comparativo', () => {
  it('sube, baja o queda igual, con el porcentaje redondeado al más cercano', () => {
    expect(compareAmounts(11_250, 10_000)).toMatchObject({ trend: 'UP', percentBps: 1250, deltaCents: 1250 });
    expect(compareAmounts(7_500, 10_000)).toMatchObject({ trend: 'DOWN', percentBps: -2500, deltaCents: -2500 });
    expect(compareAmounts(10_000, 10_000)).toMatchObject({ trend: 'SAME', percentBps: 0 });
    expect(compareAmounts(30_010, 30_000).percentBps).toBe(3);
    expect(compareAmounts(29_990, 30_000).percentBps).toBe(-3);
  });

  it('el redondeo es simétrico: +0.5 sube y −0.5 baja con la misma magnitud', () => {
    expect(compareAmounts(10_005, 10_000).percentBps).toBe(5);
    expect(compareAmounts(9_995, 10_000).percentBps).toBe(-5);
  });

  it('con el periodo anterior en cero no hay porcentaje, ni infinito', () => {
    expect(compareAmounts(5_000, 0)).toEqual({
      currentCents: 5_000,
      previousCents: 0,
      deltaCents: 5_000,
      percentBps: null,
      trend: 'NO_BASELINE',
    });
    expect(compareAmounts(0, 0).trend).toBe('NO_BASELINE');
  });

  it('propiedad: el signo del porcentaje es el de la diferencia y nunca es NaN', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), fc.integer({ min: 1, max: 10_000_000 }), (a, b) => {
        const c = compareAmounts(a, b);
        expect(Number.isFinite(c.percentBps)).toBe(true);
        if (c.deltaCents > 0) expect(c.percentBps).toBeGreaterThanOrEqual(0);
        if (c.deltaCents < 0) expect(c.percentBps).toBeLessThanOrEqual(0);
      }),
    );
  });
});

describe('ventas del día, la semana y el mes (efectivo recibido)', () => {
  // Hoy: viernes 20 nov 2026, mediodía en México.
  const ahora = new Date('2026-11-20T18:00:00.000Z');
  const pagos: Pago[] = [
    pago(10_000, '2026-11-20T15:00:00.000Z'), // hoy
    pago(5_000, '2026-11-20T20:00:00.000Z', { targetType: 'WORK_ORDER', targetId: 'o1' }), // hoy, de una orden
    pago(7_000, '2026-11-19T15:00:00.000Z'), // ayer (misma semana)
    pago(3_000, '2026-11-16T15:00:00.000Z'), // lunes de esta semana
    pago(4_000, '2026-11-15T15:00:00.000Z'), // domingo: semana pasada
    pago(2_000, '2026-11-02T15:00:00.000Z'), // este mes
    pago(6_000, '2026-10-31T15:00:00.000Z'), // octubre
    pago(8_000, '2026-11-20T16:00:00.000Z', { targetId: 'cancelada' }), // venta cancelada: no cuenta
  ];
  const ventas = [
    { id: 'v1', status: 'COMPLETED' as const },
    { id: 'cancelada', status: 'CANCELLED' as const },
  ];

  it('coincide al centavo con los datos armados a mano', () => {
    const r = salesReport({ payments: pagos, sales: ventas, now: ahora });
    expect(r.DAY.comparison.currentCents).toBe(15_000);
    expect(r.DAY.comparison.previousCents).toBe(7_000);
    expect(r.WEEK.comparison.currentCents).toBe(15_000 + 7_000 + 3_000);
    expect(r.WEEK.comparison.previousCents).toBe(4_000);
    expect(r.MONTH.comparison.currentCents).toBe(15_000 + 7_000 + 3_000 + 4_000 + 2_000);
    expect(r.MONTH.comparison.previousCents).toBe(6_000);
  });

  it('el comparativo trae porcentaje y tendencia', () => {
    const r = salesReport({ payments: pagos, sales: ventas, now: ahora });
    expect(r.DAY.comparison).toMatchObject({ trend: 'UP', percentBps: 11_429 });
    expect(r.MONTH.comparison).toMatchObject({ trend: 'UP', percentBps: 41_667 });
  });

  it('el periodo anterior en cero no da porcentaje', () => {
    const r = salesReport({ payments: [pago(1_000, '2026-11-20T15:00:00.000Z')], sales: ventas, now: ahora });
    expect(r.MONTH.comparison).toMatchObject({ trend: 'NO_BASELINE', percentBps: null });
  });

  it('contra el mismo tramo solo cuenta el principio del periodo anterior', () => {
    const base = [
      pago(1_000, '2026-11-20T15:00:00.000Z'),
      pago(500, '2026-11-02T15:00:00.000Z'),
      pago(200, '2026-10-03T15:00:00.000Z'), // 3 de octubre: dentro del tramo (20 días)
      pago(900, '2026-10-28T15:00:00.000Z'), // 28 de octubre: fuera del tramo
    ];
    const completo = salesReport({ payments: base, sales: ventas, now: ahora, mode: 'FULL_PERIOD' });
    const tramo = salesReport({ payments: base, sales: ventas, now: ahora, mode: 'SAME_SPAN' });
    expect(completo.MONTH.comparison.previousCents).toBe(1_100);
    expect(tramo.MONTH.comparison.previousCents).toBe(200);
  });

  it('una venta cancelada no suma y el pago de una orden con el mismo id sí', () => {
    const r = countedPayments(
      [
        { targetType: 'COUNTER_SALE' as const, targetId: 'x' },
        { targetType: 'WORK_ORDER' as const, targetId: 'x' },
      ],
      new Set(['x']),
    );
    expect(r).toEqual([{ targetType: 'WORK_ORDER', targetId: 'x' }]);
  });
});

describe('productos más vendidos', () => {
  const linea = (productId: string | null, name: string, quantity: number, total: number) => ({
    productId,
    name,
    quantity,
    lineTotalCents: total,
  });
  const periodo = periodContaining('2026-11-20', 'MONTH');
  const ventas = [
    {
      status: 'COMPLETED' as const,
      issuedAt: '2026-11-10T18:00:00.000Z',
      lines: [linea('p1', 'Chapa', 3, 30_000), linea('p2', 'Vidrio 6 mm', 1, 50_000)],
    },
    {
      status: 'CANCELLED' as const,
      issuedAt: '2026-11-10T18:00:00.000Z',
      lines: [linea('p1', 'Chapa', 99, 990_000)],
    },
    {
      status: 'COMPLETED' as const,
      issuedAt: '2026-10-10T18:00:00.000Z',
      lines: [linea('p1', 'Chapa', 50, 500_000)],
    },
  ];
  const ordenes = [
    {
      status: 'IN_PROCESS' as const,
      issuedAt: '2026-11-12T18:00:00.000Z',
      lines: [linea('p2', 'Vidrio 6 mm', 2, 100_000), linea(null, 'Cancel a medida', 5, 5_000)],
    },
    {
      status: 'CANCELLED' as const,
      issuedAt: '2026-11-12T18:00:00.000Z',
      lines: [linea('p2', 'Vidrio 6 mm', 40, 400_000)],
    },
  ];

  it('suma por producto y ordena por importe y por cantidad', () => {
    const r = topProducts({ sales: ventas, orders: ordenes, period: periodo });
    expect(r.byAmount.map((x) => [x.name, x.amountCents])).toEqual([
      ['Vidrio 6 mm', 150_000],
      ['Chapa', 30_000],
      ['Cancel a medida', 5_000],
    ]);
    expect(r.byQuantity.map((x) => [x.name, x.quantity])).toEqual([
      ['Cancel a medida', 5],
      ['Chapa', 3],
      ['Vidrio 6 mm', 3],
    ]);
  });

  it('respeta el periodo: la semana deja fuera lo del resto del mes', () => {
    const semana = periodContaining('2026-11-10', 'WEEK');
    const r = topProducts({ sales: ventas, orders: ordenes, period: semana });
    expect(r.byAmount.map((x) => x.name)).toEqual(['Vidrio 6 mm', 'Chapa', 'Cancel a medida']);
    expect(r.byAmount[0]?.amountCents).toBe(150_000);
  });

  it('el límite recorta, y a igual valor ordena por nombre', () => {
    const iguales = [
      { status: 'COMPLETED' as const, issuedAt: '2026-11-10T18:00:00.000Z', lines: [linea('b', 'B', 1, 100), linea('a', 'A', 1, 100)] },
    ];
    const r = topProducts({ sales: iguales, orders: [], period: periodo, limit: 1 });
    expect(r.byAmount.map((x) => x.name)).toEqual(['A']);
    expect(r.byQuantity.map((x) => x.name)).toEqual(['A']);
  });

  it('sin ventas da listas vacías', () => {
    const r = topProducts({ sales: [], orders: [], period: periodo });
    expect(r.byAmount).toEqual([]);
  });
});

describe('trabajos por estatus', () => {
  it('da conteo y valor por cada estatus, también los vacíos, y marca los pendientes', () => {
    const r = ordersByStatus([
      { status: 'WAITING', totalCents: 1_000 },
      { status: 'WAITING', totalCents: 2_000 },
      { status: 'READY', totalCents: 5_000 },
      { status: 'DELIVERED', totalCents: 9_000 },
    ]);
    expect(r.map((x) => [x.status, x.count, x.valueCents, x.pending])).toEqual([
      ['WAITING', 2, 3_000, true],
      ['IN_PROCESS', 0, 0, true],
      ['READY', 1, 5_000, true],
      ['DELIVERED', 1, 9_000, false],
      ['CANCELLED', 0, 0, false],
    ]);
  });
});

describe('antigüedad de las cuentas por cobrar', () => {
  const fila = (dias: number | null, saldo: number) =>
    ({ daysOutstanding: dias, balanceCents: saldo }) as never;

  it('agrupa en tramos del tamaño del umbral y resalta del umbral en adelante', () => {
    const r = receivablesAging([fila(0, 100), fila(9, 200), fila(10, 400), fila(19, 800), fila(20, 1_600), fila(90, 3_200)], 10);
    expect(r.map((b) => [b.fromDays, b.toDays, b.count, b.balanceCents, b.overdue])).toEqual([
      [0, 9, 2, 300, false],
      [10, 19, 2, 1_200, true],
      [20, null, 2, 4_800, true],
    ]);
  });

  it('con otro umbral cambian los tramos', () => {
    const r = receivablesAging([fila(14, 100), fila(15, 100)], 15);
    expect(r.map((b) => b.count)).toEqual([1, 1, 0]);
    expect(r[1]?.fromDays).toBe(15);
  });

  it('las de fecha inválida van aparte, sin días y sin resaltar como atrasadas por días', () => {
    const r = receivablesAging([fila(null, 700), fila(1, 100)], 10);
    expect(r).toHaveLength(4);
    expect(r[3]).toMatchObject({ undated: true, fromDays: null, count: 1, balanceCents: 700 });
  });

  it('sin cuentas son tres tramos en cero', () => {
    const r = receivablesAging([], 10);
    expect(r.map((b) => b.count)).toEqual([0, 0, 0]);
  });

  it('un umbral absurdo (cero o negativo) no rompe los tramos', () => {
    const r = receivablesAging([fila(0, 100), fila(1, 100)], 0);
    expect(r[0]?.fromDays).toBe(0);
    expect(r.reduce((s, b) => s + b.count, 0)).toBe(2);
  });
});

describe('cobros por cajero y por método', () => {
  const ahora = new Date('2026-11-20T18:00:00.000Z');
  const ventas = [{ id: 'v1', status: 'COMPLETED' as const }, { id: 'x', status: 'CANCELLED' as const }];
  const pagos: Pago[] = [
    pago(10_000, '2026-11-20T15:00:00.000Z', { userId: 'ana', method: 'CASH' }),
    pago(4_000, '2026-11-20T16:00:00.000Z', { userId: 'ana', method: 'TRANSFER' }),
    pago(6_000, '2026-11-20T17:00:00.000Z', { userId: 'beto', method: 'CASH' }),
    pago(3_000, '2026-11-17T17:00:00.000Z', { userId: 'beto', method: 'TRANSFER' }),
    pago(2_500, '2026-11-03T17:00:00.000Z', { userId: 'carla', method: 'CASH' }),
    pago(9_999, '2026-11-20T17:00:00.000Z', { userId: 'ana', method: 'CASH', targetId: 'x' }),
    pago(1_000, '2026-10-20T17:00:00.000Z', { userId: 'ana', method: 'CASH' }),
  ];

  it('suma por cajero hoy, la semana y el mes al centavo, de mayor a menor', () => {
    const r = collectionsByCashier({ payments: pagos, sales: ventas, now: ahora });
    expect(r.DAY.rows).toEqual([
      { userId: 'ana', cashCents: 10_000, transferCents: 4_000, totalCents: 14_000, count: 2 },
      { userId: 'beto', cashCents: 6_000, transferCents: 0, totalCents: 6_000, count: 1 },
    ]);
    expect(r.WEEK.rows.map((x) => [x.userId, x.totalCents])).toEqual([
      ['ana', 14_000],
      ['beto', 9_000],
    ]);
    expect(r.MONTH.rows.map((x) => [x.userId, x.totalCents])).toEqual([
      ['ana', 14_000],
      ['beto', 9_000],
      ['carla', 2_500],
    ]);
    expect(r.MONTH.totals).toEqual({ cashCents: 18_500, transferCents: 7_000, totalCents: 25_500, count: 5 });
  });

  it('a igual total ordena por persona y sin cobros hay listas vacías', () => {
    const r = collectionsByCashier({
      payments: [pago(100, '2026-11-20T15:00:00.000Z', { userId: 'b' }), pago(100, '2026-11-20T15:00:00.000Z', { userId: 'a' })],
      sales: [],
      now: ahora,
    });
    expect(r.DAY.rows.map((x) => x.userId)).toEqual(['a', 'b']);
    expect(collectionsByCashier({ payments: [], sales: [], now: ahora }).DAY).toMatchObject({ rows: [], totals: { totalCents: 0, count: 0 } });
  });

  it('separa efectivo y transferencia en el periodo al centavo', () => {
    const mes = periodContaining('2026-11-20', 'MONTH');
    expect(collectionsByMethod({ payments: pagos, sales: ventas, period: mes })).toEqual({
      cashCents: 18_500,
      transferCents: 7_000,
      totalCents: 25_500,
      count: 5,
    });
    const hoy = periodContaining('2026-11-20', 'DAY');
    expect(collectionsByMethod({ payments: pagos, sales: ventas, period: hoy }).totalCents).toBe(20_000);
  });

  it('propiedad: la suma por cajero siempre es el total del periodo, y efectivo + transferencia = total', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            c: fc.integer({ min: 1, max: 100_000 }),
            quien: fc.constantFrom('a', 'b', 'c'),
            metodo: fc.constantFrom<'CASH' | 'TRANSFER'>('CASH', 'TRANSFER'),
            dia: fc.integer({ min: 1, max: 28 }),
          }),
          { maxLength: 30 },
        ),
        (casos) => {
          const lista = casos.map((x) =>
            pago(x.c, `2026-11-${String(x.dia).padStart(2, '0')}T18:00:00.000Z`, { userId: x.quien, method: x.metodo }),
          );
          const r = collectionsByCashier({ payments: lista, sales: [], now: ahora });
          for (const k of ['DAY', 'WEEK', 'MONTH'] as const) {
            expect(r[k].rows.reduce((s, x) => s + x.totalCents, 0)).toBe(r[k].totals.totalCents);
            expect(r[k].totals.cashCents + r[k].totals.transferCents).toBe(r[k].totals.totalCents);
          }
        },
      ),
    );
  });
});
