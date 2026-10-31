import type { SyncOutbox } from '../../sync/application/ports';
import type { CashShift } from '../domain/cash-shift';

export const CASH_SHIFTS_COLLECTION = 'cash_shifts';

/** Turnos de caja guardados en la tablet. Se apoyan en la cola de salida: el turno y su operación se
 *  guardan en una sola transacción local. */
export interface CashShiftStore {
  get(id: string): Promise<CashShift | null>;
  list(): Promise<readonly CashShift[]>;
  /** El turno abierto de una persona; `null` si no tiene. */
  openFor(userId: string): Promise<CashShift | null>;
}

export function outboxCashShiftStore(outbox: SyncOutbox): CashShiftStore {
  const todos = async (): Promise<readonly CashShift[]> =>
    (await outbox.transaction((tx) =>
      tx.listDocuments(CASH_SHIFTS_COLLECTION),
    )) as readonly CashShift[];
  return {
    async get(id) {
      const doc = await outbox.transaction((tx) => tx.getDocument(CASH_SHIFTS_COLLECTION, id));
      return doc === undefined ? null : (doc as CashShift);
    },
    list: todos,
    async openFor(userId) {
      const abiertos = (await todos())
        .filter((t) => t.cashierId === userId && t.status === 'OPEN')
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
      return abiertos[0] ?? null;
    },
  };
}
