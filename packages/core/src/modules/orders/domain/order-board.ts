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
