import { mexicoDate } from '../../../shared-kernel/date/mx-date';
import type { CounterSale } from '../../counter/domain/counter-sale';
import type { WorkOrder, WorkOrderStatus } from '../../orders/domain/work-order';
import type { Payment } from '../../payments/domain/payment';
import { buildReceivables, type ReceivableRow } from '../../receivables/domain/receivables';
import { compareAmounts, type Comparison } from './comparison';
import {
  comparisonPeriod,
  inPeriod,
  periodOf,
  type ComparisonMode,
  type Period,
  type PeriodKind,
} from './periods';

export const PERIOD_KINDS: readonly PeriodKind[] = ['DAY', 'WEEK', 'MONTH'];

type PagoDeReporte = Pick<
  Payment,
  'targetType' | 'targetId' | 'amountCents' | 'paidAt' | 'userId' | 'method'
>;

/** Pagos que cuentan en los reportes: todos los recibidos, salvo los de una venta cancelada, igual que en el
 *  corte de caja (PD-24 sin respuesta: la cancelación se muestra aparte y no suma). */
export function countedPayments<P extends Pick<Payment, 'targetType' | 'targetId'>>(
  pagos: readonly P[],
  ventasCanceladas: ReadonlySet<string>,
): readonly P[] {
  return pagos.filter(
    (p) => !(p.targetType === 'COUNTER_SALE' && ventasCanceladas.has(p.targetId)),
  );
}

export function cancelledSaleIds(
  ventas: readonly Pick<CounterSale, 'id' | 'status'>[],
): Set<string> {
  return new Set(ventas.filter((v) => v.status === 'CANCELLED').map((v) => v.id));
}

const suma = (pagos: readonly Pick<Payment, 'amountCents'>[]): number =>
  pagos.reduce((s, p) => s + p.amountCents, 0);

// ---------------------------------------------------------------------------------------------------------
// S4-05 · Ventas con comparativo
// ---------------------------------------------------------------------------------------------------------

export interface SalesPeriodReport {
  readonly period: Period;
  readonly previous: Period;
  readonly comparison: Comparison;
}

/** "Ventas" es el efectivo recibido: ventas de mostrador más pagos de órdenes, en el periodo (RN-20, PD-08).
 *  Cada periodo se compara contra el anterior [RF-M7-01]. */
export function salesReport(entrada: {
  readonly payments: readonly PagoDeReporte[];
  readonly sales: readonly Pick<CounterSale, 'id' | 'status'>[];
  readonly now: Date;
  readonly mode?: ComparisonMode;
}): Readonly<Record<PeriodKind, SalesPeriodReport>> {
  const validos = countedPayments(entrada.payments, cancelledSaleIds(entrada.sales));
  const hoy = mexicoDate(entrada.now);
  const hacer = (kind: PeriodKind): SalesPeriodReport => {
    const period = periodOf(entrada.now, kind);
    const previous = comparisonPeriod(period, hoy, entrada.mode ?? 'FULL_PERIOD');
    return {
      period,
      previous,
      comparison: compareAmounts(
        suma(validos.filter((p) => inPeriod(p.paidAt, period))),
        suma(validos.filter((p) => inPeriod(p.paidAt, previous))),
      ),
    };
  };
  return { DAY: hacer('DAY'), WEEK: hacer('WEEK'), MONTH: hacer('MONTH') };
}

// ---------------------------------------------------------------------------------------------------------
// S4-06 · Productos más vendidos
// ---------------------------------------------------------------------------------------------------------

export interface ProductRow {
  /** Producto del catálogo, o el nombre del concepto cuando la línea es a medida. */
  readonly key: string;
  readonly name: string;
  readonly quantity: number;
  readonly amountCents: number;
}

export interface TopProducts {
  readonly period: Period;
  readonly byAmount: readonly ProductRow[];
  readonly byQuantity: readonly ProductRow[];
}

interface LineaVendida {
  readonly productId: string | null;
  readonly name: string;
  readonly quantity: number;
  readonly lineTotalCents: number;
}

