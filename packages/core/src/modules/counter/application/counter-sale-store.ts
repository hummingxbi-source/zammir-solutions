import type { SyncOutbox } from '../../sync/application/ports';
import type { CounterSale } from '../domain/counter-sale';

export const COUNTER_SALES_COLLECTION = 'counter_sales';

/** Ventas de mostrador guardadas en la tablet. Se apoyan en la cola de salida: la venta, su cobro y su
 *  operación se guardan en una sola transacción local. */
export interface CounterSaleStore {
  get(id: string): Promise<CounterSale | null>;
  save(venta: CounterSale): Promise<void>;
  list(): Promise<readonly CounterSale[]>;
}

export function outboxCounterSaleStore(outbox: SyncOutbox): CounterSaleStore {
  const todas = async (): Promise<readonly CounterSale[]> =>
    (await outbox.transaction((tx) =>
      tx.listDocuments(COUNTER_SALES_COLLECTION),
    )) as readonly CounterSale[];
  return {
    async get(id) {
      const doc = await outbox.transaction((tx) => tx.getDocument(COUNTER_SALES_COLLECTION, id));
      return doc === undefined ? null : (doc as CounterSale);
    },
    async save(venta) {
      await outbox.transaction((tx) => tx.putDocument(COUNTER_SALES_COLLECTION, venta.id, venta));
    },
    list: todas,
  };
}
