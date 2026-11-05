// Piezas comunes de las funciones públicas del portal de autofacturación (`consultar-factura`,
// `solicitar-factura` y `descargar-factura`) [S4-18, S4-19, ADR-0030]. La lógica vive en el núcleo; esto solo
// conecta HTTP, la base (con funciones `portal_*`, nunca tablas) y el servicio contra automatización.
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { DEFAULT_RATE_LIMIT, parsePortalDocumentRow } from './core.mjs';

export const cabeceras = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization, apikey',
};

export function responder(
  estado: number,
  cuerpo: unknown,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cabeceras, ...extra },
  });
}

const entero = (valor: string | undefined, porOmision: number): number => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : porOmision;
};

/** IP de quien llama: Cloudflare la pone en `cf-connecting-ip`; si no, el primer valor de `x-forwarded-for`. */
export function ipDe(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'desconocida'
  );
}

async function huella(texto: string, pimienta: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${pimienta}:${texto}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Verificación contra automatización de Cloudflare (Turnstile). Sin llave configurada no se exige: la
 *  primera línea de defensa son el campo trampa, el tiempo y el límite de intentos. */
async function verificarPersona(token: string | null, ip: string): Promise<boolean> {
  const secreto = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (secreto === undefined || secreto === '') {
    return true;
  }
  if (token === null || token === '') {
    return false;
  }
  const formulario = new FormData();
  formulario.append('secret', secreto);
  formulario.append('response', token);
  if (ip !== 'desconocida') {
    formulario.append('remoteip', ip);
  }
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formulario,
    });
    const datos = await r.json();
    return datos.success === true;
  } catch {
    // Si el servicio no responde no se deja pasar: el cliente puede reintentar en un momento.
    return false;
  }
}

export function clienteDeServicio() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function rpcOFalla(servicio, nombre: string, argumentos: Record<string, unknown>) {
  return servicio.rpc(nombre, argumentos).then(({ data, error }) => {
    if (error !== null) {
      throw new Error('PORTAL_UNAVAILABLE');
    }
    return data;
  });
}

/** Lo que la lógica del portal necesita de la base y del entorno, con las funciones `portal_*`. */
export function dependenciasDelPortal(servicio) {
  // La pimienta evita que las huellas se puedan reconstruir probando IPs; sin una propia usa la llave de servicio.
  const pimienta =
    Deno.env.get('PORTAL_HASH_PEPPER') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return {
    store: {
      async findDocument(folio: string, code: string) {
        const data = await rpcOFalla(servicio, 'portal_find_document', {
          p_folio: folio,
          p_code: code,
        });
        return data === null ? null : parsePortalDocumentRow(data);
      },
      async failureCounts(ipHash: string, folioHash: string, windowSeconds: number) {
        const data = await rpcOFalla(servicio, 'portal_failure_counts', {
          p_ip_hash: ipHash,
          p_folio_hash: folioHash,
          p_window_seconds: windowSeconds,
        });
        const fila = Array.isArray(data) ? data[0] : data;
        if (fila === undefined || fila === null) {
          throw new Error('PORTAL_UNAVAILABLE');
        }
        return { ip: fila.ip_failures, folio: fila.folio_failures };
      },
      async recordFailure(ipHash: string, folioHash: string) {
        await rpcOFalla(servicio, 'portal_record_failure', {
          p_ip_hash: ipHash,
          p_folio_hash: folioHash,
        });
      },
    },
    clock: { now: () => new Date() },
    hash: (texto: string) => huella(texto, pimienta),
    verifyHuman: verificarPersona,
    rateLimit: {
      windowSeconds: entero(
        Deno.env.get('PORTAL_WINDOW_SECONDS'),
        DEFAULT_RATE_LIMIT.windowSeconds,
      ),
      maxFailuresPerIp: entero(
        Deno.env.get('PORTAL_MAX_FAILS_IP'),
        DEFAULT_RATE_LIMIT.maxFailuresPerIp,
      ),
      maxFailuresPerFolio: entero(
        Deno.env.get('PORTAL_MAX_FAILS_FOLIO'),
        DEFAULT_RATE_LIMIT.maxFailuresPerFolio,
      ),
    },
  };
}

