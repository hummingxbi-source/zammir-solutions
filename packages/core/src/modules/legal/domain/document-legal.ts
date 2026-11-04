import { mexicoDate } from '../../../shared-kernel/date/mx-date';
import { currentVersion } from './legal-document';

/** Una versión de un documento legal tal como la guarda la tablet para trabajar sin internet: la fecha de
 *  vigencia va como texto ISO porque la copia local es JSON. */
export interface LegalVersionSnapshot {
  readonly version: number;
  readonly effectiveFrom: string;
  readonly body: string;
}

/** Lo que la tablet guarda de los documentos legales: todas las versiones de cada uno, para saber cuál rige
 *  a la hora de generar un documento aunque no haya internet. */
export interface LegalSnapshot {
  readonly privacy: readonly LegalVersionSnapshot[];
  readonly terms: readonly LegalVersionSnapshot[];
}

/** Redacción del pie legal; viene de los textos de la aplicación (español de México). */
export interface DocumentLegalLabels {
  /** Cuando todavía no hay aviso publicado. */
  readonly noNotice: string;
  /** Aviso con su versión y desde cuándo rige. */
  readonly notice: (version: number, desde: string) => string;
  /** Dónde leer el aviso completo. */
  readonly readFull: (enlace: string) => string;
  /** Canal para ejercer derechos sobre los datos [RF-M9-04]. */
  readonly rights: (canal: string) => string;
  /** Encabezado de los términos con su versión. */
  readonly termsTitle: (version: number) => string;
  /** Dónde leer los términos completos. */
  readonly termsLink: (enlace: string) => string;
}

export interface DocumentLegal {
  /** Aviso de privacidad abreviado: versión, enlace y canal de derechos. */
  readonly privacyNotice: string;
  /** Términos del servicio vigentes, o `null` si todavía no se publican. */
  readonly terms: { readonly title: string; readonly lines: readonly string[] } | null;
}

/** Quita la diagonal final de una dirección base para poder agregarle una ruta. */
function sinDiagonalFinal(base: string): string {
  return base.replace(/\/+$/, '');
}

/** Enlace público al aviso o a los términos; `null` mientras la dirección base esté por definir (PD-10). */
export function legalLink(base: string | null, ruta: 'aviso' | 'terminos'): string | null {
  const limpia = base?.trim() ?? '';
  return limpia === '' ? null : `${sinDiagonalFinal(limpia)}/${ruta}`;
}

function vigente(
  versiones: readonly LegalVersionSnapshot[],
  ahora: Date,
): LegalVersionSnapshot | null {
  const elegida = currentVersion(
    versiones.map((snapshot) => ({
      snapshot,
      version: snapshot.version,
      effectiveFrom: new Date(snapshot.effectiveFrom),
    })),
    ahora,
  );
  return elegida?.snapshot ?? null;
}

/** Arma lo que cotizaciones y comprobantes dicen del aviso de privacidad y de los términos: el aviso con su
 *  versión, el enlace (si ya hay dirección base) y el canal visible para ejercer derechos; y los términos
 *  vigentes tal como se publicaron [RF-M9-01, RF-M9-02, RF-M9-04, S4-11]. Nada se inventa: sin aviso
 *  publicado dice que lo da el vendedor, sin términos no los muestra y sin canal de contacto no lo escribe. */
export function buildDocumentLegal(entrada: {
  readonly legal: LegalSnapshot | null;
  readonly now: Date;
  readonly publicBaseUrl: string | null;
  /** WhatsApp o correo del negocio para ejercer derechos; `null` mientras esté por definir (PD-11). */
  readonly rightsContact: string | null;
  readonly labels: DocumentLegalLabels;
}): DocumentLegal {
  const { labels } = entrada;
  const aviso = entrada.legal === null ? null : vigente(entrada.legal.privacy, entrada.now);
  const terminos = entrada.legal === null ? null : vigente(entrada.legal.terms, entrada.now);
  const canal = entrada.rightsContact?.trim() ?? '';

  const partesDelAviso: string[] = [];
  if (aviso === null) {
    partesDelAviso.push(labels.noNotice);
  } else {
    partesDelAviso.push(
      labels.notice(aviso.version, formatoDeFecha(new Date(aviso.effectiveFrom))),
    );
    const enlace = legalLink(entrada.publicBaseUrl, 'aviso');
    if (enlace !== null) {
      partesDelAviso.push(labels.readFull(enlace));
    }
  }
  if (canal !== '') {
    partesDelAviso.push(labels.rights(canal));
  }

  const lineasDeTerminos =
    terminos === null
      ? []
      : terminos.body
          .split('\n')
          .map((r) => r.trim())
          .filter((r) => r !== '');
  const enlaceDeTerminos = legalLink(entrada.publicBaseUrl, 'terminos');

  return {
    privacyNotice: partesDelAviso.join(' '),
    terms:
      terminos === null || lineasDeTerminos.length === 0
        ? null
        : {
            title: labels.termsTitle(terminos.version),
            lines:
              enlaceDeTerminos === null
                ? lineasDeTerminos
                : [...lineasDeTerminos, labels.termsLink(enlaceDeTerminos)],
          },
  };
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `3 nov 2026`, en hora de México [RN-17, RN-22]. */
function formatoDeFecha(instante: Date): string {
  const [anio, mes, dia] = mexicoDate(instante).split('-').map(Number);
  return `${String(dia ?? 0)} ${MESES[(mes ?? 1) - 1] ?? ''} ${String(anio ?? 0)}`;
}
