import type { Payment } from './payment';

/** Un administrador revisó su banco y confirmó que llegó una transferencia [RF-M4-11, ADR-0044]. El pago no
 *  cambia (es contable y no se modifica [RN-18]): la confirmación es un hecho aparte, que solo se agrega. */
export interface TransferConfirmation {
  readonly paymentId: string;
  /** Quién confirmó: un administrador, o quien tenía la tablet con el PIN de uno. */
  readonly confirmedBy: string;
  /** Instante de la confirmación (ISO, UTC). */
  readonly confirmedAt: string;
  readonly syncStatus: 'SAVED_ON_TABLET' | 'SENT';
}

/** Cómo va una transferencia: por confirmar o confirmada. Un pago en efectivo no tiene este estado. */
export type TransferStatus = 'NOT_A_TRANSFER' | 'PENDING' | 'CONFIRMED';

export function transferStatus(
  pago: Pick<Payment, 'id' | 'method'>,
  confirmadas: ReadonlySet<string>,
): TransferStatus {
  if (pago.method !== 'TRANSFER') {
    return 'NOT_A_TRANSFER';
  }
  return confirmadas.has(pago.id) ? 'CONFIRMED' : 'PENDING';
}

/** Las transferencias que todavía nadie confirma, de la más antigua a la más reciente. */
export function pendingTransfers<P extends Pick<Payment, 'id' | 'method' | 'paidAt'>>(
  pagos: readonly P[],
  confirmadas: ReadonlySet<string>,
): readonly P[] {
  return pagos
    .filter((p) => transferStatus(p, confirmadas) === 'PENDING')
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt));
}
