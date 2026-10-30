import { createClient } from '@supabase/supabase-js';
import type { AuditEntry } from '@zammir/core';
import { auditLogContract, auditReaderContract, entradaDePrueba } from '@zammir/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { supabaseAdminAuth } from '../../identity/infra/supabase-admin-auth';
import { supabaseAuditLog } from './supabase-audit-log';
import { supabaseAuditReader } from './supabase-audit-reader';

// Pruebas contra Supabase local real. Corren con `pnpm test:integracion`.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const sufijo = Math.random().toString(36).slice(2, 10);
const admin = { email: `bit-admin-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Admin1` };
const cajero = {
  email: `bit-cajero-${sufijo}@ejemplo.invalid`,
  password: `Clave-${sufijo}-Cajero1`,
};

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
function crearCliente(llave: string) {
  return createClient(URL, llave, opciones);
}

function uuid(): string {
  return crypto.randomUUID();
}

const idsCreados: string[] = [];
let servicio: ReturnType<typeof crearCliente>;

async function bitacoraDeAdministrador() {
  const cliente = crearCliente(ANON);
  await supabaseAdminAuth(cliente).signIn(admin.email, admin.password);
  return supabaseAuditLog(cliente);
}

async function leerComoServicio(): Promise<readonly AuditEntry[]> {
  const { data, error } = await servicio.from('audit_log').select('*');
  expect(error).toBeNull();
  const filas = (data ?? []) as Record<string, unknown>[];
  return filas.map((fila) => ({
    id: fila.id as AuditEntry['id'],
    occurredAt: new Date(String(fila.occurred_at)),
    userId: fila.user_id as AuditEntry['userId'],
    deviceId: fila.device_id as AuditEntry['deviceId'],
    ...(fila.authorized_by === null
      ? {}
      : { authorizedBy: fila.authorized_by as AuditEntry['userId'] }),
    action: fila.action as AuditEntry['action'],
    entityType: String(fila.entity_type),
    entityId: String(fila.entity_id),
    oldValue: fila.old_value as AuditEntry['oldValue'],
    newValue: fila.new_value as AuditEntry['newValue'],
  }));
}

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

// La misma batería que pasa el adaptador en memoria. Los identificadores son UUID reales.
auditLogContract(
  'Supabase',
  async () => ({ log: await bitacoraDeAdministrador(), leer: leerComoServicio }),
  uuid,
);

// El lector (S1-19) con la sesión de un administrador: filtros, orden y paginación.
auditReaderContract(
  'Supabase',
  async () => {
    const cliente = crearCliente(ANON);
    await supabaseAdminAuth(cliente).signIn(admin.email, admin.password);
    return { log: supabaseAuditLog(cliente), reader: supabaseAuditReader(cliente) };
  },
  uuid,
);

describe('bitácora con Supabase y sus permisos', () => {
  it('un cajero sin dispositivo ve una bitácora vacía', async () => {
    const admin1 = crearCliente(ANON);
    await supabaseAdminAuth(admin1).signIn(admin.email, admin.password);
    const entidad = `visible-${uuid()}`;
    await supabaseAuditLog(admin1).append(entradaDePrueba(uuid(), { entityType: entidad }));

    const cliente = crearCliente(ANON);
    await supabaseAdminAuth(cliente).signIn(cajero.email, cajero.password);
    const r = await supabaseAuditReader(cliente).query({ entityType: entidad });
    expect(r.ok && r.value.entries).toEqual([]);
  });

  it('sin sesión no se lee la bitácora', async () => {
    const r = await supabaseAuditReader(crearCliente(ANON)).query({});
    expect(r.ok).toBe(false);
  });

  it('una cuenta de cajero sin sesión de dispositivo no puede agregar entradas', async () => {
    const cliente = crearCliente(ANON);
    await supabaseAdminAuth(cliente).signIn(cajero.email, cajero.password);
    const resultado = await supabaseAuditLog(cliente).append(entradaDePrueba(uuid()));
    expect(!resultado.ok && resultado.error.code).toBe('AUDIT_REJECTED');
  });

  it('sin sesión no se puede agregar', async () => {
    const resultado = await supabaseAuditLog(crearCliente(ANON)).append(entradaDePrueba(uuid()));
    expect(!resultado.ok && resultado.error.code).toBe('AUDIT_REJECTED');
  });

  it('un administrador no puede modificar ni borrar una entrada ya guardada', async () => {
    const id = uuid();
    const cliente = crearCliente(ANON);
    await supabaseAdminAuth(cliente).signIn(admin.email, admin.password);
    await supabaseAuditLog(cliente).append(entradaDePrueba(id));

    const cambio = await cliente.from('audit_log').update({ action: 'OTRA' }).eq('id', id);
    expect(cambio.error?.code).toBe('42501');
    const borrado = await cliente.from('audit_log').delete().eq('id', id);
    expect(borrado.error?.code).toBe('42501');

    const guardada = (await leerComoServicio()).find((e) => e.id === id);
    expect(guardada?.action).toBe('DEVICE_REGISTERED');
  });

  it('ni siquiera con la llave de servicio se puede modificar o borrar la bitácora', async () => {
    const id = uuid();
    const cliente = crearCliente(ANON);
    await supabaseAdminAuth(cliente).signIn(admin.email, admin.password);
    await supabaseAuditLog(cliente).append(entradaDePrueba(id));

    const cambio = await servicio.from('audit_log').update({ action: 'OTRA' }).eq('id', id);
    expect(cambio.error?.message).toContain('La bitácora no se modifica ni se borra');
    const borrado = await servicio.from('audit_log').delete().eq('id', id);
    expect(borrado.error?.message).toContain('La bitácora no se modifica ni se borra');
  });
});
