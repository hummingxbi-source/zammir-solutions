import {
  buildWorkOrderDocument,
  outboxWarrantyReader,
  partNumber,
  shareQuote,
  type BusinessIdentity,
  type Customer,
  type DocumentPrinter,
  type DocumentRenderer,
  type OrderDeps,
  type QuoteDocument,
  type ReceiptLabels,
  type ShareService,
  type WorkOrder,
  type DocumentLegal,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';
import { formatearPesos } from '../../../shared/ui/formatos';

const c = textos.documento.comprobante;

/** Rótulos del comprobante tal como los escribe la aplicación. */
export const ETIQUETAS_DEL_COMPROBANTE: ReceiptLabels = {
  document: c.rotulos,
  extras: c.extras,
  kind: c.tipoDePago,
  method: c.metodo,
  status: textos.ordenes.estados,
  warrantyStart: c.garantiaInicio,
  warrantyDuration: c.garantiaDuracion,
  warrantyCoverage: c.garantiaCobertura,
  warrantyExclusions: c.garantiaExclusiones,
  provisionalNote: textos.documento.folioProvisional,
};

export interface ComprobanteDeps {
  readonly orderDeps: OrderDeps;
  readonly renderer: DocumentRenderer;
  readonly share: ShareService;
  readonly negocio: BusinessIdentity;
  /** Condiciones que salen en el comprobante, una por renglón. */
  readonly condiciones: string;
  /** Leyenda del plazo de autofacturación (PD-09); `null` usa la de la aplicación. */
  readonly leyendaDeAutofacturacion: string | null;
  /** Dirección base del QR (PD-10); `null` usa un dominio de prueba. */
  readonly direccionBase: string | null;
  readonly qrMatrix: (texto: string) => readonly (readonly boolean[])[];
  /** Si el comprobante lleva QR y leyenda de autofacturación [ADR-0039]. */
  readonly autofacturacion: boolean;
  /** Aviso y términos para el pie del comprobante; sin esto se usa el aviso abreviado de prueba. */
  readonly legal?: DocumentLegal;
}

/** Arma el comprobante de trabajo y el mensaje de WhatsApp [RF-M3-06]. Lo usan por igual enviar e imprimir,
 *  así lo que sale por WhatsApp y lo que sale en papel dicen lo mismo. */
async function armarComprobante(
  deps: ComprobanteDeps,
  orden: WorkOrder,
  cliente: Customer | null,
): Promise<{ readonly documento: QuoteDocument; readonly mensaje: string }> {
  const pagos = await deps.orderDeps.payments.listByTarget(orden.id);
  const garantia = await outboxWarrantyReader(deps.orderDeps.outbox).get(orden.id);
  const parte = partNumber(orden, await deps.orderDeps.orders.list());
  const documento = buildWorkOrderDocument({
    order: orden,
    payments: pagos,
    customer: { name: cliente?.name ?? '', phone: cliente?.phone ?? '0000000000' },
    business: deps.negocio,
    warranty: garantia,
    conditions: deps.condiciones,
    privacyNotice: deps.legal?.privacyNotice ?? textos.documento.avisoAbreviado,
    terms: deps.legal?.terms ?? null,
    selfInvoicingLegend: deps.leyendaDeAutofacturacion ?? c.leyendaPorOmision,
    publicBaseUrl: deps.direccionBase,
    qrMatrix: deps.qrMatrix,
    autofacturacion: deps.autofacturacion,
    labels: ETIQUETAS_DEL_COMPROBANTE,
    partLabel: parte === null ? null : textos.ordenes.partes.parte(parte),
  });
  const saldo = orden.totalCents - pagos.reduce((suma, p) => suma + p.amountCents, 0);
  const mensaje = c.mensajeWhatsApp(
    cliente?.name ?? '',
    orden.folio ?? orden.tempFolio,
    saldo === 0 ? (documento.receipt?.labels.settled.toLowerCase() ?? '') : formatearPesos(saldo),
  );
  return { documento, mensaje };
}

/** Genera el comprobante de trabajo en la tablet y lo comparte por WhatsApp [RF-M3-06, ADR-0040].
 *  Devuelve el código de error o `null` si salió bien. */
export function compartirComprobante(
  deps: ComprobanteDeps,
): (orden: WorkOrder, cliente: Customer | null) => Promise<string | null> {
  return async (orden, cliente) => {
    const { documento, mensaje } = await armarComprobante(deps, orden, cliente);
    const r = await shareQuote({ renderer: deps.renderer, share: deps.share }, documento, mensaje);
    return r.ok ? null : 'STORAGE_FAILED';
  };
}

/** Abre la impresión del comprobante de trabajo [ADR-0040]. Devuelve el código de error o `null`. */
export function imprimirComprobante(
  deps: ComprobanteDeps & { readonly impresora: DocumentPrinter | undefined },
): (orden: WorkOrder, cliente: Customer | null) => Promise<string | null> {
  return async (orden, cliente) => {
    const { documento } = await armarComprobante(deps, orden, cliente);
    if (deps.impresora === undefined) {
      return 'PRINT_UNAVAILABLE';
    }
    const r = await deps.impresora.print(documento);
    return r.ok ? null : r.error.code;
  };
}
