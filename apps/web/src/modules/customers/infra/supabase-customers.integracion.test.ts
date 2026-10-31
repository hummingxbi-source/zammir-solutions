import { createClient } from '@supabase/supabase-js';
import { asId, NO_FISCAL_PROFILE } from '@zammir/core';
import { clienteDePrueba, customerRepositoryContract } from '@zammir/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { supabaseAdminAuth } from '../../identity/infra/supabase-admin-auth';
import { supabaseCustomerReplica } from './supabase-customer-replica';
import { supabaseCustomers } from './supabase-customers';

// Pruebas contra Supabase local real. Corren con `pnpm test:integracion`.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const sufijo = Math.random().toString(36).slice(2, 10);
const admin = { email: `cli-admin-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Admin1` };
const cajero = {
  email: `cli-cajero-${sufijo}@ejemplo.invalid`,
  password: `Clave-${sufijo}-Cajero1`,
};
const tablet = { email: `cli-tablet-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Tab1` };

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
function crearCliente(llave: string) {
  return createClient(URL, llave, opciones);
}

const cuentas: string[] = [];
const clientesCreados: string[] = [];
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
      name: 'Tablet de clientes',
      temp_series: 300_000 + Math.floor(Math.random() * 600_000),
      auth_user_id: idTablet,
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  tabletId = (data as { id: string }).id;
});

afterAll(async () => {
  // Los clientes no se borran por la API; la limpieza usa la llave de servicio solo en pruebas.
  for (const id of clientesCreados) {
    await servicio.from('customers').delete().eq('id', id);
  }
  await servicio.from('devices').delete().eq('id', tabletId);
  for (const id of cuentas) {
    await servicio.auth.admin.deleteUser(id);
  }
});

let contador = 0;
const telefonoNuevo = () => {
  contador += 1;
  return String(5_400_000_000 + Math.floor(Math.random() * 90_000) * 1000 + (contador % 1000));
};

// La misma batería que pasa el adaptador en memoria (con la sesión de un administrador).
customerRepositoryContract('Supabase', async () => {
  const repo = supabaseCustomers(await clienteComo(admin), { conDatosFiscales: true });
  return {
    customers: {
      create: (c) => {
        clientesCreados.push(c.id);
        return repo.create(c);
      },
      update: (c) => repo.update(c),
      anonymize: (id) => repo.anonymize(id),
      get: (id) => repo.get(id),
      list: () => repo.list(),
      findByPhone: (t) => repo.findByPhone(t),
    },
    nuevoId: () => asId<'Customer'>(crypto.randomUUID()),
    telefonoNuevo,
    bitacoraDe: async (id) => {
      const { data, error } = await servicio
        .from('audit_log')
        .select('action, old_value, new_value, recorded_at')
        .eq('entity_id', id)
        .order('recorded_at');
      expect(error).toBeNull();
      return (data ?? []).map(
        (fila: { action: string; old_value: unknown; new_value: unknown }) => ({
          action: fila.action,
          oldValue: fila.old_value,
          newValue: fila.new_value,
        }),
      );
    },
  };
});

