import { createClient } from '@supabase/supabase-js';
import { inMemoryAdminAuth, signInAdmin, type AdminAuth } from '@zammir/core';
import { adminAuthContract } from '@zammir/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { supabaseSettingsRepository } from '../../settings/infra/supabase-settings-repository';
import { supabaseAdminAuth } from './supabase-admin-auth';

// Pruebas contra Supabase local real. Corren con `pnpm test:integracion`.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const sufijo = Math.random().toString(36).slice(2, 10);
const admin = { email: `admin-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Admin1` };
const cajero = { email: `cajero-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Cajero1` };

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
function crearCliente(llave: string) {
  return createClient(URL, llave, opciones);
}
function clienteNuevo() {
  return crearCliente(ANON);
}

const idsCreados: string[] = [];
let servicio: ReturnType<typeof crearCliente>;

beforeAll(async () => {
  expect(URL, 'faltan las variables: usa `pnpm test:integracion`').not.toBe('');
  servicio = crearCliente(SERVICIO);
  for (const [cuenta, rol] of [
    [admin, 'ADMIN'],
    [cajero, 'STAFF'],
  ] as const) {
    const { data, error } = await servicio.auth.admin.createUser({
      email: cuenta.email,
      password: cuenta.password,
      email_confirm: true,
      app_metadata: { rol },
    });
    expect(error).toBeNull();
    if (data.user !== null) {
      idsCreados.push(data.user.id);
    }
  }
});

afterAll(async () => {
  for (const id of idsCreados) {
    await servicio.auth.admin.deleteUser(id);
  }
});

// La misma batería que pasa el adaptador en memoria.
adminAuthContract('Supabase', () => supabaseAdminAuth(clienteNuevo()), { admin, cajero });

describe('entrada de administradores con Supabase', () => {
  it('un administrador con credenciales válidas abre la sesión', async () => {
    const auth = supabaseAdminAuth(clienteNuevo());
    const resultado = await signInAdmin(auth, admin.email, admin.password);
    expect(resultado.ok && resultado.value.role).toBe('ADMIN');
  });

  it('una cuenta de cajero no entra como administrador y su sesión se cierra', async () => {
    const auth: AdminAuth = supabaseAdminAuth(clienteNuevo());
    const resultado = await signInAdmin(auth, cajero.email, cajero.password);
    expect(!resultado.ok && resultado.error.code).toBe('NOT_AN_ADMIN');
    expect(await auth.currentUser()).toBeNull();
  });

  it('el adaptador en memoria y el real dan el mismo rol para las mismas cuentas', async () => {
    const memoria = inMemoryAdminAuth([{ userId: 'x', ...admin, role: 'ADMIN' }]);
    const real = supabaseAdminAuth(clienteNuevo());
    const a = await memoria.signIn(admin.email, admin.password);
    const b = await real.signIn(admin.email, admin.password);
    expect(a.ok && a.value.role).toBe(b.ok && b.value.role);
  });
});

describe('ajustes del negocio con Supabase', () => {
  it('un administrador con sesión lee los ajustes y son válidos', async () => {
    const cliente = clienteNuevo();
    await supabaseAdminAuth(cliente).signIn(admin.email, admin.password);
    const resultado = await supabaseSettingsRepository(cliente).load();
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.value.tax_rate_bps).toBe(1600);
      expect(resultado.value.feature_p1).toBe(false);
    }
  });

  it('sin sesión no se pueden leer', async () => {
    const resultado = await supabaseSettingsRepository(clienteNuevo()).load();
    expect(!resultado.ok && resultado.error.code).toBe('SETTINGS_UNAVAILABLE');
  });

  it('una cuenta de cajero con sesión no ve los ajustes', async () => {
    const cliente = clienteNuevo();
    await supabaseAdminAuth(cliente).signIn(cajero.email, cajero.password);
    const resultado = await supabaseSettingsRepository(cliente).load();
    expect(resultado.ok).toBe(false);
  });
});
