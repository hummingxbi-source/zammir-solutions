import type { CustomerId } from '../../../shared-kernel/id';
import type { Payment } from '../../payments/domain/payment';
import type { SyncOutbox } from '../../sync/application/ports';
import type { Warranty, WorkOrder } from '../domain/work-order';

export const WORK_ORDERS_COLLECTION = 'work_orders';
export const PAYMENTS_COLLECTION = 'payments';
export const WARRANTIES_COLLECTION = 'warranties';

/** Lugar donde la tablet guarda sus órdenes. Se apoya en la cola de salida, igual que las cotizaciones:
 *  una orden y su operación se guardan en la misma transacción local. */
export interface WorkOrderStore {
  get(id: string): Promise<WorkOrder | null>;
  save(order: WorkOrder): Promise<void>;
  list(): Promise<readonly WorkOrder[]>;
  /** Órdenes de un cliente, de la más reciente a la más antigua. */
  listByCustomer(customerId: CustomerId): Promise<readonly WorkOrder[]>;
}

/** Pagos guardados en la tablet. Solo se agregan: no hay forma de modificarlos ni borrarlos [RN-18]. */
export interface PaymentStore {
  listByTarget(targetId: string): Promise<readonly Payment[]>;
  list(): Promise<readonly Payment[]>;
}

const masRecientesPrimero = (a: WorkOrder, b: WorkOrder): number =>
  b.updatedAt.localeCompare(a.updatedAt);

export function outboxWorkOrderStore(outbox: SyncOutbox): WorkOrderStore {
  const todas = async (): Promise<readonly WorkOrder[]> =>
    (await outbox.transaction((tx) => tx.listDocuments(WORK_ORDERS_COLLECTION))) as readonly WorkOrder[];
  return {
    async get(id) {
      const doc = await outbox.transaction((tx) => tx.getDocument(WORK_ORDERS_COLLECTION, id));
      return doc === undefined ? null : (doc as WorkOrder);
    },
    async save(order) {
      await outbox.transaction((tx) => tx.putDocument(WORK_ORDERS_COLLECTION, order.id, order));
    },
    list: todas,
    async listByCustomer(customerId) {
      return (await todas()).filter((o) => o.customerId === customerId).sort(masRecientesPrimero);
    },
  };
}

export function outboxPaymentStore(outbox: SyncOutbox): PaymentStore {
  const todos = async (): Promise<readonly Payment[]> =>
    (await outbox.transaction((tx) => tx.listDocuments(PAYMENTS_COLLECTION))) as readonly Payment[];
  return {
    list: todos,
    async listByTarget(targetId) {
      return (await todos())
        .filter((p) => p.targetId === targetId)
        .sort((a, b) => a.paidAt.localeCompare(b.paidAt));
    },
  };
}

export function outboxWarrantyReader(outbox: SyncOutbox): {
  get(workOrderId: string): Promise<Warranty | null>;
} {
  return {
    async get(workOrderId) {
      const doc = await outbox.transaction((tx) => tx.getDocument(WARRANTIES_COLLECTION, workOrderId));
      return doc === undefined ? null : (doc as Warranty);
    },
  };
}
