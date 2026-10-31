import type { CustomerId } from '../../../shared-kernel/id';
import type { CounterSale } from '../../counter/domain/counter-sale';
import type { Warranty, WorkOrder } from '../../orders/domain/work-order';
import type { Payment } from '../../payments/domain/payment';
import type { Quote } from '../../quotes/domain/quote';

/** Cuántas órdenes entregadas hacen a un cliente "recurrente". Es una definición mía mientras Luis no
 *  diga otra: se cambia aquí y en la pregunta del cuestionario. */
export const RECURRING_MIN_DELIVERED_ORDERS = 2;

/** Todo lo que la tablet sabe de un cliente, y nada de nadie más [S3-25]. */
export interface CustomerHistory {
  readonly customerId: CustomerId;
  /** De la más reciente a la más antigua. */
  readonly quotes: readonly Quote[];
  readonly orders: readonly WorkOrder[];
  readonly sales: readonly CounterSale[];
  /** Pagos de sus órdenes y de sus ventas. */
  readonly payments: readonly Payment[];
  readonly warranties: readonly Warranty[];
  /** Órdenes entregadas (las canceladas y las cotizaciones no cuentan). */
  readonly deliveredOrders: number;
  readonly recurring: boolean;
  /** Lo que ha comprado de verdad: órdenes no canceladas y ventas completadas, en centavos. */
  readonly totalPurchasedCents: number;
}

export interface CustomerHistorySources {
  readonly quotes: readonly Quote[];
  readonly orders: readonly WorkOrder[];
  readonly sales: readonly CounterSale[];
  readonly payments: readonly Payment[];
  readonly warranties: readonly Warranty[];
}

const masRecienteAntes =
  <T>(instante: (x: T) => string) =>
  (a: T, b: T) =>
    instante(b).localeCompare(instante(a));

/** Cuenta las órdenes entregadas de cada cliente y devuelve los que llegan al mínimo. Es la vista de
 *  "clientes recurrentes". */
export function recurringCustomerIds(
  orders: readonly Pick<WorkOrder, 'customerId' | 'status'>[],
  minimo: number = RECURRING_MIN_DELIVERED_ORDERS,
): ReadonlySet<CustomerId> {
  const entregadas = new Map<CustomerId, number>();
  for (const o of orders) {
    if (o.status === 'DELIVERED') {
      entregadas.set(o.customerId, (entregadas.get(o.customerId) ?? 0) + 1);
    }
  }
  return new Set([...entregadas].filter(([, n]) => n >= minimo).map(([id]) => id));
}

/** Arma la ficha de un cliente. Solo entra lo que es suyo: sus cotizaciones, sus órdenes, sus ventas con su
 *  nombre, los pagos de esas órdenes y ventas, y las garantías de esas órdenes. */
export function buildCustomerHistory(
  customerId: CustomerId,
  fuentes: CustomerHistorySources,
): CustomerHistory {
  const quotes = fuentes.quotes
    .filter((q) => q.customerId === customerId)
    .sort(masRecienteAntes((q) => q.updatedAt));
  const orders = fuentes.orders
    .filter((o) => o.customerId === customerId)
    .sort(masRecienteAntes((o) => o.issuedAt));
  const sales = fuentes.sales
    .filter((v) => v.customerId === customerId)
    .sort(masRecienteAntes((v) => v.issuedAt));
  const ordenIds = new Set<string>(orders.map((o) => o.id));
  const ventaIds = new Set(sales.map((v) => v.id));
  const payments = fuentes.payments
    .filter(
      (p) =>
        (p.targetType === 'WORK_ORDER' && ordenIds.has(p.targetId)) ||
        (p.targetType === 'COUNTER_SALE' && ventaIds.has(p.targetId)),
    )
    .sort(masRecienteAntes((p) => p.paidAt));
  const warranties = fuentes.warranties.filter((w) => ordenIds.has(w.workOrderId));
  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED').length;
  const totalPurchasedCents =
    orders.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + o.totalCents, 0) +
    sales.filter((v) => v.status === 'COMPLETED').reduce((s, v) => s + v.totalCents, 0);
  return {
    customerId,
    quotes,
    orders,
    sales,
    payments,
    warranties,
    deliveredOrders,
    recurring: deliveredOrders >= RECURRING_MIN_DELIVERED_ORDERS,
    totalPurchasedCents,
  };
}
