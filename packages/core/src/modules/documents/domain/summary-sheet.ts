import type { BusinessIdentity } from './quote-document';

/** Un renglón de una hoja de resumen: concepto y valor, ya redactados. */
export interface SheetRow {
  readonly label: string;
  readonly value: string;
  /** Se resalta (totales, diferencia). */
  readonly strong?: boolean;
}

export interface SheetSection {
  /** Título de la sección; `null` si va sin título. */
  readonly title: string | null;
  readonly rows: readonly SheetRow[];
}

/** Hoja de resumen en tamaño carta (por ejemplo, el corte de caja): sin conceptos ni cliente, solo datos
 *  del negocio, unas líneas de contexto y secciones de renglones. Todo llega ya calculado y redactado:
 *  el renderizador y la página de impresión solo lo dibujan [ADR-0040]. */
export interface SummarySheet {
  readonly business: BusinessIdentity;
  readonly title: string;
  /** Línea bajo el título, por ejemplo `Turno de Beto`; `null` si no hay. */
  readonly subtitle: string | null;
  /** Líneas de contexto bajo el encabezado, una por renglón. */
  readonly meta: readonly string[];
  readonly sections: readonly SheetSection[];
  /** Aclaración al final; `null` si no hay. */
  readonly note: string | null;
  /** Con `{n}` y `{total}`: `Página {n} de {total}`. */
  readonly pageLabel: string;
}
