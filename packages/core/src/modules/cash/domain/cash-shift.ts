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
  /** Contado − esperado (positivo = sobrante, negativo = faltante). Solo se registra (PD-44). */
  readonly differenceCents: number | null;
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
  /** Fondo + efectivo cobrado: lo que debe haber en el cajón (PD-37: sin retiros). */
  readonly expectedCashCents: number;
  /** Cobros de ventas canceladas: no cuentan en el corte y se muestran aparte (PD-24). */
  readonly cancelledSalesCents: number;
  readonly cancelledSalesCount: number;
  /** Contado − esperado; `null` mientras no se haya contado. */
  readonly differenceCents: number | null;
}

/** Calcula el corte de un turno a partir de su fondo y de sus cobros. Función pura: no lee nada más
 *  [RF-M4-06, RN-11]. Un cobro de una venta cancelada sale del corte y queda aparte (PD-24 sin respuesta). */
export function summarizeShift(entrada: {
  readonly openingFloatCents: number;
  readonly payments: readonly ShiftPayment[];
  readonly cancelledSaleIds: ReadonlySet<string>;
  readonly countedCashCents: number | null;
}): CashShiftSummary {
  let efectivo = 0;
  let transferencia = 0;
  let ventas = 0;
  let ordenes = 0;
  let canceladas = 0;
  const ventasCanceladas = new Set<string>();
  for (const p of entrada.payments) {
    if (p.targetType === 'COUNTER_SALE' && entrada.cancelledSaleIds.has(p.targetId)) {
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
  const esperado = entrada.openingFloatCents + efectivo;
  return {
    openingFloatCents: entrada.openingFloatCents,
    cashCents: efectivo,
    transferCents: transferencia,
    salesCents: ventas,
    orderPaymentsCents: ordenes,
    expectedCashCents: esperado,
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
  for (const { shift, summary } of delDia) {
    efectivo += summary.cashCents;
    transferencia += summary.transferCents;
    esperado += summary.expectedCashCents;
    const actual = porCajero.get(shift.cashierId) ?? {
      cashCents: 0,
      transferCents: 0,
      shiftCount: 0,
    };
    porCajero.set(shift.cashierId, {
      cashCents: actual.cashCents + summary.cashCents,
      transferCents: actual.transferCents + summary.transferCents,
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
