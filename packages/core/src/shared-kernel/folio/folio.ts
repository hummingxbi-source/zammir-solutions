import { err, ok, type Result } from '../result';

/** Documentos que llevan folio [RN-15]. */
export type FolioDocType = 'QUOTE' | 'WORK_ORDER' | 'COUNTER_SALE' | 'INVOICE';

const PREFIJOS: Record<FolioDocType, string> = {
  QUOTE: 'COT',
  WORK_ORDER: 'OT',
  COUNTER_SALE: 'V',
  INVOICE: 'F',
};

export type FolioErrorCode = 'INVALID_YEAR' | 'INVALID_NUMBER' | 'INVALID_SERIES';

export interface FolioError {
  readonly code: FolioErrorCode;
}

const ZONA_DE_NEGOCIO = 'America/Mexico_City';
const ANIO_MIN = 2000;
const ANIO_MAX = 9999;

function esEnteroPositivo(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 1;
}

/** Folio definitivo: `COT-2026-0012`. El número se rellena a 4 dígitos y, si pasa de 9999, crece sin
 *  tope [RN-15]. */
export function formatFolio(
  docType: FolioDocType,
  year: number,
  n: number,
): Result<string, FolioError> {
  if (!Number.isInteger(year) || year < ANIO_MIN || year > ANIO_MAX) {
    return err({ code: 'INVALID_YEAR' });
  }
  if (!esEnteroPositivo(n)) {
    return err({ code: 'INVALID_NUMBER' });
  }
  return ok(`${PREFIJOS[docType]}-${String(year)}-${String(n).padStart(4, '0')}`);
}

/** Folio provisional de un dispositivo sin conexión: `T1-0004` [RN-16]. Una serie por dispositivo,
 *  compartida por todos los tipos de documento. */
export function formatTempFolio(series: number, n: number): Result<string, FolioError> {
  if (!esEnteroPositivo(series)) {
    return err({ code: 'INVALID_SERIES' });
  }
  if (!esEnteroPositivo(n)) {
    return err({ code: 'INVALID_NUMBER' });
  }
  return ok(`T${String(series)}-${String(n).padStart(4, '0')}`);
}

/** Año del folio: el de la fecha de emisión en hora de México, no el del envío (PD-23, propuesta). */
export function folioYear(emitidoEn: Date): number {
  const anio = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_DE_NEGOCIO,
    year: 'numeric',
  }).format(emitidoEn);
  return Number(anio);
}

/** ¿Es un folio provisional (`T1-0004`)? Sirve para buscar un documento por el folio que lleva impreso. */
export function parseTempFolio(
  texto: string,
): { readonly series: number; readonly n: number } | null {
  const m = /^T(\d+)-(\d+)$/.exec(texto.trim().toUpperCase());
  if (m === null) {
    return null;
  }
  const series = Number(m[1]);
  const n = Number(m[2]);
  return esEnteroPositivo(series) && esEnteroPositivo(n) ? { series, n } : null;
}
