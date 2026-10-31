import { err, ok, type Result } from '../../../shared-kernel/result';
import type { PrintDocument } from '../domain/print-document';
import type { PrinterError, TicketPrinter } from './ports';

export interface PrintOutcome {
  /** Con qué medio salió el ticket. */
  readonly via: string;
  /** Medios que fallaron antes de lograrlo. */
  readonly failed: readonly string[];
}

/** Imprime por el primer medio que responda: Bluetooth, luego la impresión de Android, luego compartir.
 *  Un ticket que no salió no se pierde: la venta ya está guardada y se puede reimprimir [S3-22, S3-23]. */
export async function printWithFallback(
  medios: readonly TicketPrinter[],
  documento: PrintDocument,
): Promise<Result<PrintOutcome, PrinterError>> {
  const fallidos: string[] = [];
  let ultimo: PrinterError = { code: 'PRINTER_NOT_CONFIGURED' };
  for (const medio of medios) {
    const r = await medio.print(documento);
    if (r.ok) {
      return ok({ via: medio.label, failed: fallidos });
    }
    ultimo = r.error;
    fallidos.push(medio.label);
    if (r.error.code === 'PRINT_CANCELLED') {
      break;
    }
  }
  return err(ultimo);
}
