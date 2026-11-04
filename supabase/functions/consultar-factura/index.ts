// S4-18 · Portal público de autofacturación: consulta de una venta u orden con su folio y código [RF-M10-09
// a RF-M10-12, RNF-12, ADR-0030].
// Es público (sin JWT): lo abre cualquiera con el QR de su ticket. La seguridad no es la sesión sino que
// (1) solo responde datos si el folio y el código cuadran, (2) responde siempre igual cuando no cuadran,
// (3) limita los intentos por IP y por folio y (4) frena a los programas. Toda la lógica vive en el núcleo
// (`lookupInvoiceDocument`); este archivo solo conecta la base, el servicio contra automatización y HTTP.
// La base se toca únicamente con funciones del servidor (`portal_*`), nunca con tablas.
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import {
  DEFAULT_RATE_LIMIT,
  lookupInvoiceDocument,
  parsePortalDocumentRow,
} from '../_shared/core.mjs';

const cabeceras = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization, apikey',
};

function responder(estado: number, cuerpo: unknown, extra: Record<string, string> = {}): Response {
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
function ipDe(req: Request): string {
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cabeceras });
  }
  if (req.method !== 'POST') {
    return responder(405, { error: 'METHOD_NOT_ALLOWED' });
  }

  let entrada: Record<string, unknown>;
  try {
    entrada = await req.json();
  } catch {
    return responder(400, { error: 'INVALID_INPUT' });
  }
  if (typeof entrada.folio !== 'string' || typeof entrada.code !== 'string') {
    return responder(400, { error: 'INVALID_INPUT' });
  }

  const servicio = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  // La pimienta evita que las huellas se puedan reconstruir probando IPs; sin una propia usa la llave de servicio.
  const pimienta =
    Deno.env.get('PORTAL_HASH_PEPPER') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const almacen = {
    async findDocument(folio: string, code: string) {
      const { data, error } = await servicio.rpc('portal_find_document', {
        p_folio: folio,
        p_code: code,
      });
      if (error !== null) {
        throw new Error('PORTAL_UNAVAILABLE');
      }
      return data === null ? null : parsePortalDocumentRow(data);
    },
    async failureCounts(ipHash: string, folioHash: string, windowSeconds: number) {
      const { data, error } = await servicio.rpc('portal_failure_counts', {
        p_ip_hash: ipHash,
        p_folio_hash: folioHash,
        p_window_seconds: windowSeconds,
      });
      const fila = Array.isArray(data) ? data[0] : data;
      if (error !== null || fila === undefined || fila === null) {
        throw new Error('PORTAL_UNAVAILABLE');
      }
      return { ip: fila.ip_failures, folio: fila.folio_failures };
    },
    async recordFailure(ipHash: string, folioHash: string) {
      const { error } = await servicio.rpc('portal_record_failure', {
        p_ip_hash: ipHash,
        p_folio_hash: folioHash,
      });
      if (error !== null) {
        throw new Error('PORTAL_UNAVAILABLE');
      }
    },
  };

  const resultado = await lookupInvoiceDocument(
    {
      store: almacen,
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
    },
    {
      folio: entrada.folio,
      code: entrada.code,
      ip: ipDe(req),
      honeypot: typeof entrada.honeypot === 'string' ? entrada.honeypot : null,
      elapsedMs: typeof entrada.elapsedMs === 'number' ? entrada.elapsedMs : null,
      humanToken: typeof entrada.token === 'string' ? entrada.token : null,
    },
  );

  switch (resultado.kind) {
    case 'OK':
      return responder(200, { document: resultado.document });
    case 'NOT_AVAILABLE':
      return responder(404, { error: 'NOT_AVAILABLE' });
    case 'BLOCKED':
      return responder(
        429,
        { error: 'TOO_MANY_ATTEMPTS', retryAfterSeconds: resultado.retryAfterSeconds },
        { 'retry-after': String(resultado.retryAfterSeconds) },
      );
    case 'INELIGIBLE':
      return responder(409, { error: 'NOT_ELIGIBLE', reason: resultado.reason });
    default:
      return responder(503, { error: 'PORTAL_UNAVAILABLE' });
  }
});
