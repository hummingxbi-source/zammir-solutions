import type { SyncOutbox } from '../../sync/application/ports';
import type { CashShift } from '../domain/cash-shift';
import { CASH_SHIFTS_COLLECTION } from './cash-shift-store';

const TIPOS = new Set(['OpenCashShift', 'CloseCashShift', 'ReopenCashShift']);

function turnoDe(carga: unknown): string | undefined {
  const id = (carga as { readonly id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : undefined;
}

/** Pone en cada turno de caja de la tablet lo que el servidor ya confirmó: que ya salió ("Enviado") y,
 *  si un administrador debe revisarlo, el motivo. Un turno con otro cambio todavía por salir sigue como
 *  "Guardado en la tablet". Se puede repetir sin efecto. Devuelve cuántos turnos actualizó. */
export async function reconcileShifts(outbox: SyncOutbox): Promise<number> {
  const operaciones = await outbox.list();
  const conPendientes = new Set<string>();
  for (const o of operaciones) {
    if (o.status === 'PENDING' || o.status === 'FAILED') {
      const id = turnoDe(o.envelope.payload);
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
    const id = turnoDe(o.envelope.payload);
    if (id === undefined) {
      continue;
    }
    const cambio = await outbox.transaction(async (tx) => {
      const actual = (await tx.getDocument(CASH_SHIFTS_COLLECTION, id)) as CashShift | undefined;
      if (actual === undefined) {
        return false;
      }
      const siguiente: CashShift = {
        ...actual,
        syncStatus: conPendientes.has(id) ? 'SAVED_ON_TABLET' : 'SENT',
        reviewReason:
          resultado.status === 'TO_REVIEW'
            ? (resultado.reason ?? actual.reviewReason)
            : actual.reviewReason,
      };
      if (
        siguiente.syncStatus === actual.syncStatus &&
        siguiente.reviewReason === actual.reviewReason
      ) {
        return false;
      }
      await tx.putDocument(CASH_SHIFTS_COLLECTION, id, siguiente);
      return true;
    });
    if (cambio) {
      actualizadas += 1;
    }
  }
  return actualizadas;
}
