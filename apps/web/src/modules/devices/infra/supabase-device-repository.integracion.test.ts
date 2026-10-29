import { createHash } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { asId, type DeviceId, type DeviceRepository } from '@zammir/core';
import { deviceRepositoryContract } from '@zammir/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { supabaseAdminAuth } from '../../identity/infra/supabase-admin-auth';
import { supabaseDeviceRepository } from './supabase-device-repository';

// Pruebas contra Supabase local real. Corren con `pnpm test:integracion`.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const sufijo = Math.random().toString(36).slice(2, 10);
const admin = { email: `disp-admin-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Admin1` };
const cajero = {
  email: `disp-cajero-${sufijo}@ejemplo.invalid`,
  password: `Clave-${sufijo}-Cajero1`,
};

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
function crearCliente(llave: string) {
  return createClient(URL, llave, opciones);
}

const cuentasCreadas: string[] = [];
let servicio: ReturnType<typeof crearCliente>;

async function crearCuenta(rol: string, correo: string, password: string): Promise<string> {
  const { data, error } = await servicio.auth.admin.createUser({
    email: correo,
    password,
    email_confirm: true,
    app_metadata: { rol },
  });
  expect(error).toBeNull();
  const id = data.user?.id ?? '';
  cuentasCreadas.push(id);
  return id;
}

async function repositorioDeAdministrador(): Promise<DeviceRepository> {
  const cliente = crearCliente(ANON);
  await supabaseAdminAuth(cliente).signIn(admin.email, admin.password);
  const comoAdmin = supabaseDeviceRepository(cliente);
  const comoServidor = supabaseDeviceRepository(servicio);
  // Generar, listar y revocar son del administrador; canjear es del servidor.
  return {
    issueCode: (minutos) => comoAdmin.issueCode(minutos),
    list: () => comoAdmin.list(),
    revoke: (id) => comoAdmin.revoke(id),
    redeemCode: (entrada) => comoServidor.redeemCode(entrada),
  };
}

beforeAll(async () => {
  expect(URL, 'faltan las variables: usa `pnpm test:integracion`').not.toBe('');
  servicio = crearCliente(SERVICIO);
  await crearCuenta('ADMIN', admin.email, admin.password);
  await crearCuenta('STAFF', cajero.email, cajero.password);
});

afterAll(async () => {
  for (const id of cuentasCreadas) {
    await servicio.auth.admin.deleteUser(id);
  }
});

// La misma batería que pasa el adaptador en memoria.
deviceRepositoryContract(
  'Supabase',
  async () => ({
    repo: await repositorioDeAdministrador(),
    vencerCodigo: async (code) => {
      const hash = createHash('sha256').update(code).digest('hex');
      const { error } = await servicio
        .from('device_registration_codes')
        .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
        .eq('code_hash', hash);
      expect(error).toBeNull();
    },
    nuevaCuenta: () =>
      crearCuenta(
        'DEVICE',
        `disp-tablet-${crypto.randomUUID()}@ejemplo.invalid`,
        `Clave-${sufijo}-Tab1`,
      ),
    bitacoraDe: async (id: DeviceId) => {
      const { data, error } = await servicio
        .from('audit_log')
        .select('action, occurred_at, recorded_at')
        .eq('entity_id', id)
        .order('recorded_at');
      expect(error).toBeNull();
      return (data ?? []).map((fila: { action: string }) => fila.action);
    },
  }),
  () => crypto.randomUUID(),
);

describe('dispositivos con Supabase y sus permisos', () => {
  it('un cajero no puede generar códigos ni revocar', async () => {
    const cliente = crearCliente(ANON);
    await supabaseAdminAuth(cliente).signIn(cajero.email, cajero.password);
    const repo = supabaseDeviceRepository(cliente);
    const generado = await repo.issueCode(15);
    expect(!generado.ok && generado.error.code).toBe('NOT_AUTHORIZED');
    const revocado = await repo.revoke(asId<'Device'>(crypto.randomUUID()));
    expect(!revocado.ok && revocado.error.code).toBe('NOT_AUTHORIZED');
  });

  it('sin sesión no se puede generar un código', async () => {
    const generado = await supabaseDeviceRepository(crearCliente(ANON)).issueCode(15);
    expect(!generado.ok && generado.error.code).toBe('NOT_AUTHORIZED');
  });

  it('con una sesión de usuario no se puede canjear un código: es del servidor', async () => {
    const cliente = crearCliente(ANON);
    await supabaseAdminAuth(cliente).signIn(admin.email, admin.password);
    const repo = supabaseDeviceRepository(cliente);
    const emitido = await repo.issueCode(15);
    if (!emitido.ok) {
      throw new Error('no se pudo emitir el código');
    }
    const canje = await repo.redeemCode({
      code: emitido.value.code,
      name: 'Tablet',
      authUserId: crypto.randomUUID(),
    });
    expect(!canje.ok && canje.error.code).toBe('NOT_AUTHORIZED');
  });
});
