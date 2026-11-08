import { mexicoDate } from '../../../shared-kernel/date/mx-date';
import { toCsv } from '../domain/csv';
import {
  columnLabel,
  EXPORT_TABLES,
  formatForReport,
  formatMexicoDateTime,
  type ExportDataset,
} from '../domain/export-dataset';

/** Cuántos renglones de cada tabla caben en el PDF; el resto está completo en los CSV y el JSON. */
export const MAX_PDF_ROWS_PER_TABLE = 1000;

export interface ExportFile {
  /** Ruta dentro del paquete (`csv/clientes.csv`). */
  readonly path: string;
  readonly mimeType: string;
  readonly content: string;
}

export interface ExportReportSection {
  readonly title: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
  /** Cuántos renglones tiene la tabla en total y cuántos no caben en el PDF. */
  readonly totalRows: number;
  readonly omittedRows: number;
}

/** El PDF como datos: lo dibuja la aplicación; aquí solo se decide qué dice. */
export interface ExportReport {
  readonly title: string;
  readonly subtitle: string;
  readonly sections: readonly ExportReportSection[];
}

export interface ExportPackage {
  /** Nombre base de los archivos: `zammir-datos-2026-11-08`. */
  readonly baseName: string;
  readonly json: ExportFile;
  readonly csvFiles: readonly ExportFile[];
  readonly readme: ExportFile;
  readonly report: ExportReport;
  /** Renglones por tabla, tal como salieron. */
  readonly counts: Readonly<Record<string, number>>;
}

function leeme(
  dataset: ExportDataset,
  conteos: Readonly<Record<string, number>>,
  negocio: string,
): string {
  const renglones = EXPORT_TABLES.map((t) => {
    const n = conteos[t.name] ?? 0;
    return `  csv/${t.name}.csv  (${t.label}: ${String(n)} ${n === 1 ? 'renglón' : 'renglones'})`;
  });
  return [
    `DATOS DE ${negocio.toUpperCase()}`,
    `Generado el ${formatMexicoDateTime(dataset.generatedAt)} (hora de la Ciudad de México).`,
    '',
    'Qué trae esta carpeta',
    '  zammir-datos.json   Todos los datos en un solo archivo.',
    '  zammir-resumen.pdf  Un resumen para leer e imprimir (las columnas principales de cada tabla).',
    '  csv/                Una tabla por archivo, para abrir en Excel u otra hoja de cálculo:',
    ...renglones,
    '',
    'Cómo leer los datos',
    '  - Los importes están en CENTAVOS enteros (las columnas que terminan en _cents): 11600 son $116.00.',
    '    Los precios incluyen IVA.',
    '  - Las fechas y horas (JSON y CSV) están en UTC, en formato ISO 8601. Restar 6 horas da la hora de la',
    '    Ciudad de México. El PDF ya las muestra en hora de México.',
    '  - Los CSV usan UTF-8 con marca de orden de bytes (los acentos se ven bien en Excel) y comas.',
    '  - Un texto que empieza con =, +, - o @ lleva un apóstrofo al principio, para que Excel no lo tome como',
    '    fórmula.',
    '  - Los estados (por ejemplo COMPLETED o DELIVERED) y los tipos van con su clave del sistema.',
    '  - Una tabla sin renglones sale como un archivo vacío.',
    '',
    'Qué NO trae, a propósito',
    '  - Los PIN de las personas (ni su huella ni su sal), las cuentas de acceso de las tablets, los códigos de',
    '    registro y los registros técnicos del sistema (contadores de folios, intentos del portal, errores y el',
    '    registro técnico de operaciones de las tablets).',
    '  - El PDF de cada factura en base64 (se vuelve a generar); sí trae su XML y sus datos.',
    '',
    'Esta exportación quedó anotada en la bitácora, con quién la hizo.',
    '',
  ].join('\r\n');
}

/** Arma todo lo que se entrega al exportar los datos: el JSON, un CSV por tabla, el LÉEME y el contenido del PDF.
 *  Es puro: no toca la red ni el disco [S5-08, RNF-22]. */
export function buildExportPackage(
  dataset: ExportDataset,
  opciones: { readonly businessName?: string } = {},
): ExportPackage {
  const negocio = opciones.businessName ?? 'ZAMMIR';
  const baseName = `zammir-datos-${mexicoDate(new Date(dataset.generatedAt))}`;
  const conteos: Record<string, number> = {};
  const csvFiles: ExportFile[] = [];
  const secciones: ExportReportSection[] = [];

  for (const tabla of EXPORT_TABLES) {
    const filas = dataset.tables[tabla.name] ?? [];
    conteos[tabla.name] = filas.length;
    csvFiles.push({ path: `csv/${tabla.name}.csv`, mimeType: 'text/csv', content: toCsv(filas) });

    const visibles = filas.slice(0, MAX_PDF_ROWS_PER_TABLE);
    secciones.push({
      title: tabla.label,
      columns: tabla.summary.map(columnLabel),
      rows: visibles.map((fila) => tabla.summary.map((c) => formatForReport(c, fila[c]))),
      totalRows: filas.length,
      omittedRows: filas.length - visibles.length,
    });
  }
  // Tablas que el servidor entregó y esta versión no conoce: también van completas en JSON y CSV.
  for (const [nombre, filas] of Object.entries(dataset.tables)) {
    if (!(nombre in conteos)) {
      conteos[nombre] = filas.length;
      csvFiles.push({ path: `csv/${nombre}.csv`, mimeType: 'text/csv', content: toCsv(filas) });
    }
  }

  return {
    baseName,
    counts: conteos,
    csvFiles,
    json: {
      path: 'zammir-datos.json',
      mimeType: 'application/json',
      content: JSON.stringify(
        { format: 1, generatedAt: dataset.generatedAt, tables: dataset.tables },
        null,
        2,
      ),
    },
    readme: {
      path: 'LEEME.txt',
      mimeType: 'text/plain',
      content: leeme(dataset, conteos, negocio),
    },
    report: {
      title: `Datos de ${negocio}`,
      subtitle: `Generado el ${formatMexicoDateTime(dataset.generatedAt)} (hora de la Ciudad de México)`,
      sections: secciones,
    },
  };
}
