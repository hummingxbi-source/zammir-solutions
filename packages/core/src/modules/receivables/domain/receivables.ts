import { mexicoDate } from '../../../shared-kernel/date/mx-date';
import type { WorkOrder } from '../../orders/domain/work-order';
import { balanceCents, type Payment } from '../../payments/domain/payment';

/** Días sin pagar a partir de los cuales una cuenta se resalta (PD-33: 10 por omisión, configurable). */
export const DEFAULT_OVERDUE_DAYS = 10;

/** Una orden con saldo por cobrar [RF-M6-01]. */
export interface ReceivableRow {
  readonly orderId: string;
  readonly folio: string;
  readonly customerId: string;
  readonly totalCents: number;
  readonly paidCents: number;
  readonly balanceCents: number;
  /** Día en que se hizo la orden, en hora de México; `null` si la fecha no es válida. */
  readonly issuedOn: string | null;
  /** Días naturales desde la orden. Nunca negativo; `null` si la fecha no es válida. */
  readonly daysOutstanding: number | null;
  /** Llegó o pasó el umbral de atraso. */
  readonly overdue: boolean;
}

export interface ReceivablesSummary {
  readonly count: number;
  readonly totalBalanceCents: number;
  readonly overdueCount: number;
  readonly overdueBalanceCents: number;
}

function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  const ms =
    Date.UTC(a2 ?? 1970, (m2 ?? 1) - 1, d2 ?? 1) - Date.UTC(a1 ?? 1970, (m1 ?? 1) - 1, d1 ?? 1);
  return Math.round(ms / 86_400_000);
}

/** Día calendario de una orden, o `null` si el instante no es una fecha válida. */
function diaDeLaOrden(iso: string): string | null {
  const instante = new Date(iso);
  return Number.isNaN(instante.getTime()) ? null : mexicoDate(instante);
}

/** Órdenes con saldo mayor a cero, de la más atrasada a la más reciente. Las canceladas no se cobran y las
 *  saldadas no aparecen. Los días se cuentan en calendario de México contra `today`; una fecha futura da 0
 *  y una inválida no da días [RN-17]. */
export function buildReceivables(entrada: {
  readonly orders: readonly Pick<
    WorkOrder,
    'id' | 'status' | 'customerId' | 'totalCents' | 'folio' | 'tempFolio' | 'issuedAt'
  >[];
  readonly payments: readonly Pick<Payment, 'targetType' | 'targetId' | 'amountCents'>[];
  /** Hoy, `AAAA-MM-DD`, en hora de México. */
  readonly today: string;
  readonly overdueDays?: number;
}): readonly ReceivableRow[] {
  const umbral = entrada.overdueDays ?? DEFAULT_OVERDUE_DAYS;
  const filas: ReceivableRow[] = [];
  for (const o of entrada.orders) {
    if (o.status === 'CANCELLED') {
      continue;
    }
    const pagos = entrada.payments.filter(
      (p) => p.targetType === 'WORK_ORDER' && p.targetId === o.id,
    );
    const saldo = balanceCents(o.totalCents, pagos);
    if (saldo <= 0) {
      continue;
    }
    const dia = diaDeLaOrden(o.issuedAt);
    const dias = dia === null ? null : Math.max(0, diasEntre(dia, entrada.today));
    filas.push({
      orderId: o.id,
      folio: o.folio ?? o.tempFolio,
      customerId: o.customerId,
      totalCents: o.totalCents,
      paidCents: o.totalCents - saldo,
      balanceCents: saldo,
      issuedOn: dia,
      daysOutstanding: dias,
      overdue: dias !== null && dias >= umbral,
    });
  }
  return filas.sort(
    (a, b) =>
      (b.daysOutstanding ?? -1) - (a.daysOutstanding ?? -1) || b.balanceCents - a.balanceCents,
  );
}

export function summarizeReceivables(filas: readonly ReceivableRow[]): ReceivablesSummary {
  const atrasadas = filas.filter((f) => f.overdue);
  return {
    count: filas.length,
    totalBalanceCents: filas.reduce((s, f) => s + f.balanceCents, 0),
    overdueCount: atrasadas.length,
    overdueBalanceCents: atrasadas.reduce((s, f) => s + f.balanceCents, 0),
  };
}

/** Llena una plantilla de mensaje: `{cliente}`, `{folio}`, `{saldo}` y `{negocio}`. Lo que no se conoce
 *  se deja tal cual, para que no salga un mensaje a medias sin que nadie lo note. */
export function fillTemplate(plantilla: string, valores: Readonly<Record<string, string>>): string {
  return plantilla.replace(/\{(\w+)\}/g, (completo, clave: string) => valores[clave] ?? completo);
}
