import { mexicoDate } from '../../../shared-kernel/date/mx-date';
import { formatMoney, money } from '../../../shared-kernel/money/money';
import type { CashShift, CashShiftSummary } from '../../cash/domain/cash-shift';
import { formatDate, type BusinessIdentity } from './quote-document';
import type { SheetRow, SummarySheet } from './summary-sheet';

function dinero(centavos: number): string {
  const r = money(centavos);
  return r.ok ? formatMoney(r.value) : '$0.00';
}

/** `31 oct 2026, 12:05`, en hora de la Ciudad de México [RN-17]. */
function fechaYHora(iso: string): string {
  const instante = new Date(iso);
  const hora = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instante);
  return `${formatDate(mexicoDate(instante))}, ${hora}`;
}

export interface ShiftCutLabels {
  readonly title: string;
  /** Con `{name}`: `Turno de Beto`. */
  readonly subtitle: string;
  /** Con `{date}`: `Abrió: 31 oct 2026, 09:00`. */
  readonly opened: string;
  readonly closed: string;
  readonly collections: string;
  readonly openingFloat: string;
  readonly counterSales: string;
  readonly orderPayments: string;
  readonly cashCollected: string;
  readonly transferCollected: string;
  readonly totalCollected: string;
  readonly cash: string;
  readonly expectedCash: string;
  readonly countedCash: string;
  readonly difference: string;
  readonly exact: string;
  readonly over: string;
  readonly short: string;
  readonly cancelled: string;
  /** Con `{count}`: `Ventas canceladas ({count})`. */
  readonly cancelledSales: string;
  readonly cancelledNote: string;
  readonly page: string;
}

export interface BuildShiftCutInput {
  readonly shift: CashShift;
  readonly summary: CashShiftSummary;
  readonly cashierName: string;
  readonly business: BusinessIdentity;
  readonly labels: ShiftCutLabels;
}

export type ShiftCutError = 'SHIFT_NOT_CLOSED';

/** Arma la hoja del corte de caja de un turno cerrado [RF-M4-06, ADR-0040]. Los importes son los que calcula
 *  el núcleo (nada se recalcula aquí), así la pantalla y el papel dicen lo mismo al centavo. Un turno
 *  abierto no tiene corte todavía: devuelve el error en lugar de una hoja a medias. */
export function buildShiftCutSheet(
  entrada: BuildShiftCutInput,
):
  | { readonly ok: true; readonly sheet: SummarySheet }
  | { readonly ok: false; readonly error: ShiftCutError } {
  const { shift, summary: s, labels: l } = entrada;
  if (shift.status !== 'CLOSED' || shift.closedAt === null) {
    return { ok: false, error: 'SHIFT_NOT_CLOSED' };
  }

  const cobros: SheetRow[] = [
    { label: l.openingFloat, value: dinero(s.openingFloatCents) },
    { label: l.counterSales, value: dinero(s.salesCents) },
    { label: l.orderPayments, value: dinero(s.orderPaymentsCents) },
    { label: l.cashCollected, value: dinero(s.cashCents) },
    { label: l.transferCollected, value: dinero(s.transferCents) },
    { label: l.totalCollected, value: dinero(s.cashCents + s.transferCents), strong: true },
  ];

  const efectivo: SheetRow[] = [
    { label: l.expectedCash, value: dinero(s.expectedCashCents), strong: true },
  ];
  if (shift.countedCashCents !== null) {
    efectivo.push({ label: l.countedCash, value: dinero(shift.countedCashCents) });
    const d = s.differenceCents ?? 0;
    efectivo.push({
      label: l.difference,
      value: d === 0 ? l.exact : `${d > 0 ? l.over : l.short} ${dinero(Math.abs(d))}`,
      strong: true,
    });
  }

  const secciones = [
    { title: l.collections, rows: cobros },
    { title: l.cash, rows: efectivo },
  ];
  if (s.cancelledSalesCents > 0) {
    secciones.push({
      title: l.cancelled,
      rows: [
        {
          label: l.cancelledSales.replace('{count}', String(s.cancelledSalesCount)),
          value: dinero(s.cancelledSalesCents),
        },
      ],
    });
  }

  return {
    ok: true,
    sheet: {
      business: entrada.business,
      title: l.title,
      subtitle: l.subtitle.replace('{name}', entrada.cashierName),
      meta: [
        l.opened.replace('{date}', fechaYHora(shift.openedAt)),
        l.closed.replace('{date}', fechaYHora(shift.closedAt)),
      ],
      sections: secciones,
      note: s.cancelledSalesCents > 0 ? l.cancelledNote : null,
      pageLabel: l.page,
    },
  };
}
