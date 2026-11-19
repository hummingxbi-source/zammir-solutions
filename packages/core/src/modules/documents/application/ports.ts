import type { Result } from '../../../shared-kernel/result';
import type { QuoteDocument } from '../domain/quote-document';

export type RenderErrorCode = 'RENDER_FAILED';

export interface RenderError {
  readonly code: RenderErrorCode;
}

/** Puerto: convierte el modelo de documento en el archivo PDF. Se genera EN la tablet, sin internet
 *  [RF-M2-05, RNF-25]. */
export interface DocumentRenderer {
  render(documento: QuoteDocument): Promise<Result<Uint8Array, RenderError>>;
}

export type PrintErrorCode = 'PRINT_UNAVAILABLE' | 'PRINT_FAILED';

export interface PrintError {
  readonly code: PrintErrorCode;
}

/** Puerto: manda un documento a la impresión del dispositivo (en Android, el servicio de impresión del
 *  sistema, con cualquier impresora que ya conozca) [ADR-0040]. Éxito significa que se abrió la impresión;
 *  lo que la persona haga en ese diálogo ya no lo sabe el sistema. `copia` marca la hoja como reimpresión. */
export interface DocumentPrinter {
  print(
    documento: QuoteDocument,
    opciones?: { readonly copia: boolean },
  ): Promise<Result<void, PrintError>>;
}

export type ShareErrorCode = 'SHARE_CANCELLED' | 'SHARE_UNAVAILABLE';

export interface ShareError {
  readonly code: ShareErrorCode;
}

export interface ShareableFile {
  readonly name: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

/** Puerto: compartir un archivo desde el dispositivo [RF-M2-06, ADR-0005]. */
export interface ShareService {
  /** ¿Este dispositivo puede compartir ESE archivo con el menú del sistema? */
  canShareFile(file: ShareableFile): boolean;
  /** Abre el menú de compartir del sistema con el archivo y un mensaje. */
  shareFile(file: ShareableFile, message: string): Promise<Result<void, ShareError>>;
  /** Respaldo: abre un enlace (WhatsApp) en otra pestaña o aplicación. */
  openLink(url: string): void;
  /** Respaldo: descarga el archivo en el dispositivo. */
  download(file: ShareableFile): void;
}
