import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import { outboxCounterSaleStore } from '../../counter/application/counter-sale-store';
import {
  outboxPaymentStore,
  outboxWorkOrderStore,
} from '../../orders/application/work-order-store';
import type { CounterSale } from '../../counter/domain/counter-sale';
import type { Warranty, WorkOrder } from '../../orders/domain/work-order';
import type { Payment } from '../../payments/domain/payment';
import type { Quote } from '../../quotes/domain/quote';
import { outboxQuoteStore } from '../../quotes/application/quote-store';
import { loadCustomerHistory } from '../application/load-customer-history';
import {
  buildCustomerHistory,
  RECURRING_MIN_DELIVERED_ORDERS,
  recurringCustomerIds,
} from './customer-history';

const ANA = 'c-ana' as never;
const BETO = 'c-beto' as never;

const orden = (
  id: string,
  cliente: string,
  status: WorkOrder['status'],
  total = 10_000,
  issuedAt = '2026-10-01T10:00:00.000Z',
) => ({ id, customerId: cliente, status, totalCents: total, issuedAt }) as unknown as WorkOrder;
const venta = (
  id: string,
  cliente: string | null,
  status: CounterSale['status'] = 'COMPLETED',
  total = 5_000,
) =>
  ({
    id,
    customerId: cliente,
    status,
    totalCents: total,
    issuedAt: '2026-10-02T10:00:00.000Z',
  }) as unknown as CounterSale;
const cotizacion = (id: string, cliente: string | null, updatedAt = '2026-09-01T10:00:00.000Z') =>
  ({ id, customerId: cliente, updatedAt }) as unknown as Quote;
const pago = (
  id: string,
  tipo: Payment['targetType'],
  destino: string,
  paidAt = '2026-10-03T10:00:00.000Z',
) =>
  ({ id, targetType: tipo, targetId: destino, paidAt, amountCents: 1_000 }) as unknown as Payment;
const garantia = (ordenId: string) => ({ workOrderId: ordenId }) as unknown as Warranty;

describe('clientes recurrentes', () => {
  it('con dos órdenes entregadas ya es recurrente; con una no', () => {
    expect(RECURRING_MIN_DELIVERED_ORDERS).toBe(2);
    const ids = recurringCustomerIds([
      orden('1', 'c-ana', 'DELIVERED'),
      orden('2', 'c-ana', 'DELIVERED'),
      orden('3', 'c-beto', 'DELIVERED'),
    ]);
    expect([...ids]).toEqual(['c-ana']);
  });

  it('las canceladas y las que siguen en proceso no cuentan', () => {
    const ids = recurringCustomerIds([
      orden('1', 'c-ana', 'DELIVERED'),
      orden('2', 'c-ana', 'CANCELLED'),
      orden('3', 'c-ana', 'READY'),
      orden('4', 'c-ana', 'WAITING'),
    ]);
    expect(ids.size).toBe(0);
  });

  it('el mínimo se puede cambiar', () => {
    const ordenes = [orden('1', 'c-ana', 'DELIVERED')];
    expect(recurringCustomerIds(ordenes, 1).has(ANA)).toBe(true);
  });
});

