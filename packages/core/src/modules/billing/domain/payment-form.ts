import type { PaymentForm } from './invoice';

/** Forma de pago de la factura según con qué se pagó la venta u orden: todo en efectivo `01`, todo por
 *  transferencia `03` [RN-28]. Un pago mixto o sin pagos devuelve `null`: la regla para pagos mixtos la define
 *  el contador (PD-28) y mientras tanto no se factura solo, se pide directamente al negocio. */
export function paymentFormFor(metodos: readonly ('CASH' | 'TRANSFER')[]): PaymentForm | null {
  const usados = new Set(metodos);
  if (usados.size !== 1) {
    return null;
  }
  return usados.has('CASH') ? '01' : '03';
}
