/** Un error listo para guardarse: sin datos personales [RNF-34]. */
export interface ErrorReport {
  readonly source: 'CLIENT' | 'SERVER';
  readonly name: string;
  readonly message: string;
  readonly stack: string;
  /** Solo la ruta, sin consulta ni identificadores: `/factura`, `/clientes/:id`. */
  readonly route: string;
  readonly appVersion: string;
}

export interface ErrorReportInput {
  readonly source: 'CLIENT' | 'SERVER';
  readonly error: unknown;
  readonly route?: string | undefined;
  readonly appVersion?: string | undefined;
}

export const MAX_MESSAGE_LENGTH = 500;
export const MAX_STACK_LENGTH = 2000;
const MAX_NAME_LENGTH = 100;
const MAX_ROUTE_LENGTH = 200;
const MAX_VERSION_LENGTH = 40;

/** Cada regla cambia un tipo de dato personal o secreto por una marca. El orden importa: primero lo más específico. */
const RULES: readonly (readonly [RegExp, string])[] = [
  [/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*/g, '[token]'],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[correo]'],
  [
    /\b(bearer|apikey|token|password|contraseña|clave|pin|secret|codigo|código)(\s*[:=]\s*|\s+)[^\s,;"']+/gi,
    '$1$2[secreto]',
  ],
  [/\b[A-ZÑ&]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/g, '[curp]'],
  [/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/g, '[rfc]'],
  // Direcciones web: se conserva el sitio y la ruta, nunca la consulta ni lo que sigue al "#".
  [/(\bhttps?:\/\/[^\s?#"')]+|\/[\w./-]*)[?#][^\s"')]*/g, '$1'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]'],
  [/\+?\d(?:[\s().-]?\d){6,}/g, '[número]'],
  [/\b[\w-]{32,}\b/g, '[secreto]'],
];

/** Quita de un texto lo que parezca dato personal o secreto: correos, teléfonos, RFC, CURP, tokens, claves y la
 *  consulta de las direcciones. No puede reconocer un nombre propio: por eso un error nunca lleva valores que
 *  escribió una persona, solo el texto del programa [RNF-34]. */
export function scrubText(texto: string): string {
  return RULES.reduce((actual, [patron, marca]) => actual.replace(patron, marca), texto);
}

const SEGMENTO_CON_ID =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{4,}|[A-Z]{1,3}-\d{4}-\d+)$/i;

/** Deja solo la ruta: sin consulta, sin "#" y con los identificadores y folios cambiados por `:id`. */
export function scrubRoute(ruta: string): string {
  const sinConsulta = (ruta.split(/[?#]/)[0] ?? '').replace(/^https?:\/\/[^/]+/i, '');
  const limpia = sinConsulta
    .split('/')
    .map((segmento) => (SEGMENTO_CON_ID.test(segmento) ? ':id' : segmento))
    .join('/');
  return scrubText(limpia).slice(0, MAX_ROUTE_LENGTH) || '/';
}

function recortar(texto: string, largo: number): string {
  return texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto;
}

/** Lo que se sabe de un error sin importar qué se haya lanzado: un `Error`, un texto o cualquier cosa. */
function describir(error: unknown): { name: string; message: string; stack: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack ?? '' };
  }
  if (typeof error === 'string') {
    return { name: 'Error', message: error, stack: '' };
  }
  return { name: 'Error', message: 'Se lanzó un valor que no es un error', stack: '' };
}

/** Arma el reporte de un error sin datos personales y con tamaños acotados. Nunca incluye `cause`, datos
 *  adjuntos ni el cuerpo de una petición [RNF-34]. */
export function buildErrorReport(entrada: ErrorReportInput): ErrorReport {
  const { name, message, stack } = describir(entrada.error);
  return {
    source: entrada.source,
    name: recortar(scrubText(name), MAX_NAME_LENGTH),
    message: recortar(scrubText(message), MAX_MESSAGE_LENGTH),
    stack: recortar(scrubText(stack), MAX_STACK_LENGTH),
    route: scrubRoute(entrada.route ?? '/'),
    appVersion: recortar(
      scrubText(
        entrada.appVersion === undefined || entrada.appVersion === ''
          ? 'desconocida'
          : entrada.appVersion,
      ),
      MAX_VERSION_LENGTH,
    ),
  };
}

/** Un reporte que llega por la red: se vuelve a limpiar y acotar en el servidor, porque nadie garantiza que el
 *  navegador lo haya hecho. `null` si no tiene la forma esperada. */
export function parseErrorReport(valor: unknown): ErrorReport | null {
  if (typeof valor !== 'object' || valor === null) {
    return null;
  }
  const r = valor as Record<string, unknown>;
  if (r.source !== 'CLIENT' && r.source !== 'SERVER') {
    return null;
  }
  if (typeof r.name !== 'string' || typeof r.message !== 'string') {
    return null;
  }
  const texto = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    source: r.source,
    name: recortar(scrubText(r.name), MAX_NAME_LENGTH),
    message: recortar(scrubText(r.message), MAX_MESSAGE_LENGTH),
    stack: recortar(scrubText(texto(r.stack)), MAX_STACK_LENGTH),
    route: scrubRoute(texto(r.route) || '/'),
    appVersion: recortar(scrubText(texto(r.appVersion) || 'desconocida'), MAX_VERSION_LENGTH),
  };
}

/** Huella para agrupar el mismo error: nombre, mensaje y primer renglón de la pila. */
export function fingerprintOf(r: ErrorReport): string {
  return `${r.name}|${r.message.slice(0, 120)}|${r.stack.split('\n')[1]?.trim() ?? ''}`;
}
