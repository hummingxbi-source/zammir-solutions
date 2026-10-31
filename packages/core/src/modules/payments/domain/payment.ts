import { err, ok, type Result } from '../../../shared-kernel/result';

/** Cómo se pagó. Sin tarjeta [RN-10]. */
export type PaymentMethod = 'CASH' | 'TRANSFER';

/** Qué se pagó: anticipo o saldo de una orden, o una venta de mostrador. */
export type PaymentKind = 'DEPOSIT' | 'BALANCE' | 'SALE';

export type PaymentTargetType = 'WORK_ORDER' | 'COUNTER_SALE';

/** Un pago es un hecho que ocurrió: se agrega y nunca se modifica ni se borra [RN-18]. Un cobro mixto son
 *  varias filas con el mismo `groupId` [RN-10]. */
export interface Payment {
  readonly id: string;
  readonly groupId: string;
  readonly targetType: PaymentTargetType;
  readonly targetId: string;
  readonly kind: PaymentKind;
  readonly method: PaymentMethod;
  /** Lo que se APLICA a la orden o venta, en centavos. El cambio de un pago en efectivo no cuenta. */
  readonly amountCents: number;
  readonly cashReceivedCents: number | null;
  readonly changeCents: number | null;
  /** Referencia de la transferencia; opcional y sin estado de confirmación (PD-43). */
  readonly reference: string | null;
  /** Quién cobró (la persona que entró con su PIN) [RN-11]. */
  readonly userId: string;
  readonly deviceId: string | null;
  /** Instante del cobro (ISO, UTC). */
  readonly paidAt: string;
  /** Turno de caja de quien cobró; se llena desde S3-16. */
  readonly cashShiftId: string | null;
}

/** Lo que se captura por cada forma de pago de un cobro. */
export interface PaymentRowInput {
  readonly method: PaymentMethod;
  /** Lo que se aplica (en efectivo, lo recibido menos el cambio). */
  readonly amountCents: number;
  /** Solo efectivo: lo que entregó el cliente. */
  readonly cashReceivedCents?: number | null;
  readonly reference?: string | null;
}

export type PaymentErrorCode =
  | 'NOT_AUTHORIZED'
  | 'EMPTY'
  | 'AMOUNT_INVALID'
  | 'CASH_RECEIVED_INVALID'
  | 'NOTHING_DUE'
  | 'EXCEEDS_BALANCE'
  | 'MUST_COVER_BALANCE'
  | 'NOT_FOUND'
  | 'ORDER_CANCELLED'
  | 'STORAGE_FAILED';

export interface PaymentError {
  readonly code: PaymentErrorCode;
}

/** Saldo = total − suma de pagos aplicados. Nunca se captura; siempre se calcula [RF-M3-03]. */
export function balanceCents(
  totalCents: number,
  pagos: readonly Pick<Payment, 'amountCents'>[],
): number {
  return totalCents - pagos.reduce((suma, p) => suma + p.amountCents, 0);
}

export interface PlannedPaymentRow {
  readonly method: PaymentMethod;
  readonly amountCents: number;
  readonly cashReceivedCents: number | null;
  readonly changeCents: number | null;
  readonly reference: string | null;
}

export interface PaymentPlan {
  readonly rows: readonly PlannedPaymentRow[];
  readonly appliedCents: number;
  readonly changeCents: number;
  readonly balanceAfterCents: number;
}

const esEntero = (n: number): boolean => Number.isSafeInteger(n);

/** Valida un cobro contra el saldo y calcula el cambio [RN-09, RN-10].
 *  - Un pago mayor al saldo se rechaza; en efectivo, lo que sobra de lo recibido es cambio.
 *  - Una venta de mostrador se paga completa: no hay anticipo ni saldo [RF-M4-02]. */
export function planPayment(entrada: {
  readonly kind: PaymentKind;
  readonly balanceCents: number;
  readonly rows: readonly PaymentRowInput[];
}): Result<PaymentPlan, PaymentError> {
  if (entrada.rows.length === 0) {
    return err({ code: 'EMPTY' });
  }
  if (entrada.balanceCents <= 0) {
    return err({ code: 'NOTHING_DUE' });
  }
  const filas: PlannedPaymentRow[] = [];
  for (const fila of entrada.rows) {
    if (!esEntero(fila.amountCents) || fila.amountCents <= 0) {
      return err({ code: 'AMOUNT_INVALID' });
    }
    if (fila.method === 'CASH') {
      const recibido = fila.cashReceivedCents;
      if (recibido === null || recibido === undefined || !esEntero(recibido)) {
        return err({ code: 'CASH_RECEIVED_INVALID' });
      }
      if (recibido < fila.amountCents) {
        return err({ code: 'CASH_RECEIVED_INVALID' });
      }
      filas.push({
        method: 'CASH',
        amountCents: fila.amountCents,
        cashReceivedCents: recibido,
        changeCents: recibido - fila.amountCents,
        reference: null,
      });
    } else {
      if (fila.cashReceivedCents !== undefined && fila.cashReceivedCents !== null) {
        return err({ code: 'CASH_RECEIVED_INVALID' });
      }
      const referencia = fila.reference?.trim() ?? '';
      filas.push({
        method: 'TRANSFER',
        amountCents: fila.amountCents,
        cashReceivedCents: null,
        changeCents: null,
        reference: referencia === '' ? null : referencia,
      });
    }
  }
  const aplicado = filas.reduce((suma, f) => suma + f.amountCents, 0);
  if (aplicado > entrada.balanceCents) {
    return err({ code: 'EXCEEDS_BALANCE' });
  }
  if (entrada.kind === 'SALE' && aplicado !== entrada.balanceCents) {
    return err({ code: 'MUST_COVER_BALANCE' });
  }
  return ok({
    rows: filas,
    appliedCents: aplicado,
    changeCents: filas.reduce((suma, f) => suma + (f.changeCents ?? 0), 0),
    balanceAfterCents: entrada.balanceCents - aplicado,
  });
}

/** Un cobro de orden es anticipo mientras no se haya recibido nada, y saldo después. */
export function paymentKindForOrder(paidBeforeCents: number): Extract<PaymentKind, 'DEPOSIT' | 'BALANCE'> {
  return paidBeforeCents === 0 ? 'DEPOSIT' : 'BALANCE';
}
