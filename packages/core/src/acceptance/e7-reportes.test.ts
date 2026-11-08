import { describe, expect, it } from 'vitest';

import { periodOf } from '../modules/reports/domain/periods';
import {
  collectionsByCashier,
  collectionsByMethod,
  dailyIncomeTrend,
  salesReport,
} from '../modules/reports/domain/reports';

/** E7 · Reportes [PRUEBAS_DE_ACEPTACION.md]: los reportes coinciden al centavo con los pagos, en hora de México y
 *  con el día, la semana (de lunes a domingo) y el mes bien delimitados [RN-17, RN-20].
 *
 *  Los datos están armados a mano en los bordes de medianoche de México (UTC−6 todo el año): un cobro un segundo
 *  antes y otro justo a las 00:00 de México caen en días, semanas y meses distintos. Los totales esperados se
 *  calcularon a mano, sin usar el código que se prueba.
 *
 *  Hoy es jueves 12 de noviembre de 2026, 12:00 en México.
 *    Semana en curso: lunes 9 a domingo 15 de noviembre.  Semana anterior: lunes 2 a domingo 8.
 *    Mes en curso: noviembre.  Mes anterior: octubre.  Ayer: miércoles 11. */
const AHORA = new Date('2026-11-12T18:00:00.000Z');

const pago = (
  id: string,
  paidAt: string,
  amountCents: number,
  method: 'CASH' | 'TRANSFER',
  userId: string,
  targetId = 'orden-1',
  targetType: 'WORK_ORDER' | 'COUNTER_SALE' = 'WORK_ORDER',
) => ({ id, paidAt, amountCents, method, userId, targetId, targetType });

const ANA = 'ana';
const BETO = 'beto';

const PAGOS = [
  // Hoy (jueves 12): 09:00 y 00:00 en punto.
  pago('p1', '2026-11-12T15:00:00.000Z', 10_000, 'CASH', ANA),
  pago('p3', '2026-11-12T06:00:00.000Z', 3_333, 'CASH', BETO),
  // Ayer (miércoles 11), un segundo antes de la medianoche: 05:59:59Z del 12 = 23:59:59 del 11 en México.
  pago('p2', '2026-11-12T05:59:59.000Z', 25_050, 'TRANSFER', ANA),
  // Lunes 9, a las 00:00 en punto: abre la semana en curso.
  pago('p4', '2026-11-09T06:00:00.000Z', 7_777, 'CASH', BETO),
  // Domingo 8, un segundo antes de medianoche: cierra la semana anterior.
  pago('p5', '2026-11-09T05:59:59.000Z', 1_111, 'CASH', ANA),
  // Sábado 31 de octubre, 23:59:59: es de octubre.
  pago('p6', '2026-11-01T05:59:59.000Z', 9_999, 'CASH', ANA),
  // Domingo 1 de noviembre, 00:00: abre noviembre (pero es de la semana del 26 de octubre al 1 de noviembre).
  pago('p7', '2026-11-01T06:00:00.000Z', 5_000, 'CASH', BETO),
  // Una venta de mostrador cancelada hoy: no cuenta.
  pago('p8', '2026-11-12T16:00:00.000Z', 4_000, 'CASH', ANA, 'venta-cancelada', 'COUNTER_SALE'),
  // Una venta de mostrador buena hoy: sí cuenta.
  pago('p9', '2026-11-12T17:00:00.000Z', 1_500, 'TRANSFER', BETO, 'venta-buena', 'COUNTER_SALE'),
] as const;

const VENTAS = [
  { id: 'venta-cancelada', status: 'CANCELLED' as const },
  { id: 'venta-buena', status: 'COMPLETED' as const },
];

describe('E7 · los periodos son de México y van de lunes a domingo', () => {
  it('el día, la semana y el mes de hoy', () => {
    expect(periodOf(AHORA, 'DAY')).toEqual({ kind: 'DAY', start: '2026-11-12', end: '2026-11-12' });
    expect(periodOf(AHORA, 'WEEK')).toEqual({
      kind: 'WEEK',
      start: '2026-11-09',
      end: '2026-11-15',
    });
    expect(periodOf(AHORA, 'MONTH')).toEqual({
      kind: 'MONTH',
      start: '2026-11-01',
      end: '2026-11-30',
    });
  });

  it('a las 00:00 de México empieza otro día, aunque en UTC todavía sea el anterior', () => {
    // 05:59:59Z = 23:59:59 del miércoles 11; 06:00:00Z = 00:00 del jueves 12.
    expect(periodOf(new Date('2026-11-12T05:59:59.000Z'), 'DAY').start).toBe('2026-11-11');
    expect(periodOf(new Date('2026-11-12T06:00:00.000Z'), 'DAY').start).toBe('2026-11-12');
  });

  it('el lunes a las 00:00 abre la semana y el domingo a las 23:59:59 todavía es la anterior', () => {
    expect(periodOf(new Date('2026-11-09T06:00:00.000Z'), 'WEEK').start).toBe('2026-11-09');
    expect(periodOf(new Date('2026-11-09T05:59:59.000Z'), 'WEEK').start).toBe('2026-11-02');
  });

  it('el día 1 a las 00:00 abre el mes y un segundo antes es del mes anterior', () => {
    expect(periodOf(new Date('2026-11-01T06:00:00.000Z'), 'MONTH').start).toBe('2026-11-01');
    expect(periodOf(new Date('2026-11-01T05:59:59.000Z'), 'MONTH').start).toBe('2026-10-01');
  });
});

