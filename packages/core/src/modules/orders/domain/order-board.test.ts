import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  countByStatus,
  filterWorkOrders,
  isWorkOrderLate,
  summarizeOrders,
  WORK_ORDER_STATUSES,
} from './order-board';
import type { WorkOrder, WorkOrderStatus } from './work-order';

function orden(id: string, c: Record<string, unknown> = {}): WorkOrder {
  return {
    id,
    status: 'WAITING',
    customerId: 'c1',
    measuredBy: null,
    builtBy: null,
    installedBy: null,
    issuedAt: '2026-10-15T18:00:00.000Z',
    totalCents: 10_000,
    ...c,
  } as unknown as WorkOrder;
}

const todas = [
  orden('a', { status: 'WAITING', customerId: 'c1', measuredBy: 'u1' }),
  orden('b', {
    status: 'IN_PROCESS',
    customerId: 'c2',
    builtBy: 'u1',
    issuedAt: '2026-10-20T18:00:00.000Z',
  }),
  orden('c', {
    status: 'READY',
    customerId: 'c1',
    installedBy: 'u2',
    issuedAt: '2026-11-02T18:00:00.000Z',
  }),
  orden('d', { status: 'DELIVERED', customerId: 'c3', issuedAt: '2026-11-03T05:30:00.000Z' }),
  orden('e', { status: 'CANCELLED', customerId: 'c1' }),
];
const ids = (xs: readonly WorkOrder[]) => xs.map((o) => o.id);

