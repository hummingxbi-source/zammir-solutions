import type { UserId } from '../../../shared-kernel/id';
import { mexicoDate } from '../../../shared-kernel/date/mx-date';
import type { Payment } from '../../payments/domain/payment';

/** Turno de caja de una persona: del momento en que abre con su fondo inicial al corte [RF-M4-06].
 *  PD-36 sin respuesta: la unidad del corte es el turno de cada cajero. */
export type CashShiftStatus = 'OPEN' | 'CLOSED';

export type CashShiftSyncStatus = 'SAVED_ON_TABLET' | 'SENT';

export interface CashShiftReopening {
  readonly adminId: string;
  readonly reason: string;
  readonly at: string;
}

export interface CashShift {
  readonly id: string;
  readonly cashierId: UserId;
  readonly deviceId: string | null;
  readonly status: CashShiftStatus;
  /** Instante de apertura (ISO, UTC). */
  readonly openedAt: string;
  /** Fondo inicial en el cajón; opcional (puede ser cero) [RF-M4-06]. */
  readonly openingFloatCents: number;
  readonly closedAt: string | null;
  /** Efectivo que la persona contó al cerrar. */
  readonly countedCashCents: number | null;
  /** Lo que debía haber: fondo + efectivo cobrado. Calculado al cerrar. */
  readonly expectedCashCents: number | null;
  /** Contado − esperado (positivo = sobrante, negativo = faltante). */
  readonly differenceCents: number | null;
  /** Explicación de la diferencia: obligatoria si no es cero, aunque sea un centavo [RF-M4-09, ADR-0044]. */
  readonly differenceNote: string | null;
  /** Operaciones que quedaban sin enviar al cerrar [SINCRONIZACION §6.1]. */
  readonly pendingAtClose: number | null;
  readonly reopenings: readonly CashShiftReopening[];
  readonly syncStatus: CashShiftSyncStatus;
  readonly reviewReason: string | null;
  /** Última modificación local (ISO, UTC). */
  readonly updatedAt: string;
}

/** Lo que cuenta de un cobro para el corte: de dónde viene y si su venta se canceló. */
export interface ShiftPayment extends Pick<Payment, 'method' | 'amountCents' | 'kind'> {
  readonly targetType: Payment['targetType'];
  readonly targetId: string;
}

export interface CashShiftSummary {
  readonly openingFloatCents: number;
  /** Cobros que cuentan, por método. */
  readonly cashCents: number;
  readonly transferCents: number;
  /** Ventas de mostrador cobradas y anticipos/saldos de órdenes cobrados. */
  readonly salesCents: number;
  readonly orderPaymentsCents: number;
  /** Fondo + efectivo cobrado − efectivo devuelto: lo que debe haber en el cajón (PD-37: sin retiros). */
  readonly expectedCashCents: number;
  /** Devoluciones hechas EN ESTE TURNO al cancelar ventas (de este turno o de otros) [RF-M4-10]. */
  readonly refundedCashCents: number;
  readonly refundedTransferCents: number;
  readonly refundCount: number;
  /** Cobros de ventas canceladas antes de RF-M4-10 (sin devolución registrada): no cuentan y van aparte. */
  readonly cancelledSalesCents: number;
  readonly cancelledSalesCount: number;
  /** Contado − esperado; `null` mientras no se haya contado. */
  readonly differenceCents: number | null;
}

/** Calcula el corte de un turno a partir de su fondo, sus cobros y las devoluciones hechas en él. Función pura
 *  [RF-M4-06, RN-11]. Lo cobrado se queda en el turno donde se cobró aunque la venta se cancele después; lo que
 *  se devolvió sale del turno donde se devolvió [RF-M4-10, ADR-0044]. Así un corte cerrado no cambia. Una venta
 *  cancelada antes de RF-M4-10 (sin devolución registrada) sigue fuera del corte, como entonces. */
