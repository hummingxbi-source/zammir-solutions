import { createClient } from '@supabase/supabase-js';
import { legalRepositoryContract } from '@zammir/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { supabaseAdminAuth } from '../../identity/infra/supabase-admin-auth';
import { supabaseLegal } from './supabase-legal';

// Pruebas contra Supabase local real. Corren con `pnpm test:integracion`.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const sufijo = Math.random().toString(36).slice(2, 10);
const admin = { email: `leg-admin-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Admin1` };
const cajero = {
  email: `leg-cajero-${sufijo}@ejemplo.invalid`,
  password: `Clave-${sufijo}-Cajero1`,
};
const tablet = { email: `leg-tablet-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Tab1` };

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
function crearCliente(llave: string) {
  return createClient(URL, llave, opciones);
}

const cuentas: string[] = [];
let servicio: ReturnType<typeof crearCliente>;
let tabletId = '';

async function crearCuenta(rol: string, c: { email: string; password: string }): Promise<string> {
  const { data, error } = await servicio.auth.admin.createUser({
    email: c.email,
    password: c.password,
    email_confirm: true,
    app_metadata: { rol },
  });
  expect(error).toBeNull();
  const id = data.user?.id ?? '';
  cuentas.push(id);
  return id;
}

async function clienteComo(c: { email: string; password: string }) {
  const cliente = crearCliente(ANON);
  await supabaseAdminAuth(cliente).signIn(c.email, c.password);
  return cliente;
}

beforeAll(async () => {
  expect(URL, 'faltan las variables: usa `pnpm test:integracion`').not.toBe('');
  servicio = crearCliente(SERVICIO);
  await crearCuenta('ADMIN', admin);
  await crearCuenta('STAFF', cajero);
  const idTablet = await crearCuenta('DEVICE', tablet);
  const { data, error } = await servicio
    .from('devices')
    .insert({
      name: 'Tablet de documentos legales',
      temp_series: 400_000 + Math.floor(Math.random() * 500_000),
      auth_user_id: idTablet,
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  tabletId = (data as { id: string }).id;
});

afterAll(async () => {
  // Las versiones de documentos legales no se borran ni con la llave de servicio (es la regla);
  // lo que sí se limpia son las cuentas y la tablet de prueba.
  await servicio.from('devices').delete().eq('id', tabletId);
  for (const id of cuentas) {
    await servicio.auth.admin.deleteUser(id);
  }
});

// La misma batería que pasa el adaptador en memoria (con la sesión de un administrador).
legalRepositoryContract('Supabase', async () => ({
  legal: supabaseLegal(await clienteComo(admin)),
  bitacoraDe: async (id) => {
    const { data, error } = await servicio
      .from('audit_log')
      .select('action, old_value, new_value, recorded_at')
      .eq('entity_id', id)
      .order('recorded_at');
    expect(error).toBeNull();
    return (data ?? []).map((fila: { action: string; old_value: unknown; new_value: unknown }) => ({
      action: fila.action,
      oldValue: fila.old_value,
      newValue: fila.new_value,
    }));
  },
}));

describe('documentos legales con Supabase y sus permisos', () => {
  it('la base nace con el borrador del aviso de privacidad como versión 1', async () => {
    const r = await supabaseLegal(await clienteComo(admin)).list('PRIVACY_NOTICE');
    expect(r.ok && r.value[0]).toMatchObject({ version: 1 });
    expect(r.ok && r.value[0]?.body).toContain('BORRADOR');
  });

  it('la tablet lee el aviso pero no publica', async () => {
    const comoTablet = supabaseLegal(await clienteComo(tablet));
    const lista = await comoTablet.list('PRIVACY_NOTICE');
    expect(lista.ok && lista.value.length).toBeGreaterThanOrEqual(1);
    const intento = await comoTablet.publish({
      type: 'PRIVACY_NOTICE',
      body: 'Intento de la tablet',
      effectiveFrom: new Date('2026-11-01T00:00:00.000Z'),
    });
    expect(!intento.ok && intento.error.code).toBe('NOT_AUTHORIZED');
  });

  it('un cajero sin dispositivo no ve ni publica', async () => {
    const comoCajero = supabaseLegal(await clienteComo(cajero));
    const lista = await comoCajero.list('PRIVACY_NOTICE');
    expect(lista.ok && lista.value).toEqual([]);
    const intento = await comoCajero.publish({
      type: 'PRIVACY_NOTICE',
      body: 'Intento',
      effectiveFrom: new Date('2026-11-01T00:00:00.000Z'),
    });
    expect(!intento.ok && intento.error.code).toBe('NOT_AUTHORIZED');
  });

  it('nadie modifica ni borra una versión, ni siquiera un administrador', async () => {
    const cliente = await clienteComo(admin);
    const lista = await supabaseLegal(cliente).list('PRIVACY_NOTICE');
    const id = lista.ok ? lista.value[0]?.id : undefined;
    expect(id).toBeDefined();
    const cambio = await cliente
      .from('legal_documents')
      .update({ body: 'Cambiado' })
      .eq('id', id ?? '');
    expect(cambio.error?.code).toBe('42501');
    const borrado = await cliente
      .from('legal_documents')
      .delete()
      .eq('id', id ?? '');
    expect(borrado.error?.code).toBe('42501');
  });

  it('sin sesión no se ve nada', async () => {
    const r = await supabaseLegal(crearCliente(ANON)).list('PRIVACY_NOTICE');
    expect(r.ok).toBe(false);
  });
});
