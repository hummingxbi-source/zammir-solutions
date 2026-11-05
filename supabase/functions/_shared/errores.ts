// Registro de errores del servidor sin datos personales [RNF-34, S4-28, ADR-0034].
// `servir` reemplaza a `Deno.serve`: si una función lanza una excepción que nadie atrapó, el error se limpia con el
// mismo código del navegador (packages/core), se guarda en `error_log` y la persona recibe un 500 sin detalles.
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { buildErrorReport } from './core.mjs';

const VERSION = Deno.env.get('APP_VERSION') ?? 'servidor';

/** Guarda un error de una función de servidor. Nunca lanza: registrar no debe tumbar nada. */
export async function registrarErrorDeServidor(nombre: string, error: unknown): Promise<void> {
  try {
    const reporte = buildErrorReport({
      source: 'SERVER',
      error,
      route: `/functions/${nombre}`,
      appVersion: VERSION,
    });
    const servicio = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    await servicio.rpc('error_log_record', {
      p_source: reporte.source,
      p_name: reporte.name,
      p_message: reporte.message,
      p_stack: reporte.stack,
      p_route: reporte.route,
      p_app_version: reporte.appVersion,
    });
  } catch {
    // Sin registro no hay nada más que hacer.
  }
}

/** `Deno.serve` con registro de excepciones sin atrapar. */
export function servir(nombre: string, manejador: (req: Request) => Response | Promise<Response>) {
  return Deno.serve(async (req: Request) => {
    try {
      return await manejador(req);
    } catch (error) {
      await registrarErrorDeServidor(nombre, error);
      return new Response(JSON.stringify({ error: 'INTERNAL' }), {
        status: 500,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
        },
      });
    }
  });
}
