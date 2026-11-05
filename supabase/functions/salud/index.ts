// S4-28 · Comprobación de disponibilidad para el monitoreo externo [RNF-34, ADR-0034].
// Pública y sin datos: responde 200 si la base contesta y 503 si no. Un servicio de monitoreo la consulta cada
// pocos minutos y avisa a Juanito cuando falla.
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { servir } from '../_shared/errores.ts';

const cabeceras = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
};

servir('salud', async () => {
  const servicio = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await servicio.rpc('health_check');
  const bien = error === null && data === true;
  return new Response(JSON.stringify({ ok: bien }), {
    status: bien ? 200 : 503,
    headers: cabeceras,
  });
});
