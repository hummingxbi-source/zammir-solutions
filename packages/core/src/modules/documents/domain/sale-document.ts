import { mexicoDate } from '../../../shared-kernel/date/mx-date';
import { formatMoney, money } from '../../../shared-kernel/money/money';
import type { CounterSale, CounterSaleStatus } from '../../counter/domain/counter-sale';
import type { Payment } from '../../payments/domain/payment';
import { autoinvoiceUrl } from './work-order-document';
import {
  formatDate,
  splitConditions,
  type BusinessIdentity,
  type DocumentCustomer,
  type DocumentLabels,
  type QuoteDocument,
  type ReceiptExtras,
} from './quote-document';

function dinero(centavos: number): string {
  const r = money(centavos);
  return r.ok ? formatMoney(r.value) : '$0.00';
}

export interface SaleLabels {
  readonly document: DocumentLabels;
  readonly extras: ReceiptExtras['labels'];
  /** Nombre del tipo de pago en los renglones (una venta de mostrador siempre es `Venta`). */
  readonly saleKind: string;
  readonly method: { readonly CASH: string; readonly TRANSFER: string };
  readonly status: Readonly<Record<CounterSaleStatus, string>>;
  /** Cliente que se anota cuando la venta no tiene uno. */
  readonly counterCustomer: string;
  /** Con `{name}`: `Atendió: Beto`. */
  readonly attendedBy: string;
  /** Con `{amount}`: `Cambio $20.00`. */
  readonly change: string;
  readonly provisionalNote: string;
}

export interface BuildSaleDocumentInput {
  readonly sale: CounterSale;
  readonly payments: readonly Payment[];
  /** `null` si la venta no tiene cliente: sale el rótulo de mostrador y sin teléfono. */
  readonly customer: DocumentCustomer | null;
  readonly cashierName: string;
  readonly business: BusinessIdentity;
  readonly conditions: string;
  readonly privacyNotice: string;
  readonly terms?: { readonly title: string; readonly lines: readonly string[] } | null;
  /** Leyenda del plazo de autofacturación, una por renglón (PD-09, configurable). */
  readonly selfInvoicingLegend: string;
  readonly publicBaseUrl: string | null;
  readonly qrMatrix: (texto: string) => readonly (readonly boolean[])[];
  /** Si el comprobante lleva QR y leyenda de autofacturación; en pausa no se menciona la factura [ADR-0039]. */
  readonly autofacturacion: boolean;
  readonly labels: SaleLabels;
}

/** Arma el comprobante de una venta de mostrador en hoja carta [RF-M4-04, ADR-0040]: folio, fecha, quién
 *  atendió, conceptos, total, pagos y cambio. Usa el mismo modelo que la cotización y el comprobante de
 *  trabajo, con lo propio de la venta aparte; los totales son los de la venta, nunca se recalculan, así la
 *  pantalla y el papel dicen lo mismo al centavo [ADR-0011]. Una venta se paga completa: no lleva anticipo
 *  ni garantía. */
export function buildSaleDocument(entrada: BuildSaleDocumentInput): QuoteDocument {
  const { sale, labels } = entrada;
  const pagado = entrada.payments.reduce((suma, p) => suma + p.amountCents, 0);
  const enviada = sale.folio !== null;
  const folio = sale.folio ?? sale.tempFolio;
  const cancelada = sale.status === 'CANCELLED';

  const lineasDePago = [...entrada.payments]
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
    .map((p) => {
      const base = `${labels.saleKind} · ${labels.method[p.method]} · ${dinero(p.amountCents)} · ${formatDate(mexicoDate(new Date(p.paidAt)))}`;
      return p.changeCents !== null && p.changeCents > 0
        ? `${base} · ${labels.change.replace('{amount}', dinero(p.changeCents))}`
        : base;
    });

  const url = autoinvoiceUrl(entrada.publicBaseUrl, folio, sale.publicCode);
  const extras: ReceiptExtras = {
    labels: labels.extras,
    status: labels.status[sale.status],
    depositRequired: null,
    attendedBy: labels.attendedBy.replace('{name}', entrada.cashierName),
    paid: dinero(pagado),
    // Una venta se paga completa; si no está pagada del todo, se muestra lo que falta en vez de "Liquidado".
    balance: pagado >= sale.totalCents ? labels.extras.settled : dinero(sale.totalCents - pagado),
    isSettled: pagado >= sale.totalCents,
    paymentLines: lineasDePago,
    warrantyLines: [],
    qr:
      entrada.autofacturacion && !cancelada
        ? {
            matrix: entrada.qrMatrix(url),
            url,
            code: sale.publicCode,
            legend: splitConditions(entrada.selfInvoicingLegend),
          }
        : null,
  };

  return {
    business: entrada.business,
    folioLabel: enviada ? folio : `${labels.provisionalNote} ${sale.tempFolio}`,
    folio: sale.folio,
    tempFolio: sale.tempFolio,
    // Sin facturación el código no sirve de nada en el papel [ADR-0039].
    publicCode: entrada.autofacturacion ? sale.publicCode : null,
    provisionalNote: enviada ? null : labels.provisionalNote,
    issuedDate: formatDate(mexicoDate(new Date(sale.issuedAt))),
    validUntilDate: '',
    customer: entrada.customer ?? { name: labels.counterCustomer, phone: '' },
    siteAddress: null,
    lines: sale.lines.map((l, i) => ({
      position: i + 1,
      name: l.name,
      ...(l.description === undefined ? {} : { description: l.description }),
      detail: l.detail,
      quantity: String(l.quantity),
      unitPrice: dinero(l.unitPriceCents),
      amount: dinero(l.lineTotalCents),
    })),
    subtotal: dinero(sale.subtotalCents),
    tax: dinero(sale.taxCents),
    total: dinero(sale.totalCents),
    conditions: splitConditions(entrada.conditions),
    privacyNotice: entrada.privacyNotice,
    terms: entrada.terms ?? null,
    isDraft: false,
    labels: labels.document,
    receipt: extras,
  };
}