/** Lo que dice la petición del portal sobre quién llama y qué documento pide. */
export function entradaDelPortal(req: Request, cuerpo: Record<string, unknown>) {
  return {
    folio: cuerpo.folio,
    code: cuerpo.code,
    ip: ipDe(req),
    honeypot: typeof cuerpo.honeypot === 'string' ? cuerpo.honeypot : null,
    elapsedMs: typeof cuerpo.elapsedMs === 'number' ? cuerpo.elapsedMs : null,
    humanToken: typeof cuerpo.token === 'string' ? cuerpo.token : null,
  };
}

/** Lee el cuerpo JSON de una petición del portal; `null` si no es un objeto con folio y código. */
export async function leerCuerpo(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const cuerpo = await req.json();
    if (
      typeof cuerpo !== 'object' ||
      cuerpo === null ||
      typeof cuerpo.folio !== 'string' ||
      typeof cuerpo.code !== 'string'
    ) {
      return null;
    }
    return cuerpo;
  } catch {
    return null;
  }
}

function aBase64(bytes: Uint8Array): string {
  let texto = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(texto);
}

function deBase64(texto: string): Uint8Array {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
}

/** El proveedor de timbrado. Hoy solo existe el simulado, que **no tiene validez fiscal**: debe pedirse de
 *  forma explícita con `BILLING_PROVIDER=simulated`. Sin eso (o con un proveedor real que aún no está
 *  conectado, S4-15) la función responde que no está configurada, para no emitir una factura falsa por error. */
export function proveedorDeTimbrado(simulatedBilling) {
  if (Deno.env.get('BILLING_PROVIDER') !== 'simulated') {
    return null;
  }
  return simulatedBilling({
    clock: { now: () => new Date() },
    idGenerator: { newId: () => crypto.randomUUID() },
  });
}

/** Las facturas pedidas y sus archivos, con las funciones `portal_invoice_*`. */
export function almacenDeFacturas(servicio) {
  return {
    async begin({ requestId, source, channel }) {
      const data = await rpcOFalla(servicio, 'portal_invoice_begin', {
        p_request_id: requestId,
        p_source_type: source.type,
        p_source_id: source.id,
        p_channel: channel,
      });
      return data;
    },
    async markStamped(requestId, entrada) {
      const folio = await rpcOFalla(servicio, 'portal_invoice_mark_stamped', {
        p_request_id: requestId,
        p_uuid: entrada.uuid,
        p_stamped_at: entrada.stampedAt.toISOString(),
        p_recipient: entrada.recipient,
        p_payment_form: entrada.paymentForm ?? null,
        p_xml: entrada.xml,
        p_pdf_base64: aBase64(entrada.pdf),
      });
      return { folio };
    },
    async markFailed(requestId) {
      await rpcOFalla(servicio, 'portal_invoice_mark_failed', { p_request_id: requestId });
    },
  };
}

export function almacenDeArchivos(servicio) {
  return {
    async find(source) {
      const data = await rpcOFalla(servicio, 'portal_invoice_files', {
        p_source_type: source.type,
        p_source_id: source.id,
      });
      const fila = Array.isArray(data) ? data[0] : data;
      if (fila === undefined || fila === null) {
        return null;
      }
      return {
        folio: fila.invoice_folio,
        uuid: fila.invoice_uuid,
        xml: fila.xml,
        pdfBase64: fila.pdf_base64,
      };
    },
  };
}

export { deBase64 };

/** Quién llama a una función protegida: su identificador y su rol, según el token de Supabase Auth. `null` si
 *  no hay token o no vale. El rol sale de `app_metadata`, que solo el servidor puede escribir. */
export async function usuarioDeLaPeticion(servicio, req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (token === '') {
    return null;
  }
  const { data, error } = await servicio.auth.getUser(token);
  if (error !== null || data?.user === null || data?.user === undefined) {
    return null;
  }
  const rol = data.user.app_metadata?.rol;
  return { userId: data.user.id, role: typeof rol === 'string' ? rol : null };
}

/** La venta u orden que se quiere facturar, leída por su identificador (solo para funciones del servidor). */
export function almacenDeFuentes(servicio) {
  return {
    async find(source) {
      const data = await rpcOFalla(servicio, 'system_find_invoice_source', {
        p_type: source.type,
        p_id: source.id,
      });
      return data === null ? null : parsePortalDocumentRow(data);
    },
  };
}
