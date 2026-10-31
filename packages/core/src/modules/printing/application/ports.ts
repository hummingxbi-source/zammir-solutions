import type { Result } from '../../../shared-kernel/result';
import type { PrintDocument } from '../domain/print-document';

export type PrinterErrorCode =
  'PRINTER_NOT_CONFIGURED' | 'PRINTER_UNAVAILABLE' | 'PRINT_CANCELLED' | 'PRINT_FAILED';

export interface PrinterError {
  readonly code: PrinterErrorCode;
}

export type PrinterState = 'READY' | 'NOT_CONFIGURED' | 'DISCONNECTED';

export interface PrinterStatus {
  readonly state: PrinterState;
  /** Nombre que muestra la impresora o el medio (por ejemplo "Impresora Bluetooth"). */
  readonly name: string | null;
}

/** Puerto: sacar un documento por una impresora de tickets o por un medio de respaldo [S3-20]. */
export interface TicketPrinter {
  /** Cómo se llama este medio en pantalla. */
  readonly label: string;
  status(): Promise<PrinterStatus>;
  /** Empareja o elige la impresora; solo hace falta una vez por tablet. */
  connect(): Promise<Result<PrinterStatus, PrinterError>>;
  print(documento: PrintDocument): Promise<Result<void, PrinterError>>;
}
