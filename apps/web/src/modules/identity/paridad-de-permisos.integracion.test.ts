import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { asId, defaultPermissionPolicy, isPermitted, type Permission } from '@zammir/core';
import { productoDePrueba, usuarioDePrueba } from '@zammir/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { supabaseCatalog } from '../catalog/infra/supabase-catalog';
import { supabaseDeviceRepository } from '../devices/infra/supabase-device-repository';
import { supabaseAdminAuth } from './infra/supabase-admin-auth';
import { supabaseUsers } from './infra/supabase-users';

// PARIDAD ENTRE EL DOMINIO Y LA BASE [S1-18]: para cada permiso cuya tabla o función ya existe,
// se intenta la acción con cada rol y la base debe responder lo mismo que `PermissionPolicy`.
// Las sesiones de la base son tres: administrador (Auth), cuenta de cajero sin dispositivo y la
// sesión de la tablet. La tablet es quien actúa a nombre del cajero con PIN; por eso, todo lo que el
// cajero no puede, la base también se lo niega a la tablet.
//
// Estas pruebas corren con `pnpm test:integracion`.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

/** Qué permisos ya se prueban contra la base y cuáles esperan a la tabla que los implementa. */
const PARIDAD: Readonly<Record<Permission, string>> = {
  QUOTE_CREATE: 'pendiente: cotizaciones (Sprint 2)',
  PRICE_OVERRIDE: 'pendiente: líneas de cotización (Sprint 2)',
  CATALOG_EDIT: 'probada',
  SALE_REGISTER: 'pendiente: ventas y pagos (Sprint 3)',
  ORDER_ADVANCE: 'pendiente: órdenes (Sprint 3)',
  ORDER_DELIVER_WITH_BALANCE: 'pendiente: órdenes (Sprint 3)',
  CANCEL_SALE_OR_ORDER: 'pendiente: ventas y órdenes (Sprint 3)',
  OWN_CASH_CLOSE: 'pendiente: turnos de caja (Sprint 3)',
  OTHERS_CASH_VIEW: 'pendiente: turnos de caja (Sprint 3)',
  REPORTS_AND_RECEIVABLES: 'pendiente: reportes (Sprint 4)',
  INVOICE_GENERATE: 'pendiente: facturas (Sprint 4)',
  USERS_AND_DEVICES: 'probada',
  PRIVACY_NOTICE_EDIT: 'pendiente: legal_documents (S1-13)',
};

const sufijo = Math.random().toString(36).slice(2, 10);
const cuentas = {
  ADMIN: { email: `par-admin-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Admin1` },
  STAFF: { email: `par-cajero-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Cajero1` },
  DEVICE: { email: `par-tablet-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Tab1` },
} as const;

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
function crearCliente(llave: string) {
  return createClient(URL, llave, opciones);
}

const idsDeCuentas: string[] = [];
const productosCreados: string[] = [];
let servicio: SupabaseClient;
let tabletId = '';
let categoriaId = '';
const clientes = {} as Record<'ADMIN' | 'STAFF' | 'DEVICE', SupabaseClient>;

async function iniciarSesion(rol: 'ADMIN' | 'STAFF' | 'DEVICE'): Promise<SupabaseClient> {
  const cliente = crearCliente(ANON);
  await supabaseAdminAuth(cliente).signIn(cuentas[rol].email, cuentas[rol].password);
  return cliente;
}

beforeAll(async () => {
  expect(URL, 'faltan las variables: usa `pnpm test:integracion`').not.toBe('');
  servicio = crearCliente(SERVICIO);
  for (const rol of ['ADMIN', 'STAFF', 'DEVICE'] as const) {
    const { data, error } = await servicio.auth.admin.createUser({
      email: cuentas[rol].email,
      password: cuentas[rol].password,
      email_confirm: true,
      app_metadata: { rol },
    });
    expect(error).toBeNull();
    idsDeCuentas.push(data.user?.id ?? '');
  }
  const idTablet = idsDeCuentas[2] ?? '';
  const registro = await servicio
    .from('devices')
    .insert({
      name: 'Tablet de paridad',
      temp_series: 200_000 + Math.floor(Math.random() * 700_000),
      auth_user_id: idTablet,
    })
    .select('id')
    .single();
  expect(registro.error).toBeNull();
  tabletId = (registro.data as { id: string }).id;

  const categorias = await servicio
    .from('product_categories')
    .select('id')
    .order('sort_order')
    .limit(1);
  categoriaId = (categorias.data as { id: string }[])[0]?.id ?? '';

  for (const rol of ['ADMIN', 'STAFF', 'DEVICE'] as const) {
    clientes[rol] = await iniciarSesion(rol);
  }
});

