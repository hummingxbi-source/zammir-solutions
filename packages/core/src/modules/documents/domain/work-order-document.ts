import { mexicoDate } from '../../../shared-kernel/date/mx-date';
import { formatMoney, money } from '../../../shared-kernel/money/money';
import type { Payment } from '../../payments/domain/payment';
import { balanceCents } from '../../payments/domain/payment';
import type { Warranty, WorkOrder } from '../../orders/domain/work-order';
import {
  formatDate,
  splitConditions,
  type BusinessIdentity,
  type DocumentCustomer,
  type DocumentLabels,
  type QuoteDocument,
  type ReceiptExtras,
} from './quote-document';

/** Dirección base de los enlaces de autofacturación mientras ZAMMIR no defina la suya (PD-10). Es un
 *  dominio de prueba que no existe: nada apunta a una página real todavía. */
export const TEST_SELF_INVOICING_BASE_URL = 'https://pruebas.zammir.invalid';

/** Enlace que lleva el QR: el folio y el código de verificación, y nada personal [RF-M3-06, RN-26].
 *  Con folio definitivo si ya se envió; si no, con el provisional. El código público es aleatorio y no se
 *  puede deducir del folio. */
export function autoinvoiceUrl(baseUrl: string | null, folio: string, code: string): string {
  const base = (baseUrl ?? TEST_SELF_INVOICING_BASE_URL).replace(/\/+$/, '');
  return `${base}/f/${encodeURIComponent(folio)}/${encodeURIComponent(code)}`;
}

function dinero(centavos: number): string {
  const r = money(centavos);
  return r.ok ? formatMoney(r.value) : '$0.00';
}

export interface ReceiptLabels {
  readonly document: DocumentLabels;
  readonly extras: ReceiptExtras['labels'];
  /** Nombres de cada tipo de pago, para los renglones. */
  readonly kind: { readonly DEPOSIT: string; readonly BALANCE: string; readonly SALE: string };
  readonly method: { readonly CASH: string; readonly TRANSFER: string };
  /** Estatus de la orden, ya en español. */
  readonly status: Readonly<Record<WorkOrder['status'], string>>;
  /** \`{date}\`, \`{months}\`, \`{coverage}\`, \`{exclusions}\` en cada renglón de la garantía. */
  readonly warrantyStart: string;
  readonly warrantyDuration: string;
  readonly warrantyCoverage: string;
  readonly warrantyExclusions: string;
  readonly provisionalNote: string;
}

export interface BuildReceiptInput {
  readonly order: WorkOrder;
  readonly payments: readonly Payment[];
  readonly customer: DocumentCustomer;
  readonly business: BusinessIdentity;
  readonly warranty: Warranty | null;
  readonly conditions: string;
  readonly privacyNotice: string;
  /** Leyenda del plazo de autofacturación, una por renglón (PD-09, configurable). */
  readonly selfInvoicingLegend: string;
  readonly publicBaseUrl: string | null;
  /** Genera la matriz del QR; viene de la capa de infraestructura. */
  readonly qrMatrix: (texto: string) => readonly (readonly boolean[])[];
  readonly labels: ReceiptLabels;
}

/** Arma el comprobante de trabajo [RF-M3-06]: folio, cliente, conceptos y medidas, total, anticipo, saldo,
 *  condiciones, garantía y QR. Es el mismo modelo que el de la cotización con lo extra aparte, así el PDF y
 *  la pantalla dicen lo mismo al centavo. Los totales son los de la orden; el saldo es total − pagos. */
export function buildWorkOrderDocument(entrada: BuildReceiptInput): QuoteDocument {
  const { order, labels } = entrada;
  const pagado = entrada.payments.reduce((suma, p) => suma + p.amountCents, 0);
  const saldo = balanceCents(order.totalCents, entrada.payments);
  const enviada = order.folio !== null;
  const folio = order.folio ?? order.tempFolio;
  const url = autoinvoiceUrl(entrada.publicBaseUrl, folio, order.publicCode);

  const lineasDePago = [...entrada.payments]
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
    .map(
      (p) =>
        `${labels.kind[p.kind]} · ${labels.method[p.method]} · ${dinero(p.amountCents)} · ${formatDate(mexicoDate(new Date(p.paidAt)))}`,
    );

  const garantia: string[] = [];
  if (entrada.warranty !== null) {
    garantia.push(labels.warrantyStart.replace('{date}', formatDate(entrada.warranty.startsOn)));
    if (entrada.warranty.durationMonths !== null) {
      garantia.push(
        labels.warrantyDuration.replace('{months}', String(entrada.warranty.durationMonths)),
      );
    }
    if (entrada.warranty.coverage !== null) {
      garantia.push(labels.warrantyCoverage.replace('{coverage}', entrada.warranty.coverage));
    }
    if (entrada.warranty.exclusions !== null) {
      garantia.push(labels.warrantyExclusions.replace('{exclusions}', entrada.warranty.exclusions));
    }
  }

  return {
    business: entrada.business,
    folioLabel: enviada ? folio : `${labels.provisionalNote} ${order.tempFolio}`,
    folio: order.folio,
    tempFolio: order.tempFolio,
    publicCode: order.publicCode,
    provisionalNote: enviada ? null : labels.provisionalNote,
    issuedDate: formatDate(mexicoDate(new Date(order.issuedAt))),
    validUntilDate: '',
    customer: entrada.customer,
    siteAddress: order.siteAddress,
    lines: order.lines.map((l, i) => ({
      position: i + 1,
      name: l.name,
      detail: l.detail,
      quantity: String(l.quantity),
      unitPrice: dinero(l.unitPriceCents),
      amount: dinero(l.lineTotalCents),
    })),
    subtotal: dinero(order.subtotalCents),
    tax: dinero(order.taxCents),
    total: dinero(order.totalCents),
    conditions: splitConditions(entrada.conditions),
    privacyNotice: entrada.privacyNotice,
    isDraft: false,
    labels: labels.document,
    receipt: {
      labels: labels.extras,
      status: labels.status[order.status],
      depositRequired: dinero(order.depositRequiredCents),
      paid: dinero(pagado),
      balance: saldo === 0 ? labels.extras.settled : dinero(saldo),
      isSettled: saldo === 0,
      paymentLines: lineasDePago,
      warrantyLines: garantia,
      qr: {
        matrix: entrada.qrMatrix(url),
        url,
        code: order.publicCode,
        legend: splitConditions(entrada.selfInvoicingLegend),
      },
    },
  };
}
