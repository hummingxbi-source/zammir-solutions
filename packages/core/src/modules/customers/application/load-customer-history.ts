import type { CustomerId } from '../../../shared-kernel/id';
import type { CounterSaleStore } from '../../counter/application/counter-sale-store';
import type { outboxWarrantyReader } from '../../orders/application/work-order-store';
import type { PaymentStore, WorkOrderStore } from '../../orders/application/work-order-store';
import type { Warranty } from '../../orders/domain/work-order';
import type { QuoteStore } from '../../quotes/application/quote-store';
import { buildCustomerHistory, type CustomerHistory } from '../domain/customer-history';

export interface CustomerHistoryDeps {
  readonly quotes: QuoteStore;
  readonly orders: WorkOrderStore;
  readonly sales: CounterSaleStore;
  readonly payments: PaymentStore;
  readonly warranties: Pick<ReturnType<typeof outboxWarrantyReader>, 'get'>;
}

/** Reúne de la tablet lo de un cliente. Las garantías se piden solo de sus órdenes entregadas. */
export async function loadCustomerHistory(
  deps: CustomerHistoryDeps,
  customerId: CustomerId,
): Promise<CustomerHistory> {
  const [quotes, orders, sales, payments] = await Promise.all([
    deps.quotes.listByCustomer(customerId),
    deps.orders.listByCustomer(customerId),
    deps.sales.list(),
    deps.payments.list(),
  ]);
  const garantias: Warranty[] = [];
  for (const o of orders) {
    if (o.status === 'DELIVERED') {
      const g = await deps.warranties.get(o.id);
      if (g !== null) {
        garantias.push(g);
      }
    }
  }
  return buildCustomerHistory(customerId, {
    quotes,
    orders,
    sales,
    payments,
    warranties: garantias,
  });
}