/** Lo vendido en un periodo: líneas de ventas de mostrador completadas y de órdenes no canceladas hechas en
 *  el periodo. Ordena por importe y por cantidad; a igualdad, por nombre, para que el orden sea estable. */
export function topProducts(entrada: {
  readonly sales: readonly (Pick<CounterSale, 'status' | 'issuedAt'> & {
    readonly lines: readonly LineaVendida[];
  })[];
  readonly orders: readonly (Pick<WorkOrder, 'status' | 'issuedAt'> & {
    readonly lines: readonly LineaVendida[];
  })[];
  readonly period: Period;
  readonly limit?: number;
}): TopProducts {
  const lineas: LineaVendida[] = [
    ...entrada.sales
      .filter((v) => v.status === 'COMPLETED' && inPeriod(v.issuedAt, entrada.period))
      .flatMap((v) => v.lines),
    ...entrada.orders
      .filter((o) => o.status !== 'CANCELLED' && inPeriod(o.issuedAt, entrada.period))
      .flatMap((o) => o.lines),
  ];
  const grupos = new Map<string, ProductRow>();
  for (const l of lineas) {
    const key = l.productId ?? `nombre:${l.name}`;
    const previo = grupos.get(key);
    grupos.set(key, {
      key,
      name: previo?.name ?? l.name,
      quantity: (previo?.quantity ?? 0) + l.quantity,
      amountCents: (previo?.amountCents ?? 0) + l.lineTotalCents,
    });
  }
  const filas = [...grupos.values()];
  const limite = entrada.limit ?? 10;
  const por = (a: ProductRow, b: ProductRow, campo: 'amountCents' | 'quantity'): number =>
    b[campo] - a[campo] || a.name.localeCompare(b.name, 'es');
  return {
    period: entrada.period,
    byAmount: [...filas].sort((a, b) => por(a, b, 'amountCents')).slice(0, limite),
    byQuantity: [...filas].sort((a, b) => por(a, b, 'quantity')).slice(0, limite),
  };
}

// ---------------------------------------------------------------------------------------------------------
// S4-07 · Trabajos por estatus
// ---------------------------------------------------------------------------------------------------------

export interface StatusRow {
  readonly status: WorkOrderStatus;
  readonly count: number;
  readonly valueCents: number;
  /** Sigue en producción (espera, proceso o lista para entregar). */
  readonly pending: boolean;
}

const ESTATUS: readonly WorkOrderStatus[] = [
  'WAITING',
  'IN_PROCESS',
  'READY',
  'DELIVERED',
  'CANCELLED',
];

export function ordersByStatus(
  ordenes: readonly Pick<WorkOrder, 'status' | 'totalCents'>[],
): readonly StatusRow[] {
  return ESTATUS.map((status) => {
    const delEstatus = ordenes.filter((o) => o.status === status);
    return {
      status,
      count: delEstatus.length,
      valueCents: delEstatus.reduce((s, o) => s + o.totalCents, 0),
      pending: status === 'WAITING' || status === 'IN_PROCESS' || status === 'READY',
    };
  });
}

// ---------------------------------------------------------------------------------------------------------
// S4-08 · Antigüedad de las cuentas por cobrar
// ---------------------------------------------------------------------------------------------------------

export interface AgingBucket {
  /** `null` en el último tramo (sin tope) y en el de fechas inválidas. */
  readonly fromDays: number | null;
  readonly toDays: number | null;
  readonly count: number;
  readonly balanceCents: number;
  /** Desde el umbral de atraso en adelante. */
  readonly overdue: boolean;
  readonly undated: boolean;
}

/** Agrupa las cuentas por antigüedad en tramos del tamaño del umbral configurado (PD-33): con 10 días, de
 *  0 a 9, de 10 a 19 y de 20 en adelante. Del umbral en adelante se resalta. Las de fecha inválida van
 *  aparte, sin días. */
