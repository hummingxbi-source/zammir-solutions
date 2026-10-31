import type { PaperWidth, PrintDocument, PrinterStatus, TicketBusiness } from '@zammir/core';

/** Lo que la pantalla necesita para sacar tickets: los datos del negocio, el ancho del papel y tres
 *  acciones. Cuál impresora o medio de respaldo se usa lo decide la composición [S3-20 a S3-24]. */
export interface ImpresionDeTickets {
  /** Caracteres por renglón del papel; configurable mientras no se defina la impresora (PD-15). */
  readonly width: PaperWidth;
  readonly business: TicketBusiness;
  /** Leyenda del plazo de autofacturación (PD-09, configurable). */
  readonly selfInvoicingLegend: string;
  readonly publicBaseUrl: string | null;
  estado(): Promise<PrinterStatus>;
  /** Empareja la impresora; devuelve el código de error o `null`. */
  conectar(): Promise<string | null>;
  /** Manda el documento por el primer medio que responda. */
  imprimir(documento: PrintDocument): Promise<{ via: string } | { error: string }>;
}
