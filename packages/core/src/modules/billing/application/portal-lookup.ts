import type { Clock } from '../../../shared-kernel/clock';
import { looksAutomated } from '../domain/automation-signals';
import {
  DEFAULT_RATE_LIMIT,
  evaluateRateLimit,
  evaluateSelfInvoicing,
  normalizeFolio,
  normalizeVerificationCode,
  type RateLimitPolicy,
  type SelfInvoicingBlock,
  type SelfInvoicingSource,
} from '../domain/self-invoicing';

/** Lo que el portal sabe de una venta u orden, tal como lo entrega la base al servidor. */
export interface PortalDocumentRecord extends SelfInvoicingSource {
  readonly id: string;
  /** Folio con el que se encontró: el definitivo o, si aún no llega, el provisional. */
  readonly folio: string;
  readonly lines: readonly {
    readonly name: string;
    readonly quantity: number;
    readonly lineTotalCents: number;
  }[];
}

/** Puerto del portal hacia la base: solo funciones del servidor, nunca tablas directas [S4-18]. */
export interface PortalStore {
  /** La venta u orden con ese código y ese folio, o `null` si no hay ninguna que cuadre. */
  findDocument(folio: string, code: string): Promise<PortalDocumentRecord | null>;
  /** Fallos recientes de esa huella de IP y de ese folio, dentro de la ventana. */
  failureCounts(
    ipHash: string,
    folioHash: string,
    windowSeconds: number,
  ): Promise<{ readonly ip: number; readonly folio: number }>;
  recordFailure(ipHash: string, folioHash: string): Promise<void>;
}

export interface PortalLookupDeps {
  readonly store: PortalStore;
  readonly clock: Clock;
  /** Huella irreversible de un texto (la IP o el folio): nunca se guarda el dato en claro. */
  readonly hash: (texto: string) => Promise<string>;
  /** Verificación del servicio externo contra automatización (Turnstile); sin configurar, siempre `true`. */
  readonly verifyHuman: (token: string | null, ip: string) => Promise<boolean>;
  readonly rateLimit?: RateLimitPolicy;
}

export interface PortalLookupInput {
  readonly folio: string;
  readonly code: string;
  /** Dirección de quien llama, tal como la ve el servidor. */
  readonly ip: string;
  /** Campo trampa del formulario: una persona lo deja vacío [RF-M10-11]. */
  readonly honeypot?: string | null;
  /** Milisegundos que el formulario estuvo abierto antes de enviarse. */
  readonly elapsedMs?: number | null;
  /** Respuesta del servicio externo contra automatización. */
  readonly humanToken?: string | null;
}

/** Lo único que el portal muestra antes de pedir los datos fiscales: conceptos y total [RF-M10-12]. */
export interface PortalDocument {
  readonly type: 'COUNTER_SALE' | 'WORK_ORDER';
  readonly folio: string;
  readonly totalCents: number;
  readonly lines: PortalDocumentRecord['lines'];
  /** Último día para facturar, `AAAA-MM-DD` [RN-26]. */
  readonly deadline: string;
}

export type PortalLookupOutcome =
  | { readonly kind: 'OK'; readonly document: PortalDocument }
  /** Folio o código que no cuadran, formato inválido o tráfico automatizado. Siempre la misma respuesta: no
   *  revela si el folio existe [RF-M10-11]. */
  | { readonly kind: 'NOT_AVAILABLE' }
  | { readonly kind: 'BLOCKED'; readonly retryAfterSeconds: number }
  /** El código era el correcto (quien llama tiene el ticket), pero no se puede facturar [RN-24 a RN-26]. */
  | { readonly kind: 'INELIGIBLE'; readonly reason: SelfInvoicingBlock }
  | { readonly kind: 'UNAVAILABLE' };

/** Atiende una consulta del portal `/factura`: valida formatos, frena automatización y exceso de intentos,
 *  busca el documento y decide si se puede facturar. Los datos solo salen cuando folio y código cuadran y la
 *  operación está liquidada, sin facturar y en plazo [RF-M10-09, RF-M10-10, RN-24, RN-25, RN-26]. */
export async function lookupInvoiceDocument(
  deps: PortalLookupDeps,
  entrada: PortalLookupInput,
): Promise<PortalLookupOutcome> {
  const politica = deps.rateLimit ?? DEFAULT_RATE_LIMIT;
  const folio = normalizeFolio(entrada.folio);
  const code = normalizeVerificationCode(entrada.code);

  try {
    // El folio escrito, aunque no tenga forma de folio, cuenta contra su propia huella (acotado a 64 letras).
    const ipHash = await deps.hash(`ip:${entrada.ip}`);
    const folioHash = await deps.hash(
      `folio:${(folio ?? entrada.folio.trim().toUpperCase()).slice(0, 64)}`,
    );

    const conteo = await deps.store.failureCounts(ipHash, folioHash, politica.windowSeconds);
    const limite = evaluateRateLimit(conteo, politica);
    if (!limite.allowed) {
      return { kind: 'BLOCKED', retryAfterSeconds: limite.retryAfterSeconds };
    }

    const parecePrograma = looksAutomated({
      honeypot: entrada.honeypot,
      elapsedMs: entrada.elapsedMs,
    });
    const esPersona = parecePrograma
      ? false
      : await deps.verifyHuman(entrada.humanToken ?? null, entrada.ip);
    if (!esPersona || folio === null || code === null) {
      await deps.store.recordFailure(ipHash, folioHash);
      return { kind: 'NOT_AVAILABLE' };
    }

    const documento = await deps.store.findDocument(folio, code);
    if (documento === null) {
      await deps.store.recordFailure(ipHash, folioHash);
      return { kind: 'NOT_AVAILABLE' };
    }

    const permiso = evaluateSelfInvoicing({
      source: documento,
      now: deps.clock.now(),
    });
    if (!permiso.ok) {
      return { kind: 'INELIGIBLE', reason: permiso.error };
    }
    return {
      kind: 'OK',
      document: {
        type: documento.type,
        folio: documento.folio,
        totalCents: documento.totalCents,
        lines: documento.lines,
        deadline: permiso.value.deadline,
      },
    };
  } catch {
    return { kind: 'UNAVAILABLE' };
  }
}
