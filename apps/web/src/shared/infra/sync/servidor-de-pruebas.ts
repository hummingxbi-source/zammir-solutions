import { createClient } from '@supabase/supabase-js';
import { asId } from '@zammir/core';
import {
  clienteDePrueba,
  codigoPublicoDePrueba,
  usuarioDePrueba,
  type DispositivoDelContrato,
  type ReceptorDelContrato,
} from '@zammir/core/testing';
import { afterAll, beforeAll, expect } from 'vitest';

import { supabaseCustomers } from '../../../modules/customers/infra/supabase-customers';
import { supabaseAdminAuth } from '../../../modules/identity/infra/supabase-admin-auth';
import { supabaseUsers } from '../../../modules/identity/infra/supabase-users';
import { functionOperationReceiver } from './function-operation-receiver';

// Servidor local real para las pruebas de operaciones: función de borde `recibir-operacion` +
// `receive_operation` en Postgres. Quien lo importa llama a `servidorDePruebas()` en el cuerpo del archivo.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const sufijo = Math.random().toString(36).slice(2, 10);
const admin = { email: `ops-admin-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Admin1` };
const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const crearCliente = (llave: string) => createClient(URL, llave, opciones);

let servicio: ReturnType<typeof crearCliente>;
const cuentas: string[] = [];
let adminId = '';

async function clienteAdmin() {
  const cliente = crearCliente(ANON);
  await supabaseAdminAuth(cliente).signIn(admin.email, admin.password);
  return cliente;
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
  adminId = data.user?.id ?? '';
  cuentas.push(adminId);
});

afterAll(async () => {
  // Las operaciones, cotizaciones, usuarios y tablets no se borran (solo se agregan); cada corrida usa
  // años, códigos y series propios. Se retiran únicamente las cuentas de acceso.
  for (const id of cuentas) {
    await servicio.auth.admin.deleteUser(id);
  }
});

let contador = Math.floor(Math.random() * 900_000) * 1000;
let anio = 0;
const aniosUsados = new Set<number>();

export async function nuevoDispositivo(fetchImpl?: typeof fetch): Promise<DispositivoDelContrato> {
  const correo = `ops-tablet-${crypto.randomUUID()}@dispositivos.zammir.invalid`;
  const clave = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const creada = await servicio.auth.admin.createUser({
    email: correo,
    password: clave,
    email_confirm: true,
    app_metadata: { rol: 'DEVICE' },
  });
  expect(creada.error).toBeNull();
  const cuentaId = creada.data.user?.id ?? '';
  cuentas.push(cuentaId);
  const { data, error } = await servicio
    .from('devices')
    .insert({
      name: 'Tablet de operaciones',
      temp_series: 1_000_000 + Math.floor(Math.random() * 8_000_000),
      auth_user_id: cuentaId,
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  const id = (data as { id: string }).id;
  const sesion = crearCliente(ANON);
  const entrada = await sesion.auth.signInWithPassword({ email: correo, password: clave });
  expect(entrada.error).toBeNull();
  return {
    id,
    receiver: functionOperationReceiver({
      url: URL,
      anonKey: ANON,
      accessToken: () => sesion.auth.getSession().then((s) => s.data.session?.access_token ?? ''),
      ...(fetchImpl === undefined ? {} : { fetchImpl }),
    }),
  };
}

export const harness: ReceptorDelContrato & {
  auditFor(entityId: string): Promise<Record<string, unknown>[]>;
} = {
  /** Entradas de bitácora de una entidad (lectura independiente con la llave de servicio). */
  async auditFor(entityId) {
    const { data, error } = await servicio.from('audit_log').select('*').eq('entity_id', entityId);
    expect(error).toBeNull();
    return (data ?? []) as Record<string, unknown>[];
  },

  newDevice: () => nuevoDispositivo(),
  async newUser(activa, administrador = false) {
    const id = asId<'User'>(crypto.randomUUID());
    const usuarios = supabaseUsers(await clienteAdmin());
    const r = await usuarios.create(
      usuarioDePrueba(id, `Persona ${sufijo} ${id.slice(0, 8)}`, administrador ? { role: 'ADMIN' } : {}),
    );
    expect(r.ok).toBe(true);
    if (!activa) {
      const baja = await usuarios.update({
        ...usuarioDePrueba(id, `Persona ${sufijo} ${id.slice(0, 8)}`),
        isActive: false,
      });
      expect(baja.ok).toBe(true);
    }
    return id;
  },
  async newCustomer() {
    const id = asId<'Customer'>(crypto.randomUUID());
    contador += 1;
    const telefono = `55${String(10_000_000 + (contador % 89_999_999))}`;
    const r = await supabaseCustomers(await clienteAdmin(), { conDatosFiscales: true }).create(
      clienteDePrueba(id, telefono),
    );
    expect(r.ok).toBe(true);
    return id;
  },
  async orderState(id) {
    const { data } = await servicio
      .from('work_orders')
      .select('status, folio')
      .eq('id', id)
      .limit(1);
    const fila = data?.[0] as { readonly status: string; readonly folio: string } | undefined;
    if (fila === undefined) {
      return undefined;
    }
    const pagos = await servicio.from('payments').select('amount_cents').eq('work_order_id', id);
    const pagado = ((pagos.data ?? []) as { readonly amount_cents: number }[]).reduce(
      (suma, p) => suma + Number(p.amount_cents),
      0,
    );
    return { status: fila.status, folio: fila.folio, paidCents: pagado };
  },
  async customerName(id) {
    const { data } = await servicio.from('customers').select('name').eq('id', id).limit(1);
    return (data?.[0] as { readonly name: string } | undefined)?.name;
  },
  async revokeDevice(id) {
    await servicio
      .from('devices')
      .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
      .eq('id', id);
  },
  newUuid: () => crypto.randomUUID(),
  newPublicCode: () => {
    contador += 1;
    return codigoPublicoDePrueba(contador);
  },
  // Un año cuyo contador de folios nadie haya tocado: otras pruebas (otros procesos) comparten el
  // servidor y sus contadores no se pueden borrar.
  async newYear() {
    for (let intento = 0; intento < 200; intento += 1) {
      anio = 2100 + Math.floor(Math.random() * 6800);
      if (aniosUsados.has(anio)) {
        continue;
      }
      const { data } = await servicio
        .from('folio_counters')
        .select('year')
        .eq('year', anio)
        .limit(1);
      if ((data ?? []).length === 0) {
        aniosUsados.add(anio);
        return anio;
      }
    }
    throw new Error('no se encontró un año libre para la prueba');
  },
  async countsFor(ids) {
    const q = await servicio
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .in('device_id', [...ids]);
    const o = await servicio
      .from('operations')
      .select('op_id', { count: 'exact', head: true })
      .in('device_id', [...ids]);
    return { quotes: q.count ?? 0, operations: o.count ?? 0 };
  },
};