afterAll(async () => {
  for (const id of productosCreados) {
    await servicio.from('products').delete().eq('id', id);
  }
  await servicio.from('app_users').delete().like('name', `%${sufijo}%`);
  await servicio.from('devices').delete().eq('id', tabletId);
  for (const id of idsDeCuentas) {
    await servicio.auth.admin.deleteUser(id);
  }
});

/** Intenta la acción con una sesión y dice si la base la aceptó. */
type Sonda = (cliente: SupabaseClient) => Promise<boolean>;

const SONDAS: Partial<Record<Permission, Record<string, Sonda>>> = {
  CATALOG_EDIT: {
    'dar de alta un producto': async (cliente) => {
      const id = asId<'Product'>(crypto.randomUUID());
      productosCreados.push(id);
      const r = await supabaseCatalog(cliente).create(
        productoDePrueba(id, asId<'Category'>(categoriaId)),
      );
      return r.ok;
    },
    'cambiar el precio de un producto': async (cliente) => {
      // Un producto existente, creado con la llave de servicio para que todos intenten editar el mismo.
      const id = crypto.randomUUID();
      productosCreados.push(id);
      const base = productoDePrueba(asId<'Product'>(id), asId<'Category'>(categoriaId));
      const alta = await servicio.from('products').insert({
        id,
        name: `Producto de paridad ${sufijo}`,
        category_id: categoriaId,
        kind: base.kind,
        charge_unit: base.chargeUnit,
        list_price_cents: 10_000,
        rule_id: 'AREA',
        rule_params: {},
      });
      expect(alta.error).toBeNull();
      const r = await supabaseCatalog(cliente).update({ ...base, name: `Cambiado ${sufijo}` });
      return r.ok;
    },
  },
  USERS_AND_DEVICES: {
    'dar de alta una persona': async (cliente) => {
      const r = await supabaseUsers(cliente).create(
        usuarioDePrueba(
          asId<'User'>(crypto.randomUUID()),
          `Persona ${sufijo} ${crypto.randomUUID()}`,
        ),
      );
      return r.ok;
    },
    'generar un código de registro de tablet': async (cliente) =>
      (await supabaseDeviceRepository(cliente).issueCode(15)).ok,
    'listar los dispositivos': async (cliente) =>
      (await supabaseDeviceRepository(cliente).list()).ok,
  },
};

describe('paridad entre la política del dominio y la base', () => {
  it('cada permiso está clasificado: probado contra la base o con su pendiente', () => {
    for (const [permiso, estado] of Object.entries(PARIDAD)) {
      if (estado === 'probada') {
        expect(Object.keys(SONDAS[permiso as Permission] ?? {}).length).toBeGreaterThan(0);
      } else {
        expect(estado).toMatch(/^pendiente: /);
      }
    }
  });

  const probadas = (Object.keys(PARIDAD) as Permission[]).filter((p) => PARIDAD[p] === 'probada');

  describe.each(probadas)('%s', (permiso) => {
    const sondas = Object.entries(SONDAS[permiso] ?? {});

    describe.each(sondas)('%s', (_nombre, sonda) => {
      it.each(['ADMIN', 'STAFF', 'DEVICE'] as const)('rol %s', async (rol) => {
        const esperado = isPermitted(defaultPermissionPolicy.check(rol, permiso));
        const aceptada = await sonda(clientes[rol]);
        expect(aceptada).toBe(esperado);
      });
    });
  });
});
