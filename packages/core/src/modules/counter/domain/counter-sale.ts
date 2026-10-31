import type { CustomerId, UserId } from '../../../shared-kernel/id';
import type { WorkOrderLine } from '../../orders/domain/work-order';

/** Una venta de mostrador es completa o cancelada; nada se borra [RN-18]. */
export type CounterSaleStatus = 'COMPLETED' | 'CANCELLED';

export type CounterSaleSyncStatus = 'SAVED_ON_TABLET' | 'SENT';

/** Venta de mostrador: piezas, servicios o vidrio a medida que se pagan completos en el momento
 *  [RF-M4-01, RF-M4-02]. Cada venta guarda quién cobró, desde qué dispositivo y cuándo [RN-11]. */
export interface CounterSale {
  readonly id: string;
  readonly status: CounterSaleStatus;
  /** Cliente, si se quiso anotar; el mostrador puede vender sin cliente. */
  readonly customerId: CustomerId | null;
  readonly lines: readonly WorkOrderLine[];
  readonly subtotalCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
  readonly tempFolio: string;
  /** Folio definitivo (`V-2026-0001`), asignado por el servidor [RN-16]. */
  readonly folio: string | null;
  readonly publicCode: string;
  /** Instante del cobro (ISO, UTC). */
  readonly issuedAt: string;
  /** Quién cobró (la persona que entró con su PIN). */
  readonly userId: UserId;
  readonly deviceId: string | null;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  readonly cancelledBy: string | null;
  readonly syncStatus: CounterSaleSyncStatus;
  readonly reviewReason: string | null;
  /** Última modificación local (ISO, UTC). */
  readonly updatedAt: string;
}
