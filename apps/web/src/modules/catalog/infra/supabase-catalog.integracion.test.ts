import { createClient } from '@supabase/supabase-js';
import { asId, type CategoryId, type ProductId } from '@zammir/core';
import { catalogContract, productoDePrueba } from '@zammir/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { supabaseAdminAuth } from '../../identity/infra/supabase-admin-auth';
import { supabaseCatalog } from './supabase-catalog';

// Pruebas contra Supabase local real. Corren con `pnpm test:integracion`.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const sufijo = Math.random().toString(36).slice(2, 10);
const admin = { email: `cat-admin-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Admin1` };
const cajero = {
  email: `cat-cajero-${sufijo}@ejemplo.invalid`,
  password: `Clave-${sufijo}-Cajero1`,
};
const tablet = { email: `cat-tablet-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Tab1` };

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
function crearCliente(llave: string) {
  return createClient(URL, llave, opciones);
}

const cuentas: string[] = [];
const productosCreados: string[] = [];
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

async function catalogoComo(c: { email: string; password: string }) {
  const cliente = crearCliente(ANON);
  await supabaseAdminAuth(cliente).signIn(c.email, c.password);
  return supabaseCatalog(cliente);
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
      name: 'Tablet de catálogo',
      temp_series: 900 + Math.floor(Math.random() * 90_000),
      auth_user_id: idTablet,
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  tabletId = (data as { id: string }).id;
});

afterAll(async () => {
  // Los productos no se borran por la API; se limpian con la llave de servicio solo en pruebas.
  for (const id of productosCreados) {
    await servicio.from('products').delete().eq('id', id);
  }
  await servicio.from('devices').delete().eq('id', tabletId);
  for (const id of cuentas) {
    await servicio.auth.admin.deleteUser(id);
  }
});

let contador = 0;

// La misma batería que pasa el adaptador en memoria.
catalogContract('Supabase', async () => {
  const catalogo = await catalogoComo(admin);
  return {
    admin: {
      ...catalogo,
      create: async (producto) => {
        productosCreados.push(producto.id);
        return catalogo.create(producto);
      },
      get: (id) => catalogo.get(id),
      list: () => catalogo.list(),
    },
    reader: catalogo,
    categorias: catalogo,
    nuevoIdDeProducto: () => asId<'Product'>(crypto.randomUUID()),
    idDeCategoriaInexistente: asId<'Category'>(crypto.randomUUID()),
    codigoNuevo: () => {
      contador += 1;
      return `T-${sufijo}-${String(contador)}`;
    },
  };
});

describe('catálogo con Supabase y sus permisos', () => {
  async function primeraCategoria(): Promise<CategoryId> {
    const r = await (await catalogoComo(admin)).listCategories();
    if (!r.ok || r.value[0] === undefined) {
      throw new Error('sin categorías');
    }
    return r.value[0].id;
  }

  it('un cajero sin dispositivo no puede dar de alta ni leer productos', async () => {
    const comoCajero = await catalogoComo(cajero);
    const id = asId<'Product'>(crypto.randomUUID());
    const alta = await comoCajero.create(productoDePrueba(id, await primeraCategoria()));
    expect(!alta.ok && alta.error.code).toBe('NOT_AUTHORIZED');
    const lista = await comoCajero.listSellable();
    expect(lista.ok && lista.value).toEqual([]);
  });

  it('sin sesión no se puede dar de alta un producto', async () => {
    const sinSesion = supabaseCatalog(crearCliente(ANON));
    const id = asId<'Product'>(crypto.randomUUID());
    const alta = await sinSesion.create(productoDePrueba(id, await primeraCategoria()));
    expect(!alta.ok && alta.error.code).toBe('NOT_AUTHORIZED');
  });

  it('una tablet activa ve los productos activos para vender, pero no la tabla de administración', async () => {
    const comoAdmin = await catalogoComo(admin);
    const id: ProductId = asId<'Product'>(crypto.randomUUID());
    productosCreados.push(id);
    const creado = await comoAdmin.create(productoDePrueba(id, await primeraCategoria()));
    expect(creado.ok).toBe(true);

    const clienteTablet = crearCliente(ANON);
    await supabaseAdminAuth(clienteTablet).signIn(tablet.email, tablet.password);
    const comoTablet = supabaseCatalog(clienteTablet);

    const paraVender = await comoTablet.findSellable(id);
    expect(paraVender.ok).toBe(true);
    // La tabla de administración no se lee: ni datos fiscales ni inactivos.
    const lista = await comoTablet.list();
    expect(lista.ok && lista.value).toEqual([]);
    const categorias = await comoTablet.listCategories();
    expect(categorias.ok && categorias.value.length).toBeGreaterThanOrEqual(11);
  });

  it('una tablet no puede dar de alta productos', async () => {
    const clienteTablet = crearCliente(ANON);
    await supabaseAdminAuth(clienteTablet).signIn(tablet.email, tablet.password);
    const id = asId<'Product'>(crypto.randomUUID());
    const alta = await supabaseCatalog(clienteTablet).create(
      productoDePrueba(id, await primeraCategoria()),
    );
    expect(!alta.ok && alta.error.code).toBe('NOT_AUTHORIZED');
  });

  it('una tablet revocada deja de ver el catálogo para vender', async () => {
    await servicio
      .from('devices')
      .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
      .eq('id', tabletId);
    const clienteTablet = crearCliente(ANON);
    await supabaseAdminAuth(clienteTablet).signIn(tablet.email, tablet.password);
    const lista = await supabaseCatalog(clienteTablet).listSellable();
    expect(lista.ok && lista.value).toEqual([]);
    await servicio
      .from('devices')
      .update({ status: 'ACTIVE', revoked_at: null })
      .eq('id', tabletId);
  });
});
