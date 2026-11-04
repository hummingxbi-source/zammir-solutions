import {
  accessPortalDocument,
  type PortalLookupDeps,
  type PortalLookupInput,
} from './portal-lookup';

/** Los archivos de una factura ya timbrada, tal como se guardaron. El PDF va en base64 porque así viaja. */
export interface StoredInvoiceFiles {
  readonly folio: string;
  readonly uuid: string;
  readonly xml: string;
  readonly pdfBase64: string;
}

/** Puerto: los archivos de la factura vigente de una venta u orden. */
export interface InvoiceFileStore {
  find(source: {
    readonly type: 'COUNTER_SALE' | 'WORK_ORDER';
    readonly id: string;
  }): Promise<StoredInvoiceFiles | null>;
}

export type InvoiceFormat = 'xml' | 'pdf';

export type DownloadPortalInvoiceOutcome =
  | {
      readonly kind: 'FILE';
      readonly filename: string;
      readonly contentType: string;
      /** Para el XML, el texto; para el PDF, el contenido en base64. */
      readonly content: string;
      readonly encoding: 'utf8' | 'base64';
    }
  /** Mismo resultado si el código no cuadra, el folio no existe o todavía no hay factura: no revela nada. */
  | { readonly kind: 'NOT_AVAILABLE' }
  | { readonly kind: 'BLOCKED'; readonly retryAfterSeconds: number }
  | { readonly kind: 'UNAVAILABLE' };

/** Entrega el PDF o el XML de la factura de una venta u orden a quien tiene su folio y su código. Pasa por la
 *  misma puerta que la consulta (formato, límites y automatización) [RF-M10-14, ADR-0030]. */
export async function downloadPortalInvoice(
  deps: PortalLookupDeps & { readonly files: InvoiceFileStore },
  entrada: PortalLookupInput,
  formato: InvoiceFormat,
): Promise<DownloadPortalInvoiceOutcome> {
  const acceso = await accessPortalDocument(deps, entrada);
  if (acceso.kind !== 'MATCHED') {
    return acceso;
  }
  try {
    const archivos = await deps.files.find({ type: acceso.record.type, id: acceso.record.id });
    if (archivos === null) {
      return { kind: 'NOT_AVAILABLE' };
    }
    return formato === 'xml'
      ? {
          kind: 'FILE',
          filename: `${archivos.folio}.xml`,
          contentType: 'application/xml',
          content: archivos.xml,
          encoding: 'utf8',
        }
      : {
          kind: 'FILE',
          filename: `${archivos.folio}.pdf`,
          contentType: 'application/pdf',
          content: archivos.pdfBase64,
          encoding: 'base64',
        };
  } catch {
    return { kind: 'UNAVAILABLE' };
  }
}