export function receivablesAging(
  filas: readonly ReceivableRow[],
  umbral: number,
): readonly AgingBucket[] {
  const paso = Math.max(1, umbral);
  const tramo = (f: ReceivableRow): number =>
    f.daysOutstanding === null ? -1 : Math.min(2, Math.floor(f.daysOutstanding / paso));
  const construir = (n: number): AgingBucket => {
    const delTramo = filas.filter((f) => tramo(f) === n);
    return {
      fromDays: n < 0 ? null : n * paso,
      toDays: n < 0 || n === 2 ? null : (n + 1) * paso - 1,
      count: delTramo.length,
      balanceCents: delTramo.reduce((s, f) => s + f.balanceCents, 0),
      overdue: n >= 1,
      undated: n < 0,
    };
  };
  const tramos = [0, 1, 2].map(construir);
  const sinFecha = construir(-1);
  return sinFecha.count > 0 ? [...tramos, sinFecha] : tramos;
}

export function receivablesAgingReport(entrada: {
  readonly orders: Parameters<typeof buildReceivables>[0]['orders'];
  readonly payments: Parameters<typeof buildReceivables>[0]['payments'];
  readonly now: Date;
  readonly overdueDays: number;
}): readonly AgingBucket[] {
  return receivablesAging(
    buildReceivables({
      orders: entrada.orders,
      payments: entrada.payments,
      today: mexicoDate(entrada.now),
      overdueDays: entrada.overdueDays,
    }),
    entrada.overdueDays,
  );
}

// ---------------------------------------------------------------------------------------------------------
// S4-09 y S4-10 · Cobros por cajero y por método
// ---------------------------------------------------------------------------------------------------------

export interface MethodTotals {
  readonly cashCents: number;
  readonly transferCents: number;
  readonly totalCents: number;
  readonly count: number;
}

export interface CashierRow extends MethodTotals {
  readonly userId: string;
}

export interface CashierCollections {
  readonly period: Period;
  readonly rows: readonly CashierRow[];
  readonly totals: MethodTotals;
}

function porMetodo(pagos: readonly Pick<Payment, 'method' | 'amountCents'>[]): MethodTotals {
  const efectivo = suma(pagos.filter((p) => p.method === 'CASH'));
  const transferencia = suma(pagos.filter((p) => p.method === 'TRANSFER'));
  return {
    cashCents: efectivo,
    transferCents: transferencia,
    totalCents: efectivo + transferencia,
    count: pagos.length,
  };
}

/** Cobros de un periodo separados por método de pago [RF-M7-06, RN-10]. */
export function collectionsByMethod(entrada: {
  readonly payments: readonly PagoDeReporte[];
  readonly sales: readonly Pick<CounterSale, 'id' | 'status'>[];
  readonly period: Period;
}): MethodTotals {
  return porMetodo(
    countedPayments(entrada.payments, cancelledSaleIds(entrada.sales)).filter((p) =>
      inPeriod(p.paidAt, entrada.period),
    ),
  );
}

/** Cobros de hoy, la semana y el mes, sumados por quien cobró [RF-M7-05, RN-11]. */
export function collectionsByCashier(entrada: {
  readonly payments: readonly PagoDeReporte[];
  readonly sales: readonly Pick<CounterSale, 'id' | 'status'>[];
  readonly now: Date;
}): Readonly<Record<PeriodKind, CashierCollections>> {
  const validos = countedPayments(entrada.payments, cancelledSaleIds(entrada.sales));
  const hacer = (kind: PeriodKind): CashierCollections => {
    const period = periodOf(entrada.now, kind);
    const delPeriodo = validos.filter((p) => inPeriod(p.paidAt, period));
    const personas = [...new Set(delPeriodo.map((p) => p.userId))];
    const rows = personas
      .map((userId) => ({ userId, ...porMetodo(delPeriodo.filter((p) => p.userId === userId)) }))
      .sort((a, b) => b.totalCents - a.totalCents || a.userId.localeCompare(b.userId));
    return { period, rows, totals: porMetodo(delPeriodo) };
  };
  return { DAY: hacer('DAY'), WEEK: hacer('WEEK'), MONTH: hacer('MONTH') };
}
