import type { Payment, PaymentMethod } from '../../payments/domain/payment';

/** Dinero que se le regresa al cliente al cancelar una venta de mostrador cobrada [RF-M4-10, ADR-0044]. Se
 *  devuelve por el mismo medio con que pagó y se registra en el turno abierto de quien cancela: el efectivo sale
 *  de ese cajón. El cobro original no se mueve de su turno, así un corte cerrado ya no cambia después. Como los
 *  pagos, una devolución solo se agrega [RN-18]. */
export interface Refund {
  readonly id: string;
  readonly saleId: string;
  readonly method: PaymentMethod;
  readonly amountCents: number;
  /** Turno de quien devolvió. En efectivo siempre lo hay; por transferencia, si estaba abierto. */
  readonly cashShiftId: string | null;
  /** Quién hizo la devolución (la persona que tenía la tablet). */
  readonly userId: string;
  /** Administrador que autorizó la cancelación. */
  readonly authorizedBy: string;
  /** Instante de la devolución (ISO, UTC). */
  readonly refundedAt: string;
  readonly syncStatus: 'SAVED_ON_TABLET' | 'SENT';
}

/** Cuánto se devuelve por cada medio: lo cobrado de la venta, sumado por método; primero el efectivo. */
export function planRefunds(
  pagos: readonly Pick<Payment, 'method' | 'amountCents'>[],
): readonly { readonly method: PaymentMethod; readonly amountCents: number }[] {
  const porMetodo: Record<PaymentMethod, number> = { CASH: 0, TRANSFER: 0 };
  for (const p of pagos) {
    porMetodo[p.method] += p.amountCents;
  }
  return (['CASH', 'TRANSFER'] as const)
    .filter((m) => porMetodo[m] > 0)
    .map((method) => ({ method, amountCents: porMetodo[method] }));
}

/** Ventas que ya tienen su devolución registrada. Una venta cancelada SIN devolución es de antes de RF-M4-10:
 *  su cobro sigue fuera del corte, como entonces. */
export function refundedSaleIds(devoluciones: readonly Pick<Refund, 'saleId'>[]): Set<string> {
  return new Set(devoluciones.map((d) => d.saleId));
}
