import type { SyncOutbox } from '../../sync/application/ports';
import type { WorkOrder } from '../domain/work-order';
import { WORK_ORDERS_COLLECTION } from './work-order-store';

const TIPOS_DE_ORDEN = new Set([
  'CreateWorkOrder',
  'UpdateWorkOrder',
  'AdvanceWorkOrder',
  'DeliverWorkOrder',
  'CancelWorkOrder',
  'RegisterPayment',
]);

function ordenDe(tipo: string, carga: unknown): string | undefined {
  const c = carga as {
    readonly id?: unknown;
    readonly target?: { readonly id?: unknown } | null;
  } | null;
  const id = tipo === 'RegisterPayment' ? c?.target?.id : c?.id;
  return typeof id === 'string' ? id : undefined;
}

/** Pone en cada orden de la tablet lo que el servidor ya confirmó [RN-16]: su folio definitivo
 *  (`OT-AAAA-NNNN`), que ya salió ("Enviado") y, si un administrador debe revisarla, el motivo. Una orden
 *  con otro cambio todavía por salir sigue como "Guardado en la tablet". Se puede repetir sin efecto.
 *  Devuelve cuántas órdenes actualizó. */
export async function reconcileOrders(outbox: SyncOutbox): Promise<number> {
  const operaciones = await outbox.list();
  const conPendientes = new Set<string>();
  for (const o of operaciones) {
    if (o.status === 'PENDING' || o.status === 'FAILED') {
      const id = ordenDe(o.envelope.type, o.envelope.payload);
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
      !TIPOS_DE_ORDEN.has(o.envelope.type)
    ) {
      continue;
    }
    const id = ordenDe(o.envelope.type, o.envelope.payload);
    if (id === undefined) {
      continue;
    }
    const cambio = await outbox.transaction(async (tx) => {
      const actual = (await tx.getDocument(WORK_ORDERS_COLLECTION, id)) as WorkOrder | undefined;
      if (actual === undefined) {
        return false;
      }
      const siguiente: WorkOrder = {
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
      await tx.putDocument(WORK_ORDERS_COLLECTION, id, siguiente);
      return true;
    });
    if (cambio) {
      actualizadas += 1;
    }
  }
  return actualizadas;
}
