import { formatMoney, money } from '../../../shared-kernel/money/money';
import { autoinvoiceUrl } from '../../documents/domain/work-order-document';
import type { CashShiftSummary } from '../../cash/domain/cash-shift';
import type { CounterSale } from '../../counter/domain/counter-sale';
import type { WorkOrder } from '../../orders/domain/work-order';
import { balanceCents, type Payment } from '../../payments/domain/payment';
import type { PaperWidth, PrintBlock, PrintDocument } from './print-document';
import { wrapText } from './print-document';

/** Textos del ticket, ya en español; los pone la interfaz (el dominio no trae palabras sueltas). */
export interface TicketLabels {
  readonly sale: string;
  readonly orderPayment: string;
  readonly shiftCut: string;
  readonly testPage: string;
  readonly testPageBody: string;
  readonly folio: string;
  readonly provisional: string;
  readonly date: string;
  readonly customer: string;
  readonly attendedBy: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
  readonly change: string;
  readonly cashReceived: string;
  readonly paid: string;
  readonly balance: string;
  readonly code: string;
  readonly reprint: string;
  readonly cancelled: string;
  readonly thanks: string;
  readonly kind: { readonly DEPOSIT: string; readonly BALANCE: string; readonly SALE: string };
  readonly method: { readonly CASH: string; readonly TRANSFER: string };
  readonly opened: string;
  readonly closed: string;
  readonly openingFloat: string;
  readonly cashCollected: string;
  readonly transferCollected: string;
  readonly expectedCash: string;
  readonly countedCash: string;
  readonly difference: string;
  readonly exact: string;
  readonly over: string;
  readonly short: string;
  readonly cancelledSales: string;
}

export interface TicketBusiness {
  readonly name: string;
  readonly phone: string | null;
  readonly address: string | null;
}

interface TicketCommon {
  readonly business: TicketBusiness;
  readonly labels: TicketLabels;
  readonly width: PaperWidth;
  /** Es una copia de un ticket ya impreso. */
  readonly reprint?: boolean;
}

const dinero = (centavos: number): string => {
  const r = money(centavos);
  return r.ok ? formatMoney(r.value) : '$0.00';
};

