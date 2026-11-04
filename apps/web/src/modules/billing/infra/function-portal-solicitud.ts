import type {
  PortalConsultaEntrada,
  PortalDescarga,
  PortalDescargaResultado,
  PortalSolicitud,
  PortalSolicitudResultado,
} from '@zammir/core';

export interface FunctionPortalOptions {
  /** Dirección de Supabase, sin diagonal final. */
  readonly url: string;
  readonly anonKey: string;
  /** Solo para pruebas. */
  readonly fetchImpl?: typeof fetch;
}

interface Llamada {
  readonly estado: number;
  readonly cuerpo: Record<string, unknown>;
}

/** Llama a una función de servidor del portal; `null` si no hay red, y un cuerpo vacío si no es JSON. */
async function llamar(
  opciones: FunctionPortalOptions,
  funcion: string,
  cuerpo: unknown,
): Promise<Llamada | null> {
  const peticion = opciones.fetchImpl ?? fetch;
  let respuesta: Response;
  try {
    respuesta = await peticion(`${opciones.url}/functions/v1/${funcion}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: opciones.anonKey,
        authorization: `Bearer ${opciones.anonKey}`,
      },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    return null;
  }
  try {
    return {
      estado: respuesta.status,
      cuerpo: (await respuesta.json()) as Record<string, unknown>,
    };
  } catch {
    return { estado: respuesta.status, cuerpo: {} };
  }
}

function segundosDeEspera(cuerpo: Record<string, unknown>): number {
  const segundos = Number(cuerpo.retryAfterSeconds);
  return Number.isFinite(segundos) && segundos > 0 ? segundos : 900;
}

/** Adaptador de la solicitud de factura: llama a la función de servidor `solicitar-factura` [S4-19]. */
export function functionPortalSolicitud(opciones: FunctionPortalOptions): PortalSolicitud {
  return async (entrada): Promise<PortalSolicitudResultado> => {
    const r = await llamar(opciones, 'solicitar-factura', {
      folio: entrada.folio,
      code: entrada.code,
      honeypot: entrada.honeypot,
      elapsedMs: entrada.elapsedMs,
      token: entrada.token,
      requestId: entrada.requestId,
      recipient: entrada.recipient,
      acceptedPrivacy: entrada.acceptedPrivacy,
    });
    if (r === null) {
      return { kind: 'NO_NETWORK' };
    }
    const { estado, cuerpo } = r;
    const factura = cuerpo.invoice as { folio?: unknown; uuid?: unknown } | undefined;
    if (
      estado === 200 &&
      factura !== undefined &&
      typeof factura.folio === 'string' &&
      typeof factura.uuid === 'string'
    ) {
      return { kind: 'STAMPED', folio: factura.folio, uuid: factura.uuid };
    }
    switch (estado) {
      case 202:
        return { kind: 'IN_PROCESS' };
      case 404:
        return { kind: 'NOT_AVAILABLE' };
      case 429:
        return { kind: 'BLOCKED', retryAfterSeconds: segundosDeEspera(cuerpo) };
      case 422:
        return { kind: 'REJECTED' };
      case 400:
        if (cuerpo.error === 'PRIVACY_NOT_ACCEPTED') {
          return { kind: 'PRIVACY_NOT_ACCEPTED' };
        }
        return Array.isArray(cuerpo.fields)
          ? {
              kind: 'INVALID',
              fields: cuerpo.fields.filter((f): f is string => typeof f === 'string'),
            }
          : { kind: 'UNAVAILABLE' };
      case 409:
        if (cuerpo.error === 'PAYMENT_FORM_UNDEFINED') {
          return { kind: 'PAYMENT_FORM_UNDEFINED' };
        }
        if (cuerpo.error === 'NOT_BILLABLE') {
          return { kind: 'NOT_BILLABLE' };
        }
        return typeof cuerpo.reason === 'string'
          ? { kind: 'INELIGIBLE', reason: cuerpo.reason }
          : { kind: 'UNAVAILABLE' };
      default:
        return { kind: 'UNAVAILABLE' };
    }
  };
}

/** Adaptador de la descarga: llama a la función de servidor `descargar-factura` [S4-19]. */
export function functionPortalDescarga(opciones: FunctionPortalOptions): PortalDescarga {
  return async (entrada: PortalConsultaEntrada, formato): Promise<PortalDescargaResultado> => {
    const r = await llamar(opciones, 'descargar-factura', {
      folio: entrada.folio,
      code: entrada.code,
      honeypot: entrada.honeypot,
      elapsedMs: entrada.elapsedMs,
      token: entrada.token,
      format: formato,
    });
    if (r === null) {
      return { kind: 'NO_NETWORK' };
    }
    const { estado, cuerpo } = r;
    if (
      estado === 200 &&
      typeof cuerpo.filename === 'string' &&
      typeof cuerpo.contentType === 'string' &&
      typeof cuerpo.content === 'string' &&
      (cuerpo.encoding === 'utf8' || cuerpo.encoding === 'base64')
    ) {
      return {
        kind: 'FILE',
        file: {
          filename: cuerpo.filename,
          contentType: cuerpo.contentType,
          encoding: cuerpo.encoding,
          content: cuerpo.content,
        },
      };
    }
    if (estado === 404) {
      return { kind: 'NOT_AVAILABLE' };
    }
    if (estado === 429) {
      return { kind: 'BLOCKED', retryAfterSeconds: segundosDeEspera(cuerpo) };
    }
    return { kind: 'UNAVAILABLE' };
  };
}
