// S0-17 · Prueba de que packages/core corre dentro de una función de Supabase (Deno).
// Usa tres piezas del núcleo: Result, el generador de ids y el esquema Zod de la configuración.
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import {
  asId,
  err,
  hasIdleExpired,
  ok,
  parseBusinessSettings,
  sequentialIdGenerator,
} from '../_shared/core.mjs';

Deno.serve((req: Request) => {
  const ids = sequentialIdGenerator('srv');
  const sinFilas = parseBusinessSettings([]);
  const cuerpo = {
    result: ok(1).ok === true && err({ code: 'X' }).ok === false,
    ids: [ids.newId(), ids.newId()],
    idConMarca: asId('abc'),
    zodRechazaLoIncompleto: sinFilas.ok === false && sinFilas.error.code === 'SETTINGS_INVALID',
    inactividad: hasIdleExpired(new Date(0), new Date(10 * 60_000), 5),
    metodo: req.method,
  };
  return new Response(JSON.stringify(cuerpo), { headers: { 'content-type': 'application/json' } });
});
