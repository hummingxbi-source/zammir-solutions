// S4-28 · Recibe errores del navegador y los guarda sin datos personales [RNF-34, ADR-0034].
// Es pública (la tablet puede fallar antes de tener sesión). No confía en el navegador: vuelve a limpiar y acotar
// todo con el mismo código del núcleo, ignora el cuerpo si es grande y no guarda IP ni usuario. Responde siempre
// 204 para no darle pistas a quien lo pruebe; el tope por minuto vive en la base.
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { parseErrorReport } from '../_shared/core.mjs';
import { servir } from '../_shared/errores.ts';

const MAX_BYTES = 8_000;

const cabeceras = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization, apikey',
};

servir('registrar-error', async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cabeceras });
  }
  if (req.method !== 'POST') {
    return new Response(null, { status: 405, headers: cabeceras });
  }
  const texto = await req.text();
  if (texto.length <= MAX_BYTES) {
    let reporte = null;
    try {
      reporte = parseErrorReport(JSON.parse(texto));
    } catch {
      reporte = null;
    }
    if (reporte !== null) {
      const servicio = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      await servicio.rpc('error_log_record', {
        p_source: 'CLIENT',
        p_name: reporte.name,
        p_message: reporte.message,
        p_stack: reporte.stack,
        p_route: reporte.route,
        p_app_version: reporte.appVersion,
      });
    }
  }
  return new Response(null, { status: 204, headers: cabeceras });
});
