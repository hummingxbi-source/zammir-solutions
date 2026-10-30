// S2-03 · Receptor de operaciones de las tablets [RNF-03, RNF-11, ADR-0016].
// Valida el sobre y la carga con el mismo código que usa la tablet (packages/core) y entrega la
// operación a la función SQL `receive_operation`, que en UNA transacción comprueba idempotencia y
// orden, aplica el cambio y asigna el folio. Esta función no decide nada contable.
// Se llama con la sesión de la tablet (su JWT): la base verifica que sea un dispositivo activo.
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { issueQuotePayloadSchema, parseEnvelope } from '../_shared/core.mjs';

const cabeceras = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization, apikey',
};

function responder(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras });
}

// Los rechazos estructurales son una respuesta válida (200 con ok:false): la tablet los distingue
// de una falla del servidor (5xx), que se reintenta.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cabeceras });
  }
  if (req.method !== 'POST') {
    return responder(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return responder(200, { ok: false, code: 'INVALID_ENVELOPE' });
  }

  const sobre = parseEnvelope(cuerpo);
  if (!sobre.ok) {
    return responder(200, {
      ok: false,
      code: sobre.error.code === 'UNKNOWN_TYPE' ? 'UNKNOWN_TYPE' : 'INVALID_ENVELOPE',
    });
  }
  if (sobre.value.type === 'IssueQuote') {
    const carga = issueQuotePayloadSchema.safeParse(sobre.value.payload);
    if (!carga.success) {
      return responder(200, {
        ok: false,
        code: 'INVALID_PAYLOAD',
        detail: carga.error.issues
          .map((i) => i.message)
          .join('; ')
          .slice(0, 300),
      });
    }
  }

  const autorizacion = req.headers.get('authorization') ?? '';
  const cliente = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { authorization: autorizacion } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data, error } = await cliente.rpc('receive_operation', { p: cuerpo });
  if (error !== null) {
    return responder(503, { ok: false, code: 'RECEIVER_UNAVAILABLE' });
  }
  return responder(200, data);
});
