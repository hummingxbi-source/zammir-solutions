import { mexicoDate } from '../../../shared-kernel/date/mx-date';
import type { WorkOrder, WorkOrderStatus } from './work-order';

export const WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = [
  'WAITING',
  'IN_PROCESS',
  'READY',
  'DELIVERED',
  'CANCELLED',
];

/** Filtros del tablero de órdenes [RF-M3-07]. Todo lo que se da se combina: el resultado es la intersección. */
export interface OrderFilter {
  readonly status?: WorkOrderStatus | null;
  readonly customerId?: string | null;
  /** Cualquiera de los tres responsables (mide, fabrica, instala). */
  readonly responsibleId?: string | null;
  /** Fecha de creación, desde y hasta (`AAAA-MM-DD`, hora de México, ambos incluidos) [RN-17]. */
  readonly fromDate?: string | null;
  readonly toDate?: string | null;
  /** Solo las atrasadas [RF-M3-09]; `today` es el día en México con que se juzga el atraso. */
  readonly overdue?: { readonly today: string } | null;
}

/** ¿Va atrasada? Hoy (día en México) ya pasó su fecha estimada y no se ha entregado ni cancelado
 *  [RF-M3-09, ADR-0044]. Se calcula, no se guarda [ADR-0015]. Sin fecha (orden vieja), no se juzga. */
export function isWorkOrderLate(
  orden: Pick<WorkOrder, 'status' | 'estimatedDeliveryDate'>,
  today: string,
): boolean {
  if (orden.status === 'DELIVERED' || orden.status === 'CANCELLED') {
    return false;
  }
  // Un documento guardado antes de RF-M3-09 puede no traer el campo.
  const fecha = orden.estimatedDeliveryDate ?? null;
  return fecha !== null && today > fecha;
}

const hay = (v: string | null | undefined): v is string =>
  v !== null && v !== undefined && v !== '';

/** Filtra las órdenes; las fechas se comparan por el día en México, no por la hora UTC. */
export function filterWorkOrders(
  ordenes: readonly WorkOrder[],
  filtro: OrderFilter,
): readonly WorkOrder[] {
  return ordenes.filter((o) => {
    if (hay(filtro.status) && o.status !== filtro.status) {
      return false;
    }
    if (
      filtro.overdue !== null &&
      filtro.overdue !== undefined &&
      !isWorkOrderLate(o, filtro.overdue.today)
    ) {
      return false;
    }
    if (hay(filtro.customerId) && o.customerId !== filtro.customerId) {
      return false;
    }
    if (
      hay(filtro.responsibleId) &&
      o.measuredBy !== filtro.responsibleId &&
      o.builtBy !== filtro.responsibleId &&
      o.installedBy !== filtro.responsibleId
    ) {
      return false;
    }
    if (hay(filtro.fromDate) || hay(filtro.toDate)) {
      const dia = mexicoDate(new Date(o.issuedAt));
      if (hay(filtro.fromDate) && dia < filtro.fromDate) {
        return false;
      }
      if (hay(filtro.toDate) && dia > filtro.toDate) {
        return false;
      }
    }
    return true;
  });
}

/** Las partes de un trabajo que se entrega por partes: las órdenes "por partes" de la misma cotización, en el
 *  orden en que se crearon [RF-M3-10]. */
export function partsOf<
  O extends Pick<WorkOrder, 'id' | 'quoteId' | 'inParts' | 'issuedAt' | 'tempFolio'>,
>(orden: Pick<WorkOrder, 'quoteId' | 'inParts'>, ordenes: readonly O[]): readonly O[] {
  if (orden.inParts !== true || orden.quoteId === null) {
    return [];
  }
  return ordenes
    .filter((o) => o.inParts === true && o.quoteId === orden.quoteId)
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.tempFolio.localeCompare(b.tempFolio));
}

/** Qué número de parte es (1, 2…); `null` si no se entrega por partes. */
export function partNumber(
  orden: Pick<WorkOrder, 'id' | 'quoteId' | 'inParts'>,
  ordenes: readonly Pick<WorkOrder, 'id' | 'quoteId' | 'inParts' | 'issuedAt' | 'tempFolio'>[],
): number | null {
  const i = partsOf(orden, ordenes).findIndex((o) => o.id === orden.id);
  return i < 0 ? null : i + 1;
}

/** Cuántas órdenes hay en cada estatus. */
export function countByStatus(
  ordenes: readonly Pick<WorkOrder, 'status'>[],
): Record<WorkOrderStatus, number> {
  const conteo: Record<WorkOrderStatus, number> = {
    WAITING: 0,
    IN_PROCESS: 0,
    READY: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  };
  for (const o of ordenes) {
    conteo[o.status] += 1;
  }
  return conteo;
}

export interface OrderSummary {
  /** Valor de lo que está en espera o en proceso (aún sin entregar ni cancelar). */
  readonly inProductionCents: number;
  /** Saldo por cobrar de lo que ya está listo para entregar. */
  readonly readyBalanceCents: number;
}

/** Resumen del tablero: valor en producción y saldo por cobrar de lo ya listo [RF-M3-07]. El saldo de
 *  cada orden lo da quien llama (total − pagos). */
export function summarizeOrders(
  ordenes: readonly Pick<WorkOrder, 'id' | 'status' | 'totalCents'>[],
  saldoDe: (id: string) => number,
): OrderSummary {
  let enProduccion = 0;
  let porCobrar = 0;
  for (const o of ordenes) {
    if (o.status === 'WAITING' || o.status === 'IN_PROCESS') {
      enProduccion += o.totalCents;
    } else if (o.status === 'READY') {
      porCobrar += Math.max(0, saldoDe(o.id));
    }
  }
  return { inProductionCents: enProduccion, readyBalanceCents: porCobrar };
}
