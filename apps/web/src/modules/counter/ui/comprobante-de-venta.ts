import {
  buildSaleDocument,
  type BusinessIdentity,
  type CounterSale,
  type Customer,
  type Payment,
  type QuoteDocument,
  type SaleLabels,
} from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';

const v = textos.documento.venta;
const c = textos.documento.comprobante;

/** Rótulos del comprobante de venta tal como los escribe la aplicación. */
export const ETIQUETAS_DE_VENTA: SaleLabels = {
  document: v.rotulos,
  extras: c.extras,
  saleKind: v.tipoDePago,
  method: c.metodo,
  status: v.estados,
  counterCustomer: v.clienteDeMostrador,
  attendedBy: v.atendio,
  change: v.cambio,
  provisionalNote: textos.documento.folioProvisional,
};

export interface ComprobanteDeVentaDeps {
  readonly negocio: BusinessIdentity;
  /** Condiciones que salen en el comprobante, una por renglón. */
  readonly condiciones: string;
  /** Aviso y términos para el pie; sin esto se usa el aviso abreviado de prueba. */
  readonly legal?: {
    readonly privacyNotice: string;
    readonly terms: { readonly title: string; readonly lines: readonly string[] } | null;
  };
  /** Si lleva QR y leyenda de autofacturación; en pausa no se menciona la factura [ADR-0039]. */
  readonly autofacturacion: boolean;
  readonly leyendaDeAutofacturacion: string | null;
  readonly direccionBase: string | null;
  readonly qrMatrix: (texto: string) => readonly (readonly boolean[])[];
}

/** Arma el comprobante en hoja carta de una venta de mostrador [RF-M4-04, ADR-0040]. */
export function comprobanteDeVenta(
  deps: ComprobanteDeVentaDeps,
  datos: {
    readonly venta: CounterSale;
    readonly pagos: readonly Payment[];
    readonly cliente: Customer | null;
    readonly cajero: string;
  },
): QuoteDocument {
  return buildSaleDocument({
    sale: datos.venta,
    payments: datos.pagos,
    customer:
      datos.cliente === null ? null : { name: datos.cliente.name, phone: datos.cliente.phone },
    cashierName: datos.cajero,
    business: deps.negocio,
    conditions: deps.condiciones,
    privacyNotice: deps.legal?.privacyNotice ?? textos.documento.avisoAbreviado,
    terms: deps.legal?.terms ?? null,
    selfInvoicingLegend: deps.leyendaDeAutofacturacion ?? c.leyendaPorOmision,
    publicBaseUrl: deps.direccionBase,
    qrMatrix: deps.qrMatrix,
    autofacturacion: deps.autofacturacion,
    labels: ETIQUETAS_DE_VENTA,
  });
}
