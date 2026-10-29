// S0-16b · Registro de una tablet con un código de un solo uso [RF-M8-02, ADR-0013].
// La tablet aún no tiene identidad, por eso este punto de entrada es público (sin JWT) y la
// seguridad es el código: de un solo uso, de vida corta y guardado solo como hash.
// Crea la identidad de la tablet en Supabase Auth (rol DEVICE), canjea el código y devuelve
// la sesión del dispositivo. Si el canje falla, la identidad recién creada se borra.
// @ts-nocheck: el archivo se ejecuta en Deno, no lo compila el TypeScript del repositorio.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { err, ok, redeemRegistrationCode } from '../_shared/core.mjs';

const cabeceras = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization, apikey',
};

function responder(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: cabeceras });
}

const ESTADO_POR_ERROR: Record<string, number> = {
  INVALID_INPUT: 400,
  CODE_INVALID: 400,
  NOT_AUTHORIZED: 403,
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cabeceras });
  }
  if (req.method !== 'POST') {
    return responder(405, { error: 'METHOD_NOT_ALLOWED' });
  }

  let entrada: { codigo?: unknown; nombre?: unknown };
  try {
    entrada = await req.json();
  } catch {
    return responder(400, { error: 'INVALID_INPUT' });
  }
  if (typeof entrada.codigo !== 'string' || typeof entrada.nombre !== 'string') {
    return responder(400, { error: 'INVALID_INPUT' });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const servicio = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // La identidad se crea primero porque el canje la necesita; si el canje falla, se borra.
  const cuenta = { correo: `tablet-${crypto.randomUUID()}@dispositivos.zammir.invalid` };
  const clave = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const creada = await servicio.auth.admin.createUser({
    email: cuenta.correo,
    password: clave,
    email_confirm: true,
    app_metadata: { rol: 'DEVICE' },
  });
  if (creada.error !== null || creada.data.user === null) {
    return responder(503, { error: 'DEVICES_UNAVAILABLE' });
  }
  const idCuenta = creada.data.user.id;

  const repositorio = {
    async redeemCode({ code, name, authUserId }) {
      const { data, error } = await servicio.rpc('redeem_device_registration_code', {
        p_code: code,
        p_name: name,
        p_auth_user_id: authUserId,
      });
      if (error === null) {
        return ok({
          id: data.id,
          name: data.name,
          tempSeries: data.temp_series,
          status: data.status,
        });
      }
      if (error.message === 'CODE_INVALID') return err({ code: 'CODE_INVALID' });
      if (error.code === '22023') return err({ code: 'INVALID_INPUT' });
      return err({ code: 'DEVICES_UNAVAILABLE' });
    },
  };

  const canje = await redeemRegistrationCode(
    { devices: repositorio },
    { code: entrada.codigo, name: entrada.nombre, authUserId: idCuenta },
  );
  if (!canje.ok) {
    await servicio.auth.admin.deleteUser(idCuenta);
    return responder(ESTADO_POR_ERROR[canje.error.code] ?? 503, { error: canje.error.code });
  }

  const anonimo = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sesion = await anonimo.auth.signInWithPassword({ email: cuenta.correo, password: clave });
  if (sesion.error !== null || sesion.data.session === null) {
    return responder(503, { error: 'DEVICES_UNAVAILABLE' });
  }

  return responder(200, {
    dispositivo: {
      id: canje.value.id,
      nombre: canje.value.name,
      serie: canje.value.tempSeries,
    },
    sesion: {
      access_token: sesion.data.session.access_token,
      refresh_token: sesion.data.session.refresh_token,
    },
  });
});
