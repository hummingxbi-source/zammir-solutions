import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { outboxCounterSaleStore } from '../../counter/application/counter-sale-store';
import type { CounterSale } from '../../counter/domain/counter-sale';
import {
  outboxPaymentStore,
  outboxWorkOrderStore,
} from '../../orders/application/work-order-store';
import type { Warranty, WorkOrder } from '../../orders/domain/work-order';
import { outboxQuoteStore } from '../../quotes/application/quote-store';
import type { Quote } from '../../quotes/domain/quote';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import { loadCustomerHistory } from './load-customer-history';

const ANA = 'c-ana' as never;
const orden = (id: string, cliente: string, status: WorkOrder['status']) =>
  ({
    id,
    customerId: cliente,
    status,
    totalCents: 10_000,
    issuedAt: '2026-10-01T10:00:00.000Z',
  }) as unknown as WorkOrder;
const venta = (id: string, cliente: string) =>
  ({
    id,
    customerId: cliente,
    status: 'COMPLETED',
    totalCents: 5_000,
    issuedAt: '2026-10-02T10:00:00.000Z',
  }) as unknown as CounterSale;
const cotizacion = (id: string, cliente: string) =>
  ({ id, customerId: cliente, updatedAt: '2026-09-01T10:00:00.000Z' }) as unknown as Quote;
const garantia = (ordenId: string) => ({ workOrderId: ordenId }) as unknown as Warranty;

describe('cargar el historial de la tablet', () => {
  it('lee los almacenes de la tablet y trae las garantías de lo entregado', async () => {
    const outbox = inMemorySyncOutbox({ clock: fixedClock(new Date('2026-10-31T18:00:00.000Z')) });
    const orders = outboxWorkOrderStore(outbox);
    const quotes = outboxQuoteStore(outbox);
    const sales = outboxCounterSaleStore(outbox);
    const payments = outboxPaymentStore(outbox);
    await orders.save({ ...orden('o1', 'c-ana', 'DELIVERED'), id: 'o1' } as never);
    await orders.save({ ...orden('o2', 'c-beto', 'DELIVERED'), id: 'o2' } as never);
    await sales.save(venta('v1', 'c-ana'));
    await quotes.save(cotizacion('q1', 'c-ana'));
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
