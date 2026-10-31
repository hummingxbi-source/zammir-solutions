import { formatMoney } from '../../../shared-kernel/money/money';
import { money } from '../../../shared-kernel/money/money';
import { mexicoDate } from '../../../shared-kernel/date/mx-date';
import type { Quote, QuoteLine } from '../../quotes/domain/quote';
import { quoteTotals } from '../../quotes/domain/quote';

/** Datos del negocio que salen en los documentos [RN-21]. Hasta que ZAMMIR los defina (PD-11) son de
 *  prueba; nunca se escribe HummingX. */
export interface BusinessIdentity {
  readonly name: string;
  readonly phone: string | null;
  readonly address: string | null;
  /** Logo en PNG o JPG (bytes), si ya se bajó a la tablet. */
  readonly logo?: { readonly bytes: Uint8Array; readonly format: 'png' | 'jpg' };
}

export interface DocumentCustomer {
  readonly name: string;
  /** 10 dígitos. */
  readonly phone: string;
}

/** Rótulos fijos del documento, ya en español de México: llegan del idioma de la aplicación para que el
 *  núcleo no escriba textos de pantalla. */
export interface DocumentLabels {
  readonly title: string;
  readonly folio: string;
  readonly date: string;
  readonly validUntil: string;
  readonly customer: string;
  readonly phone: string;
  readonly site: string;
  readonly concept: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly amount: string;
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
  readonly conditions: string;
  readonly signature: string;
  readonly publicCode: string;
  /** Con `{n}` y `{total}`: `Página {n} de {total}`. */
  readonly page: string;
  readonly draft: string;
}

export interface QuoteDocumentLine {
  readonly position: number;
  readonly name: string;
  /** El cálculo tal como se muestra en pantalla (medidas, unidad, precio). */
  readonly detail: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly amount: string;
}

/** Lo que agrega el comprobante de trabajo a un documento [RF-M3-06]: pagos y saldo, garantía y el QR de
 *  autofacturación. Todo ya redactado; el renderizador solo lo dibuja. */
export interface ReceiptExtras {
  readonly labels: {
    readonly payments: string;
    readonly depositRequired: string;
    readonly paid: string;
    readonly balance: string;
    readonly settled: string;
    readonly warranty: string;
    readonly selfInvoicing: string;
    readonly verificationCode: string;
  };
  readonly status: string;
  readonly depositRequired: string;
  readonly paid: string;
  /** `Liquidado` cuando el saldo es cero; si no, el importe. */
  readonly balance: string;
  readonly isSettled: boolean;
  /** Un renglón por pago: `Anticipo · Efectivo · $580.00 · 31 oct 2026`. */
  readonly paymentLines: readonly string[];
  /** Renglones de la garantía; vacío mientras la orden no se entregue. */
  readonly warrantyLines: readonly string[];
  /** QR de autofacturación: matriz de módulos (true = oscuro), la dirección que contiene y el código. */
  readonly qr: {
    readonly matrix: readonly (readonly boolean[])[];
    readonly url: string;
    readonly code: string;
    readonly legend: readonly string[];
  };
}

/** Modelo de documento YA CALCULADO: lo recibe el renderizador y la vista previa. No conoce
 *  repositorios ni reglas: todo lo que dice viene de la cotización [S2-12, S2-19, principio I]. */
export interface QuoteDocument {
  readonly business: BusinessIdentity;
  /** `COT-2026-0012`, o `Folio provisional T1-0004` mientras no se haya enviado. */
  readonly folioLabel: string;
  readonly folio: string | null;
  readonly tempFolio: string | null;
  readonly publicCode: string | null;
  /** Solo si no se ha enviado: aclara que el folio es provisional. */
  readonly provisionalNote: string | null;
  readonly issuedDate: string;
  readonly validUntilDate: string;
  readonly customer: DocumentCustomer;
  readonly siteAddress: string | null;
  readonly lines: readonly QuoteDocumentLine[];
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
  readonly conditions: readonly string[];
  /** Aviso de privacidad abreviado (texto de prueba hasta PD-12). */
  readonly privacyNotice: string;
  readonly isDraft: boolean;
  readonly labels: DocumentLabels;
  /** Solo el comprobante de trabajo lo trae. */
  readonly receipt?: ReceiptExtras;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `2026-10-27` → `27 oct 2026` [RN-22]. */
export function formatDate(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return `${String(dia ?? 0)} ${MESES[(mes ?? 1) - 1] ?? ''} ${String(anio ?? 0)}`;
}

/** Teléfono de 10 dígitos para leerse: `55 1234 5678` [RN-22]. */
export function formatPhone(diez: string): string {
  return `${diez.slice(0, 2)} ${diez.slice(2, 6)} ${diez.slice(6)}`;
}

function dinero(centavos: number): string {
  const r = money(centavos);
  return r.ok ? formatMoney(r.value) : '$0.00';
}

function lineaDeDocumento(l: QuoteLine, posicion: number): QuoteDocumentLine {
  return {
    position: posicion,
    name: l.name,
    detail: l.detail,
    quantity: String(l.quantity),
    unitPrice: dinero(l.unitPriceCents),
    amount: dinero(l.lineTotalCents),
  };
}

/** Condiciones que salen en el documento: una por renglón, sin renglones vacíos. */
export function splitConditions(texto: string): string[] {
  return texto
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r !== '');
}

export interface BuildDocumentInput {
  readonly quote: Quote;
  readonly customer: DocumentCustomer;
  readonly business: BusinessIdentity;
  readonly privacyNotice: string;
  /** Condiciones de un borrador que aún no tiene copia propia. */
  readonly defaultConditions: string;
  readonly now: Date;
  readonly provisionalNote: string;
  readonly labels: DocumentLabels;
}

/** Arma el modelo del documento. Los totales son los de la cotización (suma de sus líneas), nunca se
 *  recalculan con otra fórmula: pantalla, PDF y servidor dicen lo mismo al centavo [ADR-0011]. */
export function buildQuoteDocument(entrada: BuildDocumentInput): QuoteDocument {
  const { quote } = entrada;
  const totales = quoteTotals(quote.lines);
  const esBorrador = quote.status === 'DRAFT';
  const enviada = quote.folio !== null;
  const emision =
    quote.issuedAt === null ? mexicoDate(entrada.now) : mexicoDate(new Date(quote.issuedAt));
  return {
    business: entrada.business,
    folioLabel:
      quote.folio ??
      (quote.tempFolio === null ? '' : `${entrada.provisionalNote} ${quote.tempFolio}`),
    folio: quote.folio,
    tempFolio: quote.tempFolio,
    publicCode: quote.publicCode,
    provisionalNote: !enviada && quote.tempFolio !== null ? entrada.provisionalNote : null,
    issuedDate: formatDate(emision),
    validUntilDate: quote.validUntil === null ? '' : formatDate(quote.validUntil),
    customer: entrada.customer,
    siteAddress: quote.siteAddress,
    lines: quote.lines.map((l, i) => lineaDeDocumento(l, i + 1)),
    subtotal: dinero(totales.subtotalCents),
    tax: dinero(totales.taxCents),
    total: dinero(totales.totalCents),
    conditions: splitConditions(quote.conditionsText ?? entrada.defaultConditions),
    privacyNotice: entrada.privacyNotice,
    isDraft: esBorrador,
    labels: entrada.labels,
  };
}
