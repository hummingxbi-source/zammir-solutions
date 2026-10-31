import type { LengthUnit } from '../../../shared-kernel/measure/length';
import type { CustomerId, UserId, WorkOrderId } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { QuoteLine } from '../../quotes/domain/quote';

/** Estados de una orden de trabajo [RF-M3-02]. Estatus por orden, no por línea (PD-46). */
export type WorkOrderStatus = 'WAITING' | 'IN_PROCESS' | 'READY' | 'DELIVERED' | 'CANCELLED';

/** Tabla de transiciones válidas. "Entregado" y "cancelado" son finales; cancelar se puede desde
 *  cualquier estado no final. */
export const WORK_ORDER_TRANSITIONS: Readonly<Record<WorkOrderStatus, readonly WorkOrderStatus[]>> =
  {
    WAITING: ['IN_PROCESS', 'CANCELLED'],
    IN_PROCESS: ['READY', 'CANCELLED'],
    READY: ['DELIVERED', 'CANCELLED'],
    DELIVERED: [],
    CANCELLED: [],
  };

export interface InvalidWorkOrderTransition {
  readonly code: 'INVALID_TRANSITION';
  readonly from: WorkOrderStatus;
  readonly to: WorkOrderStatus;
}

export function checkWorkOrderTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): Result<WorkOrderStatus, InvalidWorkOrderTransition> {
  return WORK_ORDER_TRANSITIONS[from].includes(to)
    ? ok(to)
    : err({ code: 'INVALID_TRANSITION', from, to });
}

/** El siguiente estatus del botón "Avanzar"; `null` si ya no hay [RF-M3-02]. */
export function nextWorkOrderStatus(status: WorkOrderStatus): WorkOrderStatus | null {
  return status === 'WAITING'
    ? 'IN_PROCESS'
    : status === 'IN_PROCESS'
      ? 'READY'
      : status === 'READY'
        ? 'DELIVERED'
        : null;
}

/** Línea de la orden: copia congelada de la línea de la cotización. Las que bajan del servidor no
 *  conservan la unidad en que se capturó. */
export type WorkOrderLine = Omit<QuoteLine, 'displayUnit'> & {
  readonly displayUnit?: LengthUnit | null;
};

/** Estado de envío de la orden respecto al servidor [GLOSARIO]. */
export type WorkOrderSyncStatus = 'SAVED_ON_TABLET' | 'SENT';

export interface WorkOrder {
  readonly id: WorkOrderId;
  readonly status: WorkOrderStatus;
  readonly customerId: CustomerId;
  /** Cotización de la que salió; `null` si se capturó a mano. */
  readonly quoteId: string | null;
  readonly siteAddress: string | null;
  readonly description: string | null;
  readonly lines: readonly WorkOrderLine[];
  readonly subtotalCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
  /** Porcentaje de anticipo vigente al crearla y el anticipo exigido, redondeado hacia arriba [ADR-0011]. */
  readonly depositPercentBps: number;
  readonly depositRequiredCents: number;
  readonly measuredBy: UserId | null;
  readonly builtBy: UserId | null;
  readonly installedBy: UserId | null;
  /** Fecha estimada de entrega (`AAAA-MM-DD`), capturada a mano (PD-41). */
  readonly estimatedDeliveryDate: string | null;
  readonly notes: string | null;
  readonly tempFolio: string;
  /** Folio definitivo (`OT-2026-0001`), asignado por el servidor [RN-16]. */
  readonly folio: string | null;
  readonly publicCode: string;
  readonly issuedAt: string;
  readonly deliveredAt: string | null;
  readonly deliveredWithBalance: boolean;
  readonly deliveryReason: string | null;
  readonly deliveryAuthorizedBy: string | null;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  readonly cancelledFromStatus: WorkOrderStatus | null;
  /** Anticipo recibido al cancelar; solo se registra, sin devolución automática (PD-07). */
  readonly cancelDepositPaidCents: number | null;
  /** Quién la creó (la persona que entró con su PIN). */
  readonly userId: UserId;
  readonly syncStatus: WorkOrderSyncStatus;
  readonly reviewReason: string | null;
  /** Última modificación local (ISO, UTC). */
  readonly updatedAt: string;
}

/** Garantía escrita que se crea al entregar [RN-14]. Sin valor inventado: la duración puede estar vacía. */
export interface Warranty {
  readonly workOrderId: string;
  readonly startsOn: string;
  readonly durationMonths: number | null;
  readonly coverage: string | null;
  readonly exclusions: string | null;
}
