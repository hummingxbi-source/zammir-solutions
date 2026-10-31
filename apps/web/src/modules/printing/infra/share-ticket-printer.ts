import {
  err,
  ok,
  toPlainText,
  type PrinterStatus,
  type PrintDocument,
  type ShareService,
  type TicketPrinter,
} from '@zammir/core';

/** Último recurso [S3-22]: el ticket sale como archivo de texto por el menú de compartir (WhatsApp, otra
 *  aplicación de impresión) y, si ni eso, se descarga. Nunca deja la venta sin comprobante. */
export function shareTicketPrinter(share: ShareService | undefined): TicketPrinter {
  const estado = (): PrinterStatus =>
    share === undefined
      ? { state: 'NOT_CONFIGURED', name: null }
      : { state: 'READY', name: 'Compartir ticket' };
  return {
    label: 'Compartir ticket',
    status: () => Promise.resolve(estado()),
    connect: () =>
      Promise.resolve(
        share === undefined ? err({ code: 'PRINTER_NOT_CONFIGURED' as const }) : ok(estado()),
      ),
    async print(documento: PrintDocument) {
      if (share === undefined) {
        return err({ code: 'PRINTER_NOT_CONFIGURED' as const });
      }
      const archivo = {
        name: `${documento.title.replace(/[^\p{L}\p{N}-]+/gu, '_')}.txt`,
        mimeType: 'text/plain',
        bytes: new TextEncoder().encode(toPlainText(documento)),
      };
      if (!share.canShareFile(archivo)) {
        share.download(archivo);
        return ok(undefined);
      }
      const r = await share.shareFile(archivo, documento.title);
      if (r.ok) {
        return ok(undefined);
      }
      return err({
        code:
          r.error.code === 'SHARE_CANCELLED'
            ? ('PRINT_CANCELLED' as const)
            : ('PRINT_FAILED' as const),
      });
    },
  };
}