describe('clientes con Supabase y sus permisos', () => {
  it('la tablet ya no escribe en la tabla (los clientes entran por operación)', async () => {
    const comoTablet = supabaseCustomers(await clienteComo(tablet));
    const id = asId<'Customer'>(crypto.randomUUID());
    clientesCreados.push(id);
    const alta = await comoTablet.create(
      clienteDePrueba(id, telefonoNuevo(), {
        fiscal: NO_FISCAL_PROFILE,
        name: `Cliente de tablet ${sufijo}`,
      }),
    );
    expect(!alta.ok && alta.error.code).toBe('NOT_AUTHORIZED');
  });

  it('la réplica baja lo que cambió después del último número y no trae datos fiscales', async () => {
    const comoAdmin = supabaseCustomers(await clienteComo(admin), { conDatosFiscales: true });
    const id = asId<'Customer'>(crypto.randomUUID());
    clientesCreados.push(id);
    await comoAdmin.create(clienteDePrueba(id, telefonoNuevo()));

    const replica = supabaseCustomerReplica(await clienteComo(tablet));
    const primera = await replica.changedAfter(0, 5000);
    const mio = primera.ok ? primera.value.find((c) => c.id === id) : undefined;
    expect(mio).toBeDefined();
    expect(Object.keys(mio ?? {}).some((k) => k.startsWith('fiscal'))).toBe(false);

    const despues = await replica.changedAfter(mio?.changeSeq ?? 0, 5000);
    expect(despues.ok && despues.value.some((c) => c.id === id)).toBe(false);
  });

  it('la tablet no puede guardar datos fiscales', async () => {
    const comoTablet = supabaseCustomers(await clienteComo(tablet));
    const id = asId<'Customer'>(crypto.randomUUID());
    clientesCreados.push(id);
    const alta = await comoTablet.create(clienteDePrueba(id, telefonoNuevo()));
    expect(!alta.ok && alta.error.code).toBe('NOT_AUTHORIZED');
  });

  it('la tablet no ve los datos fiscales de un cliente que sí los tiene', async () => {
    const comoAdmin = supabaseCustomers(await clienteComo(admin), { conDatosFiscales: true });
    const id = asId<'Customer'>(crypto.randomUUID());
    clientesCreados.push(id);
    const completo = clienteDePrueba(id, telefonoNuevo());
    await comoAdmin.create(completo);

    const vistoPorLaTablet = await supabaseCustomers(await clienteComo(tablet)).get(id);
    expect(vistoPorLaTablet.ok && vistoPorLaTablet.value.fiscal).toEqual(NO_FISCAL_PROFILE);
    expect(vistoPorLaTablet.ok && vistoPorLaTablet.value.name).toBe(completo.name);
  });

  it('la tablet no corrige clientes (por ahora): queda igual', async () => {
    const comoAdmin = supabaseCustomers(await clienteComo(admin), { conDatosFiscales: true });
    const id = asId<'Customer'>(crypto.randomUUID());
    clientesCreados.push(id);
    const original = clienteDePrueba(id, telefonoNuevo());
    await comoAdmin.create(original);

    const intento = await supabaseCustomers(await clienteComo(tablet)).update({
      ...original,
      name: 'Cambiado por la tablet',
    });
    expect(intento.ok).toBe(false);
    const sigue = await comoAdmin.get(id);
    expect(sigue.ok && sigue.value.name).toBe(original.name);
  });

  it('un cajero sin dispositivo no ve ni crea clientes', async () => {
    const comoCajero = supabaseCustomers(await clienteComo(cajero));
    const lista = await comoCajero.list();
    expect(lista.ok && lista.value).toEqual([]);
    const id = asId<'Customer'>(crypto.randomUUID());
    clientesCreados.push(id);
    const alta = await comoCajero.create(
      clienteDePrueba(id, telefonoNuevo(), { fiscal: NO_FISCAL_PROFILE }),
    );
    expect(!alta.ok && alta.error.code).toBe('NOT_AUTHORIZED');
  });

  it('un cajero sin dispositivo y la tablet no pueden anonimizar', async () => {
    const comoAdmin = supabaseCustomers(await clienteComo(admin), { conDatosFiscales: true });
    const id = asId<'Customer'>(crypto.randomUUID());
    clientesCreados.push(id);
    const original = clienteDePrueba(id, telefonoNuevo());
    await comoAdmin.create(original);

    for (const cuenta of [cajero, tablet]) {
      const r = await supabaseCustomers(await clienteComo(cuenta)).anonymize(id);
      expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
    }
    const sigue = await comoAdmin.get(id);
    expect(sigue.ok && sigue.value.name).toBe(original.name);
  });

  it('nadie puede borrar un cliente, ni un administrador', async () => {
    const cliente = await clienteComo(admin);
    const repo = supabaseCustomers(cliente, { conDatosFiscales: true });
    const id = asId<'Customer'>(crypto.randomUUID());
    clientesCreados.push(id);
    await repo.create(clienteDePrueba(id, telefonoNuevo()));
    const borrado = await cliente.from('customers').delete().eq('id', id);
    expect(borrado.error?.code).toBe('42501');
    expect((await repo.get(id)).ok).toBe(true);
  });

  it('una tablet revocada deja de ver clientes', async () => {
    await servicio
      .from('devices')
      .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
      .eq('id', tabletId);
    const lista = await supabaseCustomers(await clienteComo(tablet)).list();
    expect(lista.ok && lista.value).toEqual([]);
    await servicio
      .from('devices')
      .update({ status: 'ACTIVE', revoked_at: null })
      .eq('id', tabletId);
  });
});
