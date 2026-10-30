import { createClient } from '@supabase/supabase-js';
import {
  asId,
  inMemoryLoginStore,
  inMemoryPinAttemptGuard,
  refreshLogin,
  signInWithPin,
} from '@zammir/core';
import { userRepositoryContract, usuarioDePrueba } from '@zammir/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { webCryptoPinHasher } from '../../../shared/infra/web-crypto-pin-hasher';
import { supabaseAdminAuth } from './supabase-admin-auth';
import { supabaseLoginSource } from './supabase-login-source';
import { supabaseUsers } from './supabase-users';

// Pruebas contra Supabase local real. Corren con `pnpm test:integracion`.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const sufijo = Math.random().toString(36).slice(2, 10);
const admin = { email: `usr-admin-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Admin1` };
const cajero = {
  email: `usr-cajero-${sufijo}@ejemplo.invalid`,
  password: `Clave-${sufijo}-Cajero1`,
};
const tablet = { email: `usr-tablet-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Tab1` };

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
      name: 'Tablet de usuarios',
      temp_series: 100_000 + Math.floor(Math.random() * 800_000),
      auth_user_id: idTablet,
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  tabletId = (data as { id: string }).id;
});

afterAll(async () => {
  // Los usuarios no se borran por la API; la limpieza usa la llave de servicio solo en pruebas.
  await servicio.from('app_users').delete().like('name', `%${sufijo}%`);
  await servicio.from('devices').delete().eq('id', tabletId);
  for (const id of cuentas) {
    await servicio.auth.admin.deleteUser(id);
  }
});

let contador = 0;

// La misma batería que pasa el adaptador en memoria.
userRepositoryContract('Supabase', async () => ({
  users: supabaseUsers(await clienteComo(admin)),
  nuevoId: () => asId<'User'>(crypto.randomUUID()),
  nombreNuevo: () => {
    contador += 1;
    return `Persona ${sufijo} ${String(contador)}`;
  },
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

describe('usuarios con Supabase y sus permisos', () => {
  async function conUsuario(nombre: string) {
    const usuario = usuarioDePrueba(asId<'User'>(crypto.randomUUID()), `${nombre} ${sufijo}`);
    const r = await supabaseUsers(await clienteComo(admin)).create(usuario);
    expect(r.ok).toBe(true);
    return usuario;
  }

  it('un cajero sin dispositivo no puede dar de alta, leer ni editar usuarios', async () => {
    const existente = await conUsuario('Existente');
    const comoCajero = supabaseUsers(await clienteComo(cajero));
    const alta = await comoCajero.create(
      usuarioDePrueba(asId<'User'>(crypto.randomUUID()), `Intruso ${sufijo}`),
    );
    expect(!alta.ok && alta.error.code).toBe('NOT_AUTHORIZED');
    const lista = await comoCajero.list();
    expect(lista.ok && lista.value).toEqual([]);
    const edicion = await comoCajero.update({ ...existente, role: 'ADMIN' });
    expect(edicion.ok).toBe(false);
    const sigue = await supabaseUsers(await clienteComo(admin)).get(existente.id);
    expect(sigue.ok && sigue.value.role).toBe('STAFF');
  });

  it('una tablet activa lee la vista de usuarios para entrar, pero no la tabla ni puede escribir', async () => {
    const usuario = await conUsuario('Visible');
    const comoTablet = await clienteComo(tablet);

    const tabla = await supabaseUsers(comoTablet).list();
    expect(tabla.ok && tabla.value).toEqual([]);

    const vista = await comoTablet.from('login_users').select('id, name, pin_iterations, pin_hash');
    expect(vista.error).toBeNull();
    const fila = (vista.data ?? []).find((f: { id: string }) => f.id === usuario.id);
    expect(fila).toBeDefined();

    const alta = await supabaseUsers(comoTablet).create(
      usuarioDePrueba(asId<'User'>(crypto.randomUUID()), `Desde tablet ${sufijo}`),
    );
    expect(!alta.ok && alta.error.code).toBe('NOT_AUTHORIZED');
  });

  it('nadie puede borrar un usuario, ni un administrador', async () => {
    const usuario = await conUsuario('Permanente');
    const cliente = await clienteComo(admin);
    const borrado = await cliente.from('app_users').delete().eq('id', usuario.id);
    expect(borrado.error?.code).toBe('42501');
    const sigue = await supabaseUsers(cliente).get(usuario.id);
    expect(sigue.ok).toBe(true);
  });

  it('sin sesión no se ve nada', async () => {
    const vista = await crearCliente(ANON).from('login_users').select('id');
    expect(vista.error?.code).toBe('42501');
  });

  it('una tablet revocada deja de ver la vista de usuarios', async () => {
    await servicio
      .from('devices')
      .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
      .eq('id', tabletId);
    const comoTablet = await clienteComo(tablet);
    const vista = await comoTablet.from('login_users').select('id');
    expect(vista.data).toEqual([]);
    await servicio
      .from('devices')
      .update({ status: 'ACTIVE', revoked_at: null })
      .eq('id', tabletId);
  });
});

describe('entrada con PIN en la tablet, con Supabase real', () => {
  it('baja las personas, deja entrar con el PIN correcto y saca a quien se desactivó', async () => {
    const comoAdmin = supabaseUsers(await clienteComo(admin));
    const persona = {
      ...usuarioDePrueba(asId<'User'>(crypto.randomUUID()), `Entrada ${sufijo}`),
      pin: await webCryptoPinHasher.hash('482915', 1000),
    };
    expect((await comoAdmin.create(persona)).ok).toBe(true);

    const store = inMemoryLoginStore();
    const fuente = supabaseLoginSource(await clienteComo(tablet));
    const bajada = await refreshLogin({ source: fuente, store });
    expect(bajada.ok).toBe(true);
    const copia = await store.load();
    expect(copia?.users.some((u) => u.id === persona.id)).toBe(true);
    expect(copia?.lockout).toEqual({ maxAttempts: 5, baseSeconds: 30, capSeconds: 900 });
    expect(copia?.idleLockMinutes).toBe(5);

    const deps = {
      store,
      hasher: webCryptoPinHasher,
      guard: inMemoryPinAttemptGuard({ now: () => new Date() }, copia?.lockout ?? null),
      deviceReady: () => Promise.resolve(true),
    };
    const bien = await signInWithPin(deps, { userId: persona.id, pin: '482915' });
    expect(bien.ok && bien.value.name).toBe(persona.name);
    const mal = await signInWithPin(deps, { userId: persona.id, pin: '482916' });
    expect(!mal.ok && mal.error.code).toBe('AUTH_FAILED');

    expect((await comoAdmin.update({ ...persona, isActive: false })).ok).toBe(true);
    await refreshLogin({ source: fuente, store });
    const fuera = await signInWithPin(deps, { userId: persona.id, pin: '482915' });
    expect(!fuera.ok && fuera.error.code).toBe('AUTH_FAILED');
  });

  it('un cajero sin tablet no baja las personas', async () => {
    const r = await supabaseLoginSource(await clienteComo(cajero)).load();
    // Sin tablet activa la base no entrega ni las personas ni los ajustes: no hay nada que guardar.
    expect(r.ok).toBe(false);
  });
});
