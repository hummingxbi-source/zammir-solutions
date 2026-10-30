import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { supabaseAdminAuth } from '../../identity/infra/supabase-admin-auth';
import { supabaseDeviceRepository } from './supabase-device-repository';

// Pruebas contra Supabase local real y la función de servidor `registrar-dispositivo`.
// Corren con `pnpm test:integracion`, que enciende las funciones si hace falta.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const sufijo = Math.random().toString(36).slice(2, 10);
const admin = { email: `reg-admin-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Admin1` };

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
function crearCliente(llave: string) {
  return createClient(URL, llave, opciones);
}

interface Respuesta {
  readonly estado: number;
  readonly cuerpo: Record<string, unknown>;
}

async function registrar(codigo: string, nombre: string): Promise<Respuesta> {
  const respuesta = await fetch(`${URL}/functions/v1/registrar-dispositivo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: ANON },
    body: JSON.stringify({ codigo, nombre }),
  });
  return { estado: respuesta.status, cuerpo: (await respuesta.json()) as Record<string, unknown> };
}

let servicio: ReturnType<typeof crearCliente>;
let idAdmin = '';

async function cuentasDeTablet(): Promise<number> {
  const { data, error } = await servicio.auth.admin.listUsers({ perPage: 1000 });
  expect(error).toBeNull();
  return data.users.filter((u) => u.email?.startsWith('tablet-')).length;
}

async function codigoNuevo(): Promise<string> {
  const cliente = crearCliente(ANON);
  await supabaseAdminAuth(cliente).signIn(admin.email, admin.password);
  const emitido = await supabaseDeviceRepository(cliente).issueCode(15);
  if (!emitido.ok) {
    throw new Error('no se pudo emitir el código');
  }
  return emitido.value.code;
}

beforeAll(async () => {
  expect(URL, 'faltan las variables: usa `pnpm test:integracion`').not.toBe('');
  servicio = crearCliente(SERVICIO);
  const { data, error } = await servicio.auth.admin.createUser({
    email: admin.email,
    password: admin.password,
    email_confirm: true,
    app_metadata: { rol: 'ADMIN' },
  });
  expect(error).toBeNull();
  idAdmin = data.user?.id ?? '';
});

afterAll(async () => {
  const { data } = await servicio.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users) {
    if (u.id === idAdmin || u.email?.startsWith('tablet-')) {
      await servicio.auth.admin.deleteUser(u.id);
    }
  }
});

describe('función registrar-dispositivo', () => {
  it('con un código vigente registra la tablet y le da una sesión que solo ve lo suyo', async () => {
    const codigo = await codigoNuevo();
    const { estado, cuerpo } = await registrar(codigo, 'Tablet del mostrador');
    expect(estado).toBe(200);
    expect(cuerpo.dispositivo).toMatchObject({ nombre: 'Tablet del mostrador' });

    const sesion = cuerpo.sesion as { access_token: string; refresh_token: string };
    const tablet = crearCliente(ANON);
    const puesta = await tablet.auth.setSession(sesion);
    expect(puesta.error).toBeNull();

    // Ve su propio renglón y los ajustes del negocio, no los de otras tablets.
    const propios = await tablet.from('devices').select('id');
    expect(propios.data).toHaveLength(1);
    const ajustes = await tablet.from('business_settings').select('key');
    expect((ajustes.data ?? []).length).toBeGreaterThan(0);
  });

  it('el mismo código no sirve dos veces y no deja cuentas de sobra', async () => {
    const codigo = await codigoNuevo();
    expect((await registrar(codigo, 'Primera')).estado).toBe(200);
    const antes = await cuentasDeTablet();
    const segunda = await registrar(codigo, 'Segunda');
    expect(segunda).toEqual({ estado: 400, cuerpo: { error: 'CODE_INVALID' } });
    expect(await cuentasDeTablet()).toBe(antes);
  });

  it('un código que no existe se rechaza y no deja cuentas de sobra', async () => {
    const antes = await cuentasDeTablet();
    const r = await registrar('NOEXISTE', 'Tablet');
    expect(r).toEqual({ estado: 400, cuerpo: { error: 'CODE_INVALID' } });
    expect(await cuentasDeTablet()).toBe(antes);
  });

  it('un nombre en blanco se rechaza y no gasta el código', async () => {
    const codigo = await codigoNuevo();
    const antes = await cuentasDeTablet();
    const r = await registrar(codigo, '   ');
    expect(r).toEqual({ estado: 400, cuerpo: { error: 'INVALID_INPUT' } });
    expect(await cuentasDeTablet()).toBe(antes);
    expect((await registrar(codigo, 'Ahora sí')).estado).toBe(200);
  });

  it('un cuerpo mal formado se rechaza', async () => {
    const respuesta = await fetch(`${URL}/functions/v1/registrar-dispositivo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: ANON },
      body: '{no es json',
    });
    expect(respuesta.status).toBe(400);
  });

  it('al revocar la tablet, su sesión deja de leer los ajustes', async () => {
    const codigo = await codigoNuevo();
    const { cuerpo } = await registrar(codigo, 'Tablet por revocar');
    const sesion = cuerpo.sesion as { access_token: string; refresh_token: string };
    const tablet = crearCliente(ANON);
    await tablet.auth.setSession(sesion);
    expect(
      ((await tablet.from('business_settings').select('key')).data ?? []).length,
    ).toBeGreaterThan(0);

    const clienteAdmin = crearCliente(ANON);
    await supabaseAdminAuth(clienteAdmin).signIn(admin.email, admin.password);
    const id = (cuerpo.dispositivo as { id: string }).id;
    const { error } = await clienteAdmin.rpc('revoke_device', { p_device_id: id });
    expect(error).toBeNull();

    expect((await tablet.from('business_settings').select('key')).data ?? []).toHaveLength(0);
    // Pero se entera de que está revocada.
    const suRenglon = await tablet.from('devices').select('status');
    expect(suRenglon.data).toEqual([{ status: 'REVOKED' }]);
  });
});
