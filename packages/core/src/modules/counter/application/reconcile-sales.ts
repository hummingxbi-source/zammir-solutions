import type { SyncOutbox } from '../../sync/application/ports';
import type { CounterSale } from '../domain/counter-sale';
import { COUNTER_SALES_COLLECTION } from './counter-sale-store';

const TIPOS = new Set(['CreateCounterSale', 'CancelCounterSale']);

function ventaDe(carga: unknown): string | undefined {
  const id = (carga as { readonly id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : undefined;
}

/** Pone en cada venta de la tablet lo que el servidor ya confirmó [RN-16]: su folio definitivo
 *  (`V-AAAA-NNNN`), que ya salió ("Enviado") y, si un administrador debe revisarla, el motivo. Se puede
 *  repetir sin efecto. Devuelve cuántas ventas actualizó. */
export async function reconcileSales(outbox: SyncOutbox): Promise<number> {
  const operaciones = await outbox.list();
  const conPendientes = new Set<string>();
  for (const o of operaciones) {
    if (o.status === 'PENDING' || o.status === 'FAILED') {
      const id = ventaDe(o.envelope.payload);
      if (id !== undefined && TIPOS.has(o.envelope.type)) {
        conPendientes.add(id);
      }
    }
  }
  let actualizadas = 0;
  for (const o of operaciones) {
    const resultado = o.result;
    if (
      (o.status !== 'APPLIED' && o.status !== 'TO_REVIEW') ||
      resultado === undefined ||
      !resultado.ok ||
      !TIPOS.has(o.envelope.type)
    ) {
      continue;
    }
    const id = ventaDe(o.envelope.payload);
    if (id === undefined) {
      continue;
    }
    const cambio = await outbox.transaction(async (tx) => {
      const actual = (await tx.getDocument(COUNTER_SALES_COLLECTION, id)) as
        CounterSale | undefined;
      if (actual === undefined) {
        return false;
      }
      const siguiente: CounterSale = {
        ...actual,
        folio: resultado.folio ?? actual.folio,
        syncStatus: conPendientes.has(id) ? 'SAVED_ON_TABLET' : 'SENT',
        reviewReason:
          resultado.status === 'TO_REVIEW'
            ? (resultado.reason ?? actual.reviewReason)
            : actual.reviewReason,
      };
      if (
        siguiente.folio === actual.folio &&
        siguiente.syncStatus === actual.syncStatus &&
        siguiente.reviewReason === actual.reviewReason
      ) {
        return false;
      }
      await tx.putDocument(COUNTER_SALES_COLLECTION, id, siguiente);
      return true;
    });
    if (cambio) {
      actualizadas += 1;
    }
  }
  return actualizadas;
}
