import type { PortalConsulta, PortalLookupOutcome, SelfInvoicingBlock } from '@zammir/core';

export interface FunctionPortalConsultaOptions {
  /** Dirección de Supabase, sin diagonal final. */
  readonly url: string;
  readonly anonKey: string;
  /** Solo para pruebas. */
  readonly fetchImpl?: typeof fetch;
}

const RAZONES: readonly SelfInvoicingBlock[] = [
  'CANCELLED',
  'ALREADY_INVOICED',
  'NOT_SETTLED',
  'EXPIRED',
];

/** Adaptador del portal: llama a la función de servidor `consultar-factura`. El navegador nunca lee tablas
 *  del portal; la función decide qué se puede mostrar [S4-18, RNF-12]. */
export function functionPortalConsulta(opciones: FunctionPortalConsultaOptions): PortalConsulta {
  const peticion = opciones.fetchImpl ?? fetch;
  return async (entrada) => {
    let respuesta: Response;
    try {
      respuesta = await peticion(`${opciones.url}/functions/v1/consultar-factura`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: opciones.anonKey,
          authorization: `Bearer ${opciones.anonKey}`,
        },
        body: JSON.stringify({
          folio: entrada.folio,
          code: entrada.code,
          honeypot: entrada.honeypot,
          elapsedMs: entrada.elapsedMs,
          token: entrada.token,
        }),
      });
    } catch {
      return { kind: 'NO_NETWORK' };
    }
    let cuerpo: Record<string, unknown> = {};
    try {
      cuerpo = (await respuesta.json()) as Record<string, unknown>;
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
    if (
      respuesta.status === 200 &&
      typeof cuerpo.document === 'object' &&
      cuerpo.document !== null
    ) {
      return {
        kind: 'OK',
        document: cuerpo.document as Extract<PortalLookupOutcome, { kind: 'OK' }>['document'],
      };
    }
    if (respuesta.status === 404) {
      return { kind: 'NOT_AVAILABLE' };
    }
    if (respuesta.status === 429) {
      const segundos = Number(cuerpo.retryAfterSeconds);
      return {
        kind: 'BLOCKED',
        retryAfterSeconds: Number.isFinite(segundos) && segundos > 0 ? segundos : 900,
      };
    }
    if (respuesta.status === 409) {
      const razon = RAZONES.find((r) => r === cuerpo.reason);
      return razon === undefined ? { kind: 'UNAVAILABLE' } : { kind: 'INELIGIBLE', reason: razon };
    }
    return { kind: 'UNAVAILABLE' };
  };
}