describe('filtros del tablero', () => {
  it('sin filtros devuelve todo', () => {
    expect(ids(filterWorkOrders(todas, {}))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('por estatus, por cliente y por responsable (cualquiera de los tres)', () => {
    expect(ids(filterWorkOrders(todas, { status: 'READY' }))).toEqual(['c']);
    expect(ids(filterWorkOrders(todas, { customerId: 'c1' }))).toEqual(['a', 'c', 'e']);
    expect(ids(filterWorkOrders(todas, { responsibleId: 'u1' }))).toEqual(['a', 'b']);
    expect(ids(filterWorkOrders(todas, { responsibleId: 'u2' }))).toEqual(['c']);
  });

  it('por fechas, en hora de México y con ambos extremos incluidos', () => {
    expect(ids(filterWorkOrders(todas, { fromDate: '2026-10-20', toDate: '2026-11-02' }))).toEqual([
      'b',
      'c',
      'd',
    ]);
    // 5:30 UTC del 3 de noviembre todavía es 2 de noviembre en México (23:30).
    expect(ids(filterWorkOrders(todas, { fromDate: '2026-11-02', toDate: '2026-11-02' }))).toEqual([
      'c',
      'd',
    ]);
  });

  it('combinados devuelven la intersección', () => {
    expect(
      ids(filterWorkOrders(todas, { customerId: 'c1', status: 'WAITING', responsibleId: 'u1' })),
    ).toEqual(['a']);
    expect(ids(filterWorkOrders(todas, { customerId: 'c2', status: 'WAITING' }))).toEqual([]);
  });

  it('propiedad: filtrar con varios criterios es filtrar con cada uno y quedarse con lo común', () => {
    const estatus = fc.constantFrom<WorkOrderStatus | null>(...WORK_ORDER_STATUSES, null);
    const cliente = fc.constantFrom<string | null>('c1', 'c2', 'c3', null);
    const persona = fc.constantFrom<string | null>('u1', 'u2', null);
    fc.assert(
      fc.property(estatus, cliente, persona, (status, customerId, responsibleId) => {
        const junto = ids(filterWorkOrders(todas, { status, customerId, responsibleId }));
        const a = new Set(ids(filterWorkOrders(todas, { status })));
        const b = new Set(ids(filterWorkOrders(todas, { customerId })));
        const c = new Set(ids(filterWorkOrders(todas, { responsibleId })));
        const comun = ids(todas).filter((id) => a.has(id) && b.has(id) && c.has(id));
        expect(junto).toEqual(comun);
      }),
    );
  });
});

describe('conteo y resumen', () => {
  it('cuenta por estatus y la suma es el total de órdenes', () => {
    const conteo = countByStatus(todas);
    expect(conteo).toEqual({ WAITING: 1, IN_PROCESS: 1, READY: 1, DELIVERED: 1, CANCELLED: 1 });
    expect(Object.values(conteo).reduce((s, n) => s + n, 0)).toBe(todas.length);
  });

  it('el valor en producción suma lo que está en espera o en proceso; lo cancelado y lo entregado no', () => {
    const r = summarizeOrders(todas, () => 0);
    expect(r.inProductionCents).toBe(20_000);
  });

  it('el saldo por cobrar es solo el de lo listo, calculado con los pagos', () => {
    const saldos: Record<string, number> = { a: 5_000, b: 5_000, c: 4_000, d: 3_000 };
    const r = summarizeOrders(todas, (id) => saldos[id] ?? 0);
    expect(r.readyBalanceCents).toBe(4_000);
  });

  it('un saldo negativo (pago de más por revisar) no resta', () => {
    expect(summarizeOrders([orden('c', { status: 'READY' })], () => -500).readyBalanceCents).toBe(
      0,
    );
  });

  it('propiedad: el resumen nunca es negativo', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1000, max: 50_000 }), { maxLength: 20 }),
        (saldos) => {
          const lista = saldos.map((_, i) => orden(String(i), { status: 'READY' }));
          const r = summarizeOrders(lista, (id) => saldos[Number(id)] ?? 0);
          expect(r.readyBalanceCents).toBeGreaterThanOrEqual(0);
          expect(r.inProductionCents).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

describe('órdenes atrasadas [RF-M3-09, ADR-0044]', () => {
  const conFecha = (status: string, fecha: string | null) =>
    orden('x', { status, estimatedDeliveryDate: fecha });

  it('el mismo día de su fecha todavía no va atrasada; al día siguiente sí', () => {
    expect(isWorkOrderLate(conFecha('IN_PROCESS', '2026-11-10'), '2026-11-10')).toBe(false);
    expect(isWorkOrderLate(conFecha('IN_PROCESS', '2026-11-10'), '2026-11-11')).toBe(true);
    expect(isWorkOrderLate(conFecha('IN_PROCESS', '2026-11-10'), '2026-11-09')).toBe(false);
  });

  it.each(['WAITING', 'IN_PROCESS', 'READY'])('en %s y con la fecha pasada va atrasada', (s) => {
    expect(isWorkOrderLate(conFecha(s, '2026-11-01'), '2026-12-01')).toBe(true);
  });

  it.each(['DELIVERED', 'CANCELLED'])('entregada o cancelada nunca va atrasada (%s)', (s) => {
    expect(isWorkOrderLate(conFecha(s, '2026-11-01'), '2026-12-01')).toBe(false);
  });

  it('sin fecha (orden de antes del cambio) no se juzga, ni con el campo ausente', () => {
    expect(isWorkOrderLate(conFecha('WAITING', null), '2099-01-01')).toBe(false);
    expect(isWorkOrderLate(orden('y', { status: 'WAITING' }), '2099-01-01')).toBe(false);
  });

  it('el cambio de mes y de año se compara como fecha, no como texto suelto', () => {
    expect(isWorkOrderLate(conFecha('READY', '2026-12-31'), '2027-01-01')).toBe(true);
    expect(isWorkOrderLate(conFecha('READY', '2026-09-30'), '2026-10-01')).toBe(true);
  });

  it('el filtro de atrasadas se combina con los demás', () => {
    const lista = [
      orden('1', { status: 'WAITING', customerId: 'c1', estimatedDeliveryDate: '2026-11-01' }),
      orden('2', { status: 'READY', customerId: 'c2', estimatedDeliveryDate: '2026-11-01' }),
      orden('3', { status: 'WAITING', customerId: 'c1', estimatedDeliveryDate: '2026-12-31' }),
      orden('4', { status: 'DELIVERED', customerId: 'c1', estimatedDeliveryDate: '2026-11-01' }),
    ];
    const hoy = { today: '2026-11-15' };
    expect(filterWorkOrders(lista, { overdue: hoy }).map((o) => o.id)).toEqual(['1', '2']);
    expect(filterWorkOrders(lista, { overdue: hoy, customerId: 'c1' }).map((o) => o.id)).toEqual([
      '1',
    ]);
    expect(filterWorkOrders(lista, { overdue: null }).map((o) => o.id)).toHaveLength(4);
  });

  it('propiedad: atrasada si y solo si está viva y hoy es posterior a su fecha', () => {
    const dia = fc
      .date({ min: new Date('2020-01-01'), max: new Date('2035-12-31'), noInvalidDate: true })
      .map((d) => d.toISOString().slice(0, 10));
    fc.assert(
      fc.property(fc.constantFrom(...WORK_ORDER_STATUSES), dia, dia, (status, fecha, hoy) => {
        const viva = status !== 'DELIVERED' && status !== 'CANCELLED';
        expect(isWorkOrderLate(conFecha(status, fecha), hoy)).toBe(viva && hoy > fecha);
      }),
    );
  });
});
