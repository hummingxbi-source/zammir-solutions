import type { SyncOutbox } from '../../sync/application/ports';
import type { Refund } from '../domain/refund';

export const REFUNDS_COLLECTION = 'refunds';

/** Devoluciones guardadas en la tablet (propias y las que bajaron de otras). Solo se agregan [RN-18]. */
export interface RefundStore {
  list(): Promise<readonly Refund[]>;
}

export function outboxRefundStore(outbox: SyncOutbox): RefundStore {
  return {
    async list() {
      return (await outbox.transaction((tx) =>
        tx.listDocuments(REFUNDS_COLLECTION),
      )) as readonly Refund[];
    },
  };
}