/** Fecha y hora de México como `31/10/2026 12:00` (las fechas viajan en UTC y se muestran aquí [RN-17]). */
export function fechaHoraDeMexico(iso: string): string {
  const partes = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const dato = (tipo: string): string => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${dato('day')}/${dato('month')}/${dato('year')} ${dato('hour')}:${dato('minute')}`;
}

function encabezado(c: TicketCommon, titulo: string): PrintBlock[] {
  const bloques: PrintBlock[] = [
    { kind: 'text', text: c.business.name, align: 'center', bold: true, large: true },
  ];
  if (c.business.address !== null) {
    bloques.push({ kind: 'text', text: c.business.address, align: 'center' });
  }
  if (c.business.phone !== null) {
    bloques.push({ kind: 'text', text: c.business.phone, align: 'center' });
  }
  bloques.push({ kind: 'rule' }, { kind: 'text', text: titulo, align: 'center', bold: true });
  if (c.reprint === true) {
    bloques.push({ kind: 'text', text: c.labels.reprint, align: 'center', bold: true });
  }
  return bloques;
}

function cobros(l: TicketLabels, pagos: readonly Payment[]): PrintBlock[] {
  const bloques: PrintBlock[] = [];
  for (const p of pagos) {
    bloques.push({
      kind: 'pair',
      left: `${l.kind[p.kind]} ${l.method[p.method]}`,
      right: dinero(p.amountCents),
    });
    if (p.method === 'CASH' && p.cashReceivedCents !== null) {
      bloques.push({
        kind: 'pair',
        left: `  ${l.cashReceived}`,
        right: dinero(p.cashReceivedCents),
      });
      if (p.changeCents !== null && p.changeCents > 0) {
        bloques.push({ kind: 'pair', left: `  ${l.change}`, right: dinero(p.changeCents) });
      }
    }
  }
  return bloques;
}

function pieDeAutofactura(
  l: TicketLabels,
  folio: string,
  codigo: string,
  leyenda: string,
  baseUrl: string | null,
): PrintBlock[] {
  const bloques: PrintBlock[] = [{ kind: 'rule' }];
  if (leyenda.trim() !== '') {
    bloques.push({ kind: 'text', text: leyenda.trim() });
  }
  bloques.push(
    { kind: 'qr', text: autoinvoiceUrl(baseUrl, folio, codigo) },
    { kind: 'text', text: `${l.code}: ${codigo}`, align: 'center' },
    { kind: 'text', text: l.thanks, align: 'center' },
    { kind: 'feed', lines: 1 },
  );
  return bloques;
}

export interface SaleTicketInput extends TicketCommon {
  readonly sale: CounterSale;
  readonly payments: readonly Payment[];
  readonly customerName: string | null;
  readonly cashierName: string;
  /** Leyenda del plazo de autofacturación (PD-09, configurable). */
  readonly selfInvoicingLegend: string;
  readonly publicBaseUrl: string | null;
}

/** Ticket de una venta de mostrador, con QR y leyenda de autofacturación [RF-M4-05]. */
export function saleTicket(e: SaleTicketInput): PrintDocument {
  const { sale, labels: l } = e;
  const folio = sale.folio ?? sale.tempFolio;
  const bloques: PrintBlock[] = [...encabezado(e, l.sale)];
  bloques.push({
    kind: 'pair',
    left: `${l.folio} ${folio}`,
    right: sale.folio === null ? l.provisional : '',
  });
  bloques.push({ kind: 'text', text: `${l.date}: ${fechaHoraDeMexico(sale.issuedAt)}` });
  if (e.customerName !== null) {
    bloques.push({ kind: 'text', text: `${l.customer}: ${e.customerName}` });
  }
  bloques.push({ kind: 'text', text: `${l.attendedBy}: ${e.cashierName}` });
  if (sale.status === 'CANCELLED') {
    bloques.push({ kind: 'text', text: l.cancelled, align: 'center', bold: true });
  }
  bloques.push({ kind: 'rule' });
  for (const linea of sale.lines) {
    bloques.push({ kind: 'text', text: linea.name });
    bloques.push({
      kind: 'pair',
      left: `  ${String(linea.quantity)} x ${dinero(linea.unitPriceCents)}`,
      right: dinero(linea.lineTotalCents),
    });
  }
  bloques.push(
    { kind: 'rule' },
    { kind: 'pair', left: l.subtotal, right: dinero(sale.subtotalCents) },
    { kind: 'pair', left: l.tax, right: dinero(sale.taxCents) },
    { kind: 'pair', left: l.total, right: dinero(sale.totalCents), bold: true },
    ...cobros(l, e.payments),
    ...pieDeAutofactura(l, folio, sale.publicCode, e.selfInvoicingLegend, e.publicBaseUrl),
  );
  return { title: `${l.sale} ${folio}`, width: e.width, blocks: bloques };
}

export interface OrderPaymentTicketInput extends TicketCommon {
  readonly order: WorkOrder;
  /** El cobro que se está comprobando. */
  readonly payment: Payment;
  /** Todos los pagos de la orden, para el saldo. */
  readonly payments: readonly Payment[];
  readonly customerName: string;
  readonly cashierName: string;
  readonly selfInvoicingLegend: string;
  readonly publicBaseUrl: string | null;
}

/** Comprobante de un anticipo o del saldo de una orden: lo cobrado ahora y cuánto falta. */
export function orderPaymentTicket(e: OrderPaymentTicketInput): PrintDocument {
  const { order, labels: l } = e;
  const folio = order.folio ?? order.tempFolio;
  const bloques: PrintBlock[] = [...encabezado(e, l.orderPayment)];
  bloques.push({
    kind: 'pair',
    left: `${l.folio} ${folio}`,
    right: order.folio === null ? l.provisional : '',
  });
  bloques.push(
    { kind: 'text', text: `${l.date}: ${fechaHoraDeMexico(e.payment.paidAt)}` },
    { kind: 'text', text: `${l.customer}: ${e.customerName}` },
    { kind: 'text', text: `${l.attendedBy}: ${e.cashierName}` },
    { kind: 'rule' },
    ...cobros(l, [e.payment]),
    { kind: 'rule' },
    { kind: 'pair', left: l.total, right: dinero(order.totalCents) },
    {
      kind: 'pair',
      left: l.paid,
      right: dinero(e.payments.reduce((s, p) => s + p.amountCents, 0)),
    },
    {
      kind: 'pair',
      left: l.balance,
      right: dinero(balanceCents(order.totalCents, e.payments)),
      bold: true,
    },
    ...pieDeAutofactura(l, folio, order.publicCode, e.selfInvoicingLegend, e.publicBaseUrl),
  );
  return { title: `${l.orderPayment} ${folio}`, width: e.width, blocks: bloques };
}

export interface ShiftCutTicketInput extends TicketCommon {
  readonly cashierName: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly summary: CashShiftSummary;
  readonly countedCashCents: number | null;
}

/** Resumen del corte de caja del turno [S3-17]. */
export function shiftCutTicket(e: ShiftCutTicketInput): PrintDocument {
  const { summary: s, labels: l } = e;
  const bloques: PrintBlock[] = [...encabezado(e, l.shiftCut)];
  bloques.push(
    { kind: 'text', text: `${l.attendedBy}: ${e.cashierName}` },
    { kind: 'text', text: `${l.opened}: ${fechaHoraDeMexico(e.openedAt)}` },
  );
  if (e.closedAt !== null) {
    bloques.push({ kind: 'text', text: `${l.closed}: ${fechaHoraDeMexico(e.closedAt)}` });
  }
  bloques.push(
    { kind: 'rule' },
    { kind: 'pair', left: l.openingFloat, right: dinero(s.openingFloatCents) },
    { kind: 'pair', left: l.cashCollected, right: dinero(s.cashCents) },
    { kind: 'pair', left: l.transferCollected, right: dinero(s.transferCents) },
    { kind: 'pair', left: l.expectedCash, right: dinero(s.expectedCashCents), bold: true },
  );
  if (e.countedCashCents !== null) {
    bloques.push({ kind: 'pair', left: l.countedCash, right: dinero(e.countedCashCents) });
    const d = s.differenceCents ?? 0;
    bloques.push({
      kind: 'pair',
      left: l.difference,
      right: d === 0 ? l.exact : `${d > 0 ? l.over : l.short} ${dinero(Math.abs(d))}`,
      bold: true,
    });
  }
  if (s.cancelledSalesCents > 0) {
    bloques.push({
      kind: 'pair',
      left: `${l.cancelledSales} (${String(s.cancelledSalesCount)})`,
      right: dinero(s.cancelledSalesCents),
    });
  }
  bloques.push({ kind: 'feed', lines: 1 });
  return { title: l.shiftCut, width: e.width, blocks: bloques };
}

/** Página de prueba de la impresora [S3-23]: sirve para ver el ancho, los acentos y el QR. */
export function testPage(e: TicketCommon): PrintDocument {
  const l = e.labels;
  return {
    title: l.testPage,
    width: e.width,
    blocks: [
      ...encabezado(e, l.testPage),
      ...wrapText(l.testPageBody, e.width).map((t): PrintBlock => ({ kind: 'text', text: t })),
      { kind: 'text', text: 'áéíóú ñ Ñ ¿? ¡! ü', align: 'center' },
      { kind: 'qr', text: autoinvoiceUrl(null, 'PRUEBA', 'PRUEBA') },
      { kind: 'feed', lines: 1 },
    ],
  };
}
