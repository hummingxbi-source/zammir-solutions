import type { CustomerId, QuoteId, UserId } from '../../../shared-kernel/id';
import type { SyncOutbox } from '../../sync/application/ports';
import type { Quote } from '../domain/quote';

export const QUOTES_COLLECTION = 'quotes';

/** Lugar donde la tablet guarda sus cotizaciones (borradores y emitidas). Se apoya en la cola de
 *  salida: así una cotización emitida y su operación se guardan en la misma transacción [S2-02]. */
export interface QuoteStore {
  get(id: QuoteId): Promise<Quote | null>;
  /** Guarda un borrador (o cualquier cotización) sin encolar nada. */
  save(quote: Quote): Promise<void>;
  list(): Promise<readonly Quote[]>;
  /** Cotizaciones de un cliente, de la más reciente a la más antigua [RF-M2-07]. */
  listByCustomer(customerId: CustomerId): Promise<readonly Quote[]>;
  /** Borradores de una persona, del más reciente al más antiguo. */
  listDrafts(userId: UserId): Promise<readonly Quote[]>;
}

/** Almacén de cotizaciones sobre la cola de salida (memoria o IndexedDB). */
export function outboxQuoteStore(outbox: SyncOutbox): QuoteStore {
  const todas = async (): Promise<readonly Quote[]> =>
    (await outbox.transaction((tx) => tx.listDocuments(QUOTES_COLLECTION))) as readonly Quote[];
  const masRecientesPrimero = (a: Quote, b: Quote): number =>
    b.updatedAt.localeCompare(a.updatedAt);
  return {
    async get(id) {
      const doc = await outbox.transaction((tx) => tx.getDocument(QUOTES_COLLECTION, id));
      return doc === undefined ? null : (doc as Quote);
    },
    async save(quote) {
      await outbox.transaction((tx) => tx.putDocument(QUOTES_COLLECTION, quote.id, quote));
    },
    list: todas,
    async listByCustomer(customerId) {
      return (await todas()).filter((q) => q.customerId === customerId).sort(masRecientesPrimero);
    },
    async listDrafts(userId) {
      return (await todas())
        .filter((q) => q.status === 'DRAFT' && q.userId === userId)
        .sort(masRecientesPrimero);
    },
  };
}
