import {
  buildWorkOrderDocument,
  outboxWarrantyReader,
  shareQuote,
  type BusinessIdentity,
  type Customer,
  type DocumentRenderer,
  type OrderDeps,
  type ReceiptLabels,
  type ShareService,
  type WorkOrder,
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
}

/** Genera el comprobante de trabajo en la tablet y lo comparte por WhatsApp [RF-M3-06, ADR-0005].
 *  Devuelve el código de error o `null` si salió bien. */
export function compartirComprobante(
  deps: ComprobanteDeps,
): (orden: WorkOrder, cliente: Customer | null) => Promise<string | null> {
  return async (orden, cliente) => {
    const pagos = await deps.orderDeps.payments.listByTarget(orden.id);
    const garantia = await outboxWarrantyReader(deps.orderDeps.outbox).get(orden.id);
    const documento = buildWorkOrderDocument({
      order: orden,
      payments: pagos,
      customer: { name: cliente?.name ?? '', phone: cliente?.phone ?? '0000000000' },
      business: deps.negocio,
      warranty: garantia,
      conditions: deps.condiciones,
      privacyNotice: textos.documento.avisoAbreviado,
      selfInvoicingLegend: deps.leyendaDeAutofacturacion ?? c.leyendaPorOmision,
      publicBaseUrl: deps.direccionBase,
      qrMatrix: deps.qrMatrix,
      labels: ETIQUETAS_DEL_COMPROBANTE,
    });
    const saldo = orden.totalCents - pagos.reduce((suma, p) => suma + p.amountCents, 0);
    const mensaje = c.mensajeWhatsApp(
      cliente?.name ?? '',
      orden.folio ?? orden.tempFolio,
      saldo === 0 ? (documento.receipt?.labels.settled.toLowerCase() ?? '') : formatearPesos(saldo),
    );
    const r = await shareQuote({ renderer: deps.renderer, share: deps.share }, documento, mensaje);
    return r.ok ? null : 'STORAGE_FAILED';
  };
}
