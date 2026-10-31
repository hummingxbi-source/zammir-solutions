import { ok, type Result } from '../../../shared-kernel/result';
import type { QuoteDocument } from '../domain/quote-document';
import type {
  DocumentRenderer,
  RenderError,
  ShareError,
  ShareableFile,
  ShareService,
} from './ports';

/** Enlace de WhatsApp con el mensaje ya escrito [RF-M2-06]. El teléfono son los 10 dígitos de México y
 *  el mensaje se codifica para que acentos, ñ y signos viajen bien. */
export function whatsappUrl(telefono10: string, mensaje: string): string {
  return `https://wa.me/52${telefono10}?text=${encodeURIComponent(mensaje)}`;
}

/** Nombre del archivo: `Cotizacion-COT-2026-0012.pdf`, o con el folio provisional si aún no se envió. */
export function pdfFileName(documento: Pick<QuoteDocument, 'folio' | 'tempFolio'>): string {
  const folio = documento.folio ?? documento.tempFolio ?? 'borrador';
  return `Cotizacion-${folio}.pdf`;
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
  if (deps.share.canShareFile(archivo)) {
    const r = await deps.share.shareFile(archivo, mensaje);
    if (r.ok) {
      return ok('SHARED');
    }
    if (r.error.code === 'SHARE_CANCELLED') {
      return ok('CANCELLED');
    }
    // El menú falló por otra razón: se cae al respaldo en lugar de dejar a la persona sin salida.
  }
  deps.share.download(archivo);
  deps.share.openLink(whatsappUrl(documento.customer.phone, mensaje));
  return ok('FALLBACK');
}
