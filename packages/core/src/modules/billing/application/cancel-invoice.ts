import type { UserId } from '../../../shared-kernel/id';
import type { UserRole } from '../../identity/domain/auth';
import { isRetryable, type BillingErrorCode, type CancellationMotive } from '../domain/invoice';
import type { BillingProvider } from './ports';

/** Una factura tal como la ve quien la quiere cancelar. */
export interface CancellableInvoice {
  readonly requestId: string;
  readonly status: 'IN_PROCESS' | 'STAMPED' | 'CANCELLED' | 'FAILED';
  readonly uuid: string | null;
  readonly folio: string | null;
  /** Ya se pidió su cancelación y el receptor todavía no la acepta. */
  readonly cancellationRequested: boolean;
}

/** Puerto: las facturas y su cancelación, con el rastro en la bitácora [RN-18, RN-19]. */
export interface CancelInvoiceStore {
  findByFolio(folio: string): Promise<CancellableInvoice | null>;
  /** Deja asentada la cancelación, o su solicitud si el receptor debe aceptarla. Nada se borra. */
  markCancelled(
    requestId: string,
    entrada: {
      readonly motive: CancellationMotive;
      readonly substituteUuid: string | null;
      readonly by: UserId;
      readonly pending: boolean;
    },
  ): Promise<void>;
}

export interface CancelInvoiceDeps {
  readonly provider: BillingProvider;
  readonly store: CancelInvoiceStore;
}

export interface CancelInvoiceInput {
  readonly actor: { readonly userId: UserId; readonly role: UserRole | null };
  /** Folio de la factura a cancelar, `F-AAAA-0001`. */
  readonly folio: string;
  readonly motive: CancellationMotive;
  /** Con el motivo `01`, el folio de la factura que la sustituye (ya emitida) [RN-28]. */
  readonly substituteFolio?: string | null;
}

export type CancelInvoiceOutcome =
  | { readonly kind: 'CANCELLED' }
  /** El receptor debe aceptar la cancelación: queda solicitada y la factura sigue vigente hasta entonces. */
  | { readonly kind: 'CANCELLATION_PENDING' }
  | { readonly kind: 'NOT_AUTHORIZED' }
  | { readonly kind: 'NOT_FOUND' }
  /** Solo se cancela lo que está timbrado; una factura en proceso, fallida o ya cancelada no. */
  | { readonly kind: 'NOT_CANCELLABLE' }
  | { readonly kind: 'INVALID'; readonly fields: readonly string[] }
  | { readonly kind: 'REJECTED'; readonly code: BillingErrorCode }
  | { readonly kind: 'UNAVAILABLE' };

export const CANCELLATION_MOTIVES: readonly CancellationMotive[] = ['01', '02', '03', '04'];

/** Solo los administradores cancelan facturas: un cajero no, ni con autorización [RF-M10-19, RN-28]. */
export function canCancelInvoice(role: UserRole | null): boolean {
  return role === 'ADMIN';
}

/** Cancela una factura con uno de los motivos del SAT: `01` con relación (exige la factura que la sustituye),
 *  `02` sin relación, `03` no se llevó a cabo la operación y `04` operación nominativa en factura global. Deja el
 *  rastro en la bitácora con quién y por qué [RF-M10-19, RN-18, RN-19, RN-28]. Una factura mal emitida (RFC o
 *  nombre equivocados) no se corrige: se cancela y se vuelve a emitir. */
export async function cancelInvoice(
  deps: CancelInvoiceDeps,
  entrada: CancelInvoiceInput,
): Promise<CancelInvoiceOutcome> {
  if (!canCancelInvoice(entrada.actor.role)) {
    return { kind: 'NOT_AUTHORIZED' };
  }
  const campos: string[] = [];
  if (!CANCELLATION_MOTIVES.includes(entrada.motive)) {
    campos.push('motive');
  }
  const sustituta = entrada.substituteFolio?.trim() ?? '';
  if (entrada.motive === '01' && sustituta === '') {
    campos.push('substituteFolio');
  }
  if (entrada.motive !== '01' && sustituta !== '') {
    campos.push('substituteFolio');
  }
  if (campos.length > 0) {
    return { kind: 'INVALID', fields: campos };
  }

  try {
    const factura = await deps.store.findByFolio(entrada.folio);
    if (factura === null || factura.uuid === null) {
      return { kind: 'NOT_FOUND' };
    }
    if (factura.status !== 'STAMPED') {
      return { kind: 'NOT_CANCELLABLE' };
    }

    let uuidDeLaSustituta: string | null = null;
    if (entrada.motive === '01') {
      const otra = await deps.store.findByFolio(sustituta);
      if (
        otra === null ||
        otra.uuid === null ||
        otra.status !== 'STAMPED' ||
        otra.requestId === factura.requestId
      ) {
        return { kind: 'INVALID', fields: ['substituteFolio'] };
      }
      uuidDeLaSustituta = otra.uuid;
    }

    const r = await deps.provider.cancel({
      uuid: factura.uuid,
      motive: entrada.motive,
      ...(uuidDeLaSustituta === null ? {} : { substituteUuid: uuidDeLaSustituta }),
    });
    if (!r.ok && r.error.code !== 'ALREADY_CANCELLED') {
      return isRetryable(r.error.code)
        ? { kind: 'UNAVAILABLE' }
        : { kind: 'REJECTED', code: r.error.code };
    }
    const pendiente = r.ok && r.value.status === 'CANCELLATION_PENDING';
    await deps.store.markCancelled(factura.requestId, {
      motive: entrada.motive,
      substituteUuid: uuidDeLaSustituta,
      by: entrada.actor.userId,
      pending: pendiente,
    });
    return pendiente ? { kind: 'CANCELLATION_PENDING' } : { kind: 'CANCELLED' };
  } catch {
    return { kind: 'UNAVAILABLE' };
  }
}
