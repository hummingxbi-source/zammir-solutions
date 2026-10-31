import { err, ok, type Result } from '../../../shared-kernel/result';
import type { Payment } from '../../payments/domain/payment';
import type { Clock } from '../../../shared-kernel/clock';
import type { CounterSale } from '../../counter/domain/counter-sale';
import { COUNTER_SALES_COLLECTION } from '../../counter/application/counter-sale-store';
import type { SyncOutbox } from '../../sync/application/ports';
import type { WorkOrder } from '../domain/work-order';
import { PAYMENTS_COLLECTION, WORK_ORDERS_COLLECTION } from './work-order-store';

const META = 'documents-meta';

export interface ReplicaDocumentsError {
  readonly code: 'DOCUMENTS_UNAVAILABLE';
}

/** Una orden o un pago tal como baja del servidor, con su número de cambio. Sin datos fiscales [RNF-06]. */
export type ReplicatedWorkOrder = Omit<WorkOrder, 'updatedAt'> & { readonly changeSeq: number };
export type ReplicatedPayment = Payment & { readonly changeSeq: number };
export type ReplicatedSale = Omit<CounterSale, 'updatedAt'> & { readonly changeSeq: number };

/** De dónde baja la tablet las órdenes y los pagos de las demás tablets (el servidor). */
export interface DocumentReplicaSource {
  ordersChangedAfter(
    seq: number,
    limit: number,
  ): Promise<Result<readonly ReplicatedWorkOrder[], ReplicaDocumentsError>>;
  salesChangedAfter(
    seq: number,
    limit: number,
  ): Promise<Result<readonly ReplicatedSale[], ReplicaDocumentsError>>;
  paymentsChangedAfter(
    seq: number,
    limit: number,
  ): Promise<Result<readonly ReplicatedPayment[], ReplicaDocumentsError>>;
}

export const DOCUMENT_REPLICA_PAGE_SIZE = 500;

function ordenDeOperacion(tipo: string, carga: unknown): string | undefined {
  const c = carga as {
    readonly id?: unknown;
    readonly target?: { readonly id?: unknown } | null;
  } | null;
  const id = tipo === 'RegisterPayment' ? c?.target?.id : c?.id;
  return typeof id === 'string' ? id : undefined;
}

/** Quita el número de cambio del servidor: no forma parte del documento local. */
function sinCambio<T extends { changeSeq: number }>(x: T): Omit<T, 'changeSeq'> {
  const copia: Partial<T> = { ...x };
  delete copia.changeSeq;
  return copia as Omit<T, 'changeSeq'>;
}

async function cursor(outbox: SyncOutbox, clave: string): Promise<number> {
  return Number((await outbox.transaction((tx) => tx.getDocument(META, clave))) ?? 0);
}

/** Baja las órdenes y pagos nuevos o cambiados y los guarda en la tablet [SINCRONIZACION §7].
 *  Una orden con un cambio todavía por enviar NO se sobrescribe: lo que se capturó aquí manda hasta que
 *  sale, y luego el servidor tiene la última palabra. Los pagos solo se agregan: uno que ya está no se toca.
 *  Si falla a la mitad, lo guardado se queda y continúa desde ahí. */
export async function refreshDocuments(deps: {
  readonly source: DocumentReplicaSource;
  readonly outbox: SyncOutbox;
  readonly clock: Clock;
}): Promise<Result<{ readonly orders: number; readonly payments: number }, ReplicaDocumentsError>> {
  let ordenes = 0;
  let pagos = 0;
  let ventas = 0;

  for (;;) {
    const desde = await cursor(deps.outbox, 'orders');
    const pagina = await deps.source.ordersChangedAfter(desde, DOCUMENT_REPLICA_PAGE_SIZE);
    if (!pagina.ok) {
      return err(pagina.error);
    }
    if (pagina.value.length > 0) {
      const pendientes = new Set(
        (await deps.outbox.list())
          .filter((o) => o.status === 'PENDING' || o.status === 'FAILED')
          .map((o) => ordenDeOperacion(o.envelope.type, o.envelope.payload)),
      );
      const mayor = Math.max(...pagina.value.map((o) => o.changeSeq));
      const instante = deps.clock.now().toISOString();
      await deps.outbox.transaction(async (tx) => {
        for (const completa of pagina.value) {
          const orden = sinCambio(completa);
          if (!pendientes.has(orden.id)) {
            await tx.putDocument(WORK_ORDERS_COLLECTION, orden.id, {
              ...orden,
              syncStatus: 'SENT',
              updatedAt: instante,
            });
          }
        }
        await tx.putDocument(META, 'orders', mayor);
      });
      ordenes += pagina.value.length;
    }
    if (pagina.value.length < DOCUMENT_REPLICA_PAGE_SIZE) {
      break;
    }
  }

  for (;;) {
    const desde = await cursor(deps.outbox, 'sales');
    const pagina = await deps.source.salesChangedAfter(desde, DOCUMENT_REPLICA_PAGE_SIZE);
    if (!pagina.ok) {
      return err(pagina.error);
    }
    if (pagina.value.length > 0) {
      const pendientes = new Set(
        (await deps.outbox.list())
          .filter((o) => o.status === 'PENDING' || o.status === 'FAILED')
          .map((o) => ordenDeOperacion(o.envelope.type, o.envelope.payload)),
      );
      const mayor = Math.max(...pagina.value.map((v) => v.changeSeq));
      const instante = deps.clock.now().toISOString();
      await deps.outbox.transaction(async (tx) => {
        for (const completa of pagina.value) {
          const venta = sinCambio(completa);
          if (!pendientes.has(venta.id)) {
            await tx.putDocument(COUNTER_SALES_COLLECTION, venta.id, {
              ...venta,
              syncStatus: 'SENT',
              updatedAt: instante,
            });
          }
        }
        await tx.putDocument(META, 'sales', mayor);
      });
      ventas += pagina.value.length;
    }
    if (pagina.value.length < DOCUMENT_REPLICA_PAGE_SIZE) {
      break;
    }
  }

  for (;;) {
    const desde = await cursor(deps.outbox, 'payments');
    const pagina = await deps.source.paymentsChangedAfter(desde, DOCUMENT_REPLICA_PAGE_SIZE);
    if (!pagina.ok) {
      return err(pagina.error);
    }
    if (pagina.value.length > 0) {
      const mayor = Math.max(...pagina.value.map((p) => p.changeSeq));
      await deps.outbox.transaction(async (tx) => {
        for (const completo of pagina.value) {
          const pago = sinCambio(completo);
          if ((await tx.getDocument(PAYMENTS_COLLECTION, pago.id)) === undefined) {
            await tx.putDocument(PAYMENTS_COLLECTION, pago.id, pago);
          }
        }
        await tx.putDocument(META, 'payments', mayor);
      });
      pagos += pagina.value.length;
    }
    if (pagina.value.length < DOCUMENT_REPLICA_PAGE_SIZE) {
      break;
    }
  }
  return ok({ orders: ordenes, payments: pagos, sales: ventas });
}