describe('historial de un cliente', () => {
  const fuentes = {
    quotes: [cotizacion('q1', 'c-ana'), cotizacion('q2', 'c-beto'), cotizacion('q3', null)],
    orders: [
      orden('o1', 'c-ana', 'DELIVERED', 20_000, '2026-09-01T10:00:00.000Z'),
      orden('o2', 'c-ana', 'DELIVERED', 30_000, '2026-10-01T10:00:00.000Z'),
      orden('o3', 'c-ana', 'CANCELLED', 99_000, '2026-08-01T10:00:00.000Z'),
      orden('o4', 'c-beto', 'DELIVERED', 7_000),
    ],
    sales: [
      venta('v1', 'c-ana', 'COMPLETED', 4_000),
      venta('v2', 'c-ana', 'CANCELLED', 8_000),
      venta('v3', null),
      venta('v4', 'c-beto'),
    ],
    payments: [
      pago('p1', 'WORK_ORDER', 'o1', '2026-09-02T10:00:00.000Z'),
      pago('p2', 'WORK_ORDER', 'o4'),
      pago('p3', 'COUNTER_SALE', 'v1', '2026-10-05T10:00:00.000Z'),
      pago('p4', 'COUNTER_SALE', 'v3'),
      pago('p5', 'COUNTER_SALE', 'o1'),
    ],
    warranties: [garantia('o1'), garantia('o4')],
  };

  it('trae lo de ese cliente y nada de nadie más', () => {
    const h = buildCustomerHistory(ANA, fuentes);
    expect(h.quotes.map((q) => q.id)).toEqual(['q1']);
    expect(h.orders.map((o) => o.id)).toEqual(['o2', 'o1', 'o3']);
    expect(h.sales.map((v) => v.id)).toEqual(['v1', 'v2']);
    expect(h.payments.map((p) => p.id)).toEqual(['p3', 'p1']);
    expect(h.warranties.map((w) => w.workOrderId)).toEqual(['o1']);
  });

  it('un pago de venta con el id de una orden no se mezcla', () => {
    const h = buildCustomerHistory(ANA, fuentes);
    expect(h.payments.some((p) => p.id === 'p5')).toBe(false);
  });

  it('cuenta las entregadas, marca recurrente y suma lo comprado sin canceladas', () => {
    const h = buildCustomerHistory(ANA, fuentes);
    expect(h.deliveredOrders).toBe(2);
    expect(h.recurring).toBe(true);
    expect(h.totalPurchasedCents).toBe(20_000 + 30_000 + 4_000);
    const b = buildCustomerHistory(BETO, fuentes);
    expect(b.recurring).toBe(false);
    expect(b.totalPurchasedCents).toBe(7_000 + 5_000);
  });

  it('un cliente sin nada tiene la ficha vacía', () => {
    const h = buildCustomerHistory('c-nadie' as never, fuentes);
    expect(h).toMatchObject({
      quotes: [],
      orders: [],
      sales: [],
      payments: [],
      warranties: [],
      deliveredOrders: 0,
      recurring: false,
      totalPurchasedCents: 0,
    });
  });

  it('propiedad: nunca entra nada que no sea del cliente', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            c: fc.constantFrom('c-ana', 'c-beto', null),
            s: fc.constantFrom('DELIVERED', 'CANCELLED', 'READY'),
          }),
          { maxLength: 12 },
        ),
        (filas) => {
          const ordenes = filas.map((f, i) =>
            orden(`o${String(i)}`, f.c ?? 'c-otro', f.s as WorkOrder['status']),
          );
          const h = buildCustomerHistory(ANA, { ...fuentes, orders: ordenes });
          expect(h.orders.every((o) => o.customerId === ANA)).toBe(true);
          expect(h.deliveredOrders).toBe(h.orders.filter((o) => o.status === 'DELIVERED').length);
        },
      ),
    );
  });
});

describe('cargar el historial de la tablet', () => {
  it('lee los almacenes de la tablet y trae las garantías de lo entregado', async () => {
    const outbox = inMemorySyncOutbox({ clock: fixedClock(new Date('2026-10-31T18:00:00.000Z')) });
    const orders = outboxWorkOrderStore(outbox);
    const quotes = outboxQuoteStore(outbox);
    const sales = outboxCounterSaleStore(outbox);
    const payments = outboxPaymentStore(outbox);
    await orders.save({ ...orden('o1', 'c-ana', 'DELIVERED'), id: 'o1' } as never);
    await orders.save({ ...orden('o2', 'c-beto', 'DELIVERED'), id: 'o2' } as never);
    await sales.save(venta('v1', 'c-ana') as never);
    await quotes.save(cotizacion('q1', 'c-ana') as never);
    const h = await loadCustomerHistory(
      {
        quotes,
        orders,
        sales,
        payments,
        warranties: { get: (id) => Promise.resolve(id === 'o1' ? garantia('o1') : null) },
      },
      ANA,
    );
    expect(h.orders.map((o) => o.id)).toEqual(['o1']);
    expect(h.sales.map((v) => v.id)).toEqual(['v1']);
    expect(h.quotes.map((q) => q.id)).toEqual(['q1']);
    expect(h.warranties).toHaveLength(1);
  });
});