export function summarizeShift(entrada: {
  readonly openingFloatCents: number;
  readonly payments: readonly ShiftPayment[];
  readonly cancelledSaleIds: ReadonlySet<string>;
  /** Ventas con su devolución registrada (en cualquier turno). */
  readonly refundedSaleIds?: ReadonlySet<string>;
  /** Devoluciones hechas en este turno. */
  readonly refunds?: readonly { readonly method: 'CASH' | 'TRANSFER'; readonly amountCents: number }[];
  readonly countedCashCents: number | null;
}): CashShiftSummary {
  const conDevolucion = entrada.refundedSaleIds ?? new Set<string>();
  let efectivo = 0;
  let transferencia = 0;
  let ventas = 0;
  let ordenes = 0;
  let canceladas = 0;
  const ventasCanceladas = new Set<string>();
  for (const p of entrada.payments) {
    if (
      p.targetType === 'COUNTER_SALE' &&
      entrada.cancelledSaleIds.has(p.targetId) &&
      !conDevolucion.has(p.targetId)
    ) {
      canceladas += p.amountCents;
      ventasCanceladas.add(p.targetId);
      continue;
    }
    if (p.method === 'CASH') {
      efectivo += p.amountCents;
    } else {
      transferencia += p.amountCents;
    }
    if (p.targetType === 'COUNTER_SALE') {
      ventas += p.amountCents;
    } else {
      ordenes += p.amountCents;
    }
  }
  let devueltoEfectivo = 0;
  let devueltoTransferencia = 0;
  for (const d of entrada.refunds ?? []) {
    if (d.method === 'CASH') {
      devueltoEfectivo += d.amountCents;
    } else {
      devueltoTransferencia += d.amountCents;
    }
  }
  const esperado = entrada.openingFloatCents + efectivo - devueltoEfectivo;
  return {
    openingFloatCents: entrada.openingFloatCents,
    cashCents: efectivo,
    transferCents: transferencia,
    salesCents: ventas,
    orderPaymentsCents: ordenes,
    expectedCashCents: esperado,
    refundedCashCents: devueltoEfectivo,
    refundedTransferCents: devueltoTransferencia,
    refundCount: (entrada.refunds ?? []).length,
    cancelledSalesCents: canceladas,
    cancelledSalesCount: ventasCanceladas.size,
    differenceCents: entrada.countedCashCents === null ? null : entrada.countedCashCents - esperado,
  };
}

export interface DaySummary {
  readonly date: string;
  readonly cashCents: number;
  readonly transferCents: number;
  readonly totalCents: number;
  readonly expectedCashCents: number;
  readonly shiftCount: number;
  readonly byCashier: readonly {
    readonly cashierId: string;
    readonly cashCents: number;
    readonly transferCents: number;
    readonly totalCents: number;
    readonly shiftCount: number;
  }[];
}

/** Corte consolidado del día: suma de los cortes de cada turno, por método y por cajero [RF-M4-06, RN-17].
 *  Un turno pertenece al día (en hora de México) en que se abrió, aunque cruce la medianoche. */
export function summarizeDay(
  fecha: string,
  turnos: readonly {
    readonly shift: Pick<CashShift, 'id' | 'cashierId' | 'openedAt'>;
    readonly summary: CashShiftSummary;
  }[],
): DaySummary {
  const delDia = turnos.filter((t) => mexicoDate(new Date(t.shift.openedAt)) === fecha);
  const porCajero = new Map<
    string,
    { cashCents: number; transferCents: number; shiftCount: number }
  >();
  let efectivo = 0;
  let transferencia = 0;
  let esperado = 0;
  // Lo que quedó del día: lo cobrado menos lo devuelto [RF-M4-10].
  for (const { shift, summary } of delDia) {
    const neto = {
      cash: summary.cashCents - summary.refundedCashCents,
      transfer: summary.transferCents - summary.refundedTransferCents,
    };
    efectivo += neto.cash;
    transferencia += neto.transfer;
    esperado += summary.expectedCashCents;
    const actual = porCajero.get(shift.cashierId) ?? {
      cashCents: 0,
      transferCents: 0,
      shiftCount: 0,
    };
    porCajero.set(shift.cashierId, {
      cashCents: actual.cashCents + neto.cash,
      transferCents: actual.transferCents + neto.transfer,
      shiftCount: actual.shiftCount + 1,
    });
  }
  return {
    date: fecha,
    cashCents: efectivo,
    transferCents: transferencia,
    totalCents: efectivo + transferencia,
    expectedCashCents: esperado,
    shiftCount: delDia.length,
    byCashier: [...porCajero.entries()]
      .map(([cashierId, v]) => ({ cashierId, ...v, totalCents: v.cashCents + v.transferCents }))
      .sort((a, b) => a.cashierId.localeCompare(b.cashierId)),
  };
}
