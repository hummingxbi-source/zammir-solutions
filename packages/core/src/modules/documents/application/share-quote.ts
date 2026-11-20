import { ok, type Result } from '../../../shared-kernel/result';
import type { QuoteDocument } from '../domain/quote-document';
import type { SummarySheet } from '../domain/summary-sheet';
import type {
  DocumentRenderer,
  RenderError,
  SheetRenderer,
  ShareError,
  ShareableFile,
  ShareService,
} from './ports';

/** Enlace de WhatsApp con el mensaje ya escrito [RF-M2-06]. El teléfono son los 10 dígitos de México y
 *  el mensaje se codifica para que acentos, ñ y signos viajen bien. */
export function whatsappUrl(telefono10: string, mensaje: string): string {
  // Sin teléfono (venta de mostrador sin cliente) WhatsApp deja elegir a quién mandarlo.
  const destino = telefono10 === '' ? '' : `52${telefono10}`;
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensaje)}`;
}

/** Nombre del archivo: `Cotizacion-COT-2026-0012.pdf` o `Comprobante-OT-2026-0012.pdf`; con el folio
 *  provisional si aún no se envió. */
export function pdfFileName(
  documento: Pick<QuoteDocument, 'folio' | 'tempFolio' | 'receipt'>,
): string {
  const folio = documento.folio ?? documento.tempFolio ?? 'borrador';
  return `${documento.receipt === undefined ? 'Cotizacion' : 'Comprobante'}-${folio}.pdf`;
}

export type ShareOutcome =
  /** Se abrió el menú de compartir del dispositivo y la persona eligió una app. */
  | 'SHARED'
  /** La persona cerró el menú sin enviar. */
  | 'CANCELLED'
  /** El dispositivo no comparte archivos: se descargó el PDF y se abrió WhatsApp con el mensaje. */
  | 'FALLBACK';

export type ShareQuoteError = RenderError | ShareError;

/** Envía la cotización al cliente: primero con el menú de compartir del dispositivo (WhatsApp entre las
 *  opciones); si no se puede compartir archivos, abre un enlace de WhatsApp con el mensaje prellenado y
 *  descarga el PDF [RF-M2-06, ADR-0005]. No hay impresión tamaño carta. */
export async function shareQuote(
  deps: { readonly renderer: DocumentRenderer; readonly share: ShareService },
  documento: QuoteDocument,
  mensaje: string,
): Promise<Result<ShareOutcome, ShareQuoteError>> {
  const pdf = await deps.renderer.render(documento);
  if (!pdf.ok) {
    return pdf;
  }
  const archivo: ShareableFile = {
    name: pdfFileName(documento),
    mimeType: 'application/pdf',
    bytes: pdf.value,
  };
  return enviarArchivo(deps.share, archivo, documento.customer.phone, mensaje);
}

/** Manda un PDF por WhatsApp: con el menú de compartir del dispositivo y, si no se puede, descarga el PDF y
 *  abre WhatsApp con el mensaje (sin teléfono, para elegir el contacto) [RF-M2-06]. */
async function enviarArchivo(
  share: ShareService,
  archivo: ShareableFile,
  telefono10: string,
  mensaje: string,
): Promise<Result<ShareOutcome, ShareQuoteError>> {
  if (share.canShareFile(archivo)) {
    const r = await share.shareFile(archivo, mensaje);
    if (r.ok) {
      return ok('SHARED');
    }
    if (r.error.code === 'SHARE_CANCELLED') {
      return ok('CANCELLED');
    }
    // El menú falló por otra razón: se cae al respaldo en lugar de dejar a la persona sin salida.
  }
  share.download(archivo);
  share.openLink(whatsappUrl(telefono10, mensaje));
  return ok('FALLBACK');
}

/** Manda una hoja de resumen (el corte de caja) por WhatsApp. No tiene cliente: sin teléfono, WhatsApp deja
 *  elegir a quién [ADR-0040]. */
export async function shareSheet(
  deps: { readonly renderer: SheetRenderer; readonly share: ShareService },
  hoja: SummarySheet,
  nombreDeArchivo: string,
  mensaje: string,
): Promise<Result<ShareOutcome, ShareQuoteError>> {
  const pdf = await deps.renderer.render(hoja);
  if (!pdf.ok) {
    return pdf;
  }
  return enviarArchivo(
    deps.share,
    { name: nombreDeArchivo, mimeType: 'application/pdf', bytes: pdf.value },
    '',
    mensaje,
  );
}
