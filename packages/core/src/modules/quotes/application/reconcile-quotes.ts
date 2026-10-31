import type { SyncOutbox } from '../../sync/application/ports';
import type { Quote } from '../domain/quote';
import { QUOTES_COLLECTION } from './quote-store';

const TIPOS_DE_COTIZACION = new Set(['IssueQuote', 'MarkQuoteAccepted', 'MarkQuoteRejected']);

function documentoDe(tipo: string, carga: unknown): string | undefined {
  const c = carga as { readonly id?: unknown; readonly quoteId?: unknown } | null;
  const id = tipo === 'IssueQuote' ? c?.id : c?.quoteId;
  return typeof id === 'string' ? id : undefined;
}

/** Pone en cada cotización de la tablet lo que el servidor ya confirmó [S2-07, RN-16]: su folio definitivo,
 *  que ya salió ("Enviado") y, si un administrador debe revisarla, el motivo. Una cotización con otro
 *  cambio todavía por salir sigue como "Guardado en la tablet". Se puede repetir sin efecto: solo toca
 *  lo que cambió. Devuelve cuántas cotizaciones actualizó. */
export async function reconcileQuotes(outbox: SyncOutbox): Promise<number> {
  const operaciones = await outbox.list();
  const conPendientes = new Set<string>();
  for (const o of operaciones) {
    if (o.status === 'PENDING' || o.status === 'FAILED') {
      const id = documentoDe(o.envelope.type, o.envelope.payload);
      if (id !== undefined) {
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
      !TIPOS_DE_COTIZACION.has(o.envelope.type)
    ) {
      continue;
    }
    const id = documentoDe(o.envelope.type, o.envelope.payload);
    if (id === undefined) {
      continue;
    }
    const cambio = await outbox.transaction(async (tx) => {
      const actual = (await tx.getDocument(QUOTES_COLLECTION, id)) as Quote | undefined;
      if (actual === undefined) {
        return false;
      }
      const siguiente: Quote = {
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
      await tx.putDocument(QUOTES_COLLECTION, id, siguiente);
      return true;
    });
    if (cambio) {
      actualizadas += 1;
    }
  }
  return actualizadas;
}