describe('E7 · las ventas coinciden al centavo con los pagos', () => {
  const r = salesReport({ payments: PAGOS, sales: VENTAS, now: AHORA });

  it('hoy: 10,000 + 3,333 + 1,500 de la venta buena; la cancelada no cuenta', () => {
    expect(r.DAY.comparison.currentCents).toBe(14_833);
  });

  it('hoy se compara contra ayer: 25,050', () => {
    expect(r.DAY.previous).toMatchObject({ start: '2026-11-11', end: '2026-11-11' });
    expect(r.DAY.comparison.previousCents).toBe(25_050);
    expect(r.DAY.comparison.deltaCents).toBe(14_833 - 25_050);
    expect(r.DAY.comparison.trend).toBe('DOWN');
  });

  it('la semana: del lunes 9 a hoy, 10,000 + 25,050 + 3,333 + 7,777 + 1,500', () => {
    expect(r.WEEK.comparison.currentCents).toBe(47_660);
  });

  it('la semana se compara contra la anterior (2 al 8): solo el cobro del domingo 8', () => {
    expect(r.WEEK.previous).toMatchObject({ start: '2026-11-02', end: '2026-11-08' });
    expect(r.WEEK.comparison.previousCents).toBe(1_111);
  });

  it('el mes: todo lo de noviembre, incluido el cobro de las 00:00 del día 1', () => {
    // 10,000 + 25,050 + 3,333 + 7,777 + 1,111 + 5,000 + 1,500
    expect(r.MONTH.comparison.currentCents).toBe(53_771);
  });

  it('el mes se compara contra octubre: el cobro de un segundo antes de la medianoche', () => {
    expect(r.MONTH.previous).toMatchObject({ start: '2026-10-01', end: '2026-10-31' });
    expect(r.MONTH.comparison.previousCents).toBe(9_999);
    expect(r.MONTH.comparison.deltaCents).toBe(53_771 - 9_999);
  });

  it('un cobro de una venta cancelada no suma en ningún periodo', () => {
    const sinCancelar = salesReport({ payments: PAGOS, sales: [], now: AHORA });
    expect(sinCancelar.DAY.comparison.currentCents).toBe(14_833 + 4_000);
    expect(sinCancelar.MONTH.comparison.currentCents).toBe(53_771 + 4_000);
  });
});

describe('E7 · cobros por método y por persona', () => {
  it('el día de hoy separa efectivo y transferencia', () => {
    const hoy = collectionsByMethod({
      payments: PAGOS,
      sales: VENTAS,
      period: periodOf(AHORA, 'DAY'),
    });
    expect(hoy).toEqual({ cashCents: 13_333, transferCents: 1_500, totalCents: 14_833, count: 3 });
  });

  it('el mes por persona suma lo mismo que el mes completo', () => {
    const porPersona = collectionsByCashier({ payments: PAGOS, sales: VENTAS, now: AHORA }).MONTH;
    // Ana: 10,000 + 25,050 + 1,111.  Beto: 3,333 + 7,777 + 5,000 + 1,500.
    expect(porPersona.rows).toEqual([
      { userId: ANA, cashCents: 11_111, transferCents: 25_050, totalCents: 36_161, count: 3 },
      { userId: BETO, cashCents: 16_110, transferCents: 1_500, totalCents: 17_610, count: 4 },
    ]);
    expect(porPersona.totals.totalCents).toBe(36_161 + 17_610);
    expect(porPersona.totals.totalCents).toBe(53_771);
  });

  it('el total por persona de cada periodo coincide con las ventas del mismo periodo', () => {
    const ventas = salesReport({ payments: PAGOS, sales: VENTAS, now: AHORA });
    const personas = collectionsByCashier({ payments: PAGOS, sales: VENTAS, now: AHORA });
    expect(personas.DAY.totals.totalCents).toBe(ventas.DAY.comparison.currentCents);
    expect(personas.WEEK.totals.totalCents).toBe(ventas.WEEK.comparison.currentCents);
    expect(personas.MONTH.totals.totalCents).toBe(ventas.MONTH.comparison.currentCents);
  });
});

describe('E7 · la tendencia por día', () => {
  const dias = dailyIncomeTrend({ payments: PAGOS, sales: VENTAS, now: AHORA });
  const de = (dia: string): number => dias.find((d) => d.day === dia)?.totalCents ?? -1;

  it('cada cobro cae en su día de México', () => {
    expect(de('2026-11-12')).toBe(14_833);
    expect(de('2026-11-11')).toBe(25_050);
    expect(de('2026-11-09')).toBe(7_777);
    expect(de('2026-11-08')).toBe(1_111);
    expect(de('2026-11-01')).toBe(5_000);
    expect(de('2026-10-31')).toBe(9_999);
  });

  it('los días sin cobros salen en cero y la tendencia abarca los últimos 31 días', () => {
    expect(dias).toHaveLength(31);
    expect(dias[0]?.day).toBe('2026-10-13');
    expect(dias[30]?.day).toBe('2026-11-12');
    expect(de('2026-11-10')).toBe(0);
  });

  it('la suma de los 31 días es la suma de todos los pagos buenos', () => {
    const total = dias.reduce((s, d) => s + d.totalCents, 0);
    expect(total).toBe(53_771 + 9_999);
  });
});
