import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

// E5 y E6 contra Supabase local real y las funciones de servidor, con el proveedor de timbrado simulado
// (facturas de prueba, sin validez fiscal) [S4-31, PRUEBAS_DE_ACEPTACION.md]. Corren con `pnpm test:integracion`.
//
//  E5 · Autofacturación: un folio liquidado genera su factura de prueba; uno ya facturado, uno fuera de plazo, uno
//       con saldo y uno con código incorrecto se rechazan con un mensaje claro; ningún rechazo deja un timbre.
//  E6 · Facturación por administrador: un cajero sin permiso no puede; un administrador sí.
//
// Contra el entorno de pruebas del proveedor real (PD-05) se repite cuando exista.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const crearCliente = (llave: string) => createClient(URL, llave, opciones);

const sufijo = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
const ID = (n: number): string =>
  `5e${sufijo.slice(0, 6)}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AHORA = new Date();
const MES_PASADO = new Date(AHORA.getTime() - 40 * 86_400_000);

const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function codigo(semilla: number): string {
  let n = semilla + Number.parseInt(sufijo.slice(0, 6), 16);
  let texto = '';
  for (let i = 0; i < 8; i += 1) {
    texto += LETRAS.charAt(n % LETRAS.length);
    n = Math.floor(n / LETRAS.length) + 13 * (i + 1);
  }
  return texto;
}

const serie = 400_000 + (Number.parseInt(sufijo.slice(0, 4), 16) % 200_000);
const folio = (n: number): string => `T${String(serie)}-${String(n).padStart(4, '0')}`;

// Los documentos de la prueba: lo que hay en el mostrador y en las órdenes.
const EN_PLAZO = { n: 10, folio: folio(1), code: codigo(1) };
const YA_FACTURADA = { n: 11, folio: folio(2), code: codigo(2) };
const FUERA_DE_PLAZO = { n: 12, folio: folio(3), code: codigo(3) };
const PARA_EL_CAJERO = { n: 13, folio: folio(4), code: codigo(4) };
const PARA_EL_ADMIN = { n: 14, folio: folio(5), code: codigo(5) };
const ORDEN_CON_SALDO = { n: 20, folio: folio(6), code: codigo(6) };

interface Respuesta {
  readonly estado: number;
  readonly cuerpo: Record<string, unknown>;
}

let ipDePrueba = 0;
async function portal(funcion: string, datos: Record<string, unknown>): Promise<Respuesta> {
  const ip = `198.51.100.${String(150 + (++ipDePrueba % 90))}`;
  const respuesta = await fetch(`${URL}/functions/v1/${funcion}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: ANON, 'x-forwarded-for': ip },
    body: JSON.stringify({ honeypot: '', elapsedMs: 10_000, ...datos }),
  });
  return { estado: respuesta.status, cuerpo: (await respuesta.json()) as Record<string, unknown> };
}

async function conSesion(
  funcion: string,
  datos: Record<string, unknown>,
  token: string | null,
): Promise<Respuesta> {
  const respuesta = await fetch(`${URL}/functions/v1/${funcion}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: ANON,
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(datos),
  });
  return { estado: respuesta.status, cuerpo: (await respuesta.json()) as Record<string, unknown> };
}

const receptor = {
  rfc: 'XAXX010101000',
  name: 'CLIENTE DE PRUEBA',
  fiscalZip: '55900',
  regime: '616',
  cfdiUse: 'S01',
};

const pedir = (v: { folio: string; code: string }, extra: Record<string, unknown> = {}) =>
  portal('solicitar-factura', {
    folio: v.folio,
    code: v.code,
    requestId: crypto.randomUUID(),
    acceptedPrivacy: true,
    recipient: receptor,
    ...extra,
  });

let servicio: ReturnType<typeof crearCliente>;
let tokenCajero = '';
let tokenAdmin = '';

async function entrar(rol: 'ADMIN' | 'STAFF'): Promise<string> {
  const correo = `e56-${rol.toLowerCase()}-${sufijo}@ejemplo.invalid`;
  const clave = `Clave-${sufijo}-${rol}5`;
  const creada = await servicio.auth.admin.createUser({
    email: correo,
    password: clave,
    email_confirm: true,
    app_metadata: { rol },
  });
  expect(creada.error, `cuenta ${rol}`).toBeNull();
  const sesion = await crearCliente(ANON).auth.signInWithPassword({
    email: correo,
    password: clave,
  });
  expect(sesion.error, `sesión ${rol}`).toBeNull();
  return sesion.data.session?.access_token ?? '';
}

async function crearVenta(
  v: { n: number; folio: string; code: string },
  cuando: Date,
  productoId: string,
): Promise<void> {
  const venta = await servicio.from('counter_sales').insert({
    id: ID(v.n),
    temp_folio: v.folio,
    public_code: v.code,
    issued_at: cuando.toISOString(),
    subtotal_cents: 10_000,
    tax_cents: 1_600,
    total_cents: 11_600,
    device_id: ID(1),
    user_id: ID(2),
    op_id: ID(100 + v.n),
  });
  expect(venta.error, `venta ${String(v.n)}`).toBeNull();
  const linea = await servicio.from('counter_sale_lines').insert({
    id: ID(200 + v.n),
    counter_sale_id: ID(v.n),
    position: 1,
    product_id: productoId,
    name: 'Chapa de prueba',
    charge_unit: 'PIECE',
    unit_price_cents: 11_600,
    rule_id: 'PIECE',
    quantity: 1,
    line_total_cents: 11_600,
    base_cents: 10_000,
    tax_cents: 1_600,
  });
  expect(linea.error, `línea ${String(v.n)}`).toBeNull();
  const pago = await servicio.from('payments').insert({
    id: ID(300 + v.n),
    group_id: ID(400 + v.n),
    counter_sale_id: ID(v.n),
    kind: 'SALE',
    method: 'CASH',
    amount_cents: 11_600,
    cash_received_cents: 11_600,
    change_cents: 0,
    user_id: ID(2),
    device_id: ID(1),
    paid_at: cuando.toISOString(),
    op_id: ID(500 + v.n),
  });
  expect(pago.error, `pago ${String(v.n)}`).toBeNull();
}

async function timbres(ids: number[]): Promise<number> {
  const r = await servicio
    .from('invoice_requests')
    .select('request_id', { count: 'exact', head: true })
    .in('counter_sale_id', ids.map(ID))
    .eq('status', 'STAMPED');
  return r.count ?? -1;
}

beforeAll(async () => {
  expect(URL, 'faltan las variables: usa `pnpm test:integracion`').not.toBe('');
  servicio = crearCliente(SERVICIO);
  tokenCajero = await entrar('STAFF');
  tokenAdmin = await entrar('ADMIN');

  const cuenta = await servicio.auth.admin.createUser({
    email: `e56-tablet-${sufijo}@ejemplo.invalid`,
    password: `Clave-${sufijo}-Tab5`,
    email_confirm: true,
    app_metadata: { rol: 'DEVICE' },
  });
  expect(cuenta.error, 'cuenta de la tablet').toBeNull();
  const dispositivo = await servicio.from('devices').insert({
    id: ID(1),
    name: 'Tablet de la aceptación E5 y E6',
    temp_series: 100_000 + (Number.parseInt(sufijo.slice(0, 5), 16) % 500_000),
    auth_user_id: cuenta.data.user?.id ?? null,
  });
  expect(dispositivo.error, 'dispositivo').toBeNull();

  const categoria = await servicio
    .from('product_categories')
    .select('id')
    .order('sort_order')
    .limit(1)
    .single();
  expect(categoria.error, 'categoría').toBeNull();
  const producto = await servicio.from('products').insert({
    id: ID(5),
    name: 'Producto de la aceptación',
    category_id: categoria.data?.id,
    kind: 'STANDARD',
    charge_unit: 'PIECE',
    list_price_cents: 11_600,
    rule_id: 'PIECE',
  });
  expect(producto.error, 'producto').toBeNull();

  await crearVenta(EN_PLAZO, AHORA, ID(5));
  await crearVenta(YA_FACTURADA, AHORA, ID(5));
  await crearVenta(FUERA_DE_PLAZO, MES_PASADO, ID(5));
  await crearVenta(PARA_EL_CAJERO, AHORA, ID(5));
  await crearVenta(PARA_EL_ADMIN, AHORA, ID(5));

  // Una venta que ya tiene su factura pedida.
  const yaFacturada = await servicio
    .from('invoice_requests')
    .insert({ request_id: ID(600), counter_sale_id: ID(YA_FACTURADA.n), channel: 'PORTAL' });
  expect(yaFacturada.error, 'factura ya pedida').toBeNull();

  // Una orden con saldo: todavía no se puede facturar.
  const cliente = await servicio
    .from('customers')
    .insert({ id: ID(3), name: 'Cliente de la aceptación', phone: '5512345678' });
  expect(cliente.error, 'cliente').toBeNull();
  const orden = await servicio.from('work_orders').insert({
    id: ID(ORDEN_CON_SALDO.n),
    temp_folio: ORDEN_CON_SALDO.folio,
    public_code: ORDEN_CON_SALDO.code,
    customer_id: ID(3),
    issued_at: AHORA.toISOString(),
    subtotal_cents: 86_207,
    tax_cents: 13_793,
    total_cents: 100_000,
    deposit_percent_bps: 5_000,
    deposit_required_cents: 50_000,
    device_id: ID(1),
    user_id: ID(2),
    op_id: ID(120),
  });
  expect(orden.error, 'orden').toBeNull();
  const anticipo = await servicio.from('payments').insert({
    id: ID(320),
    group_id: ID(420),
    work_order_id: ID(ORDEN_CON_SALDO.n),
    kind: 'DEPOSIT',
    method: 'TRANSFER',
    amount_cents: 30_000,
    user_id: ID(2),
    device_id: ID(1),
    paid_at: AHORA.toISOString(),
    op_id: ID(520),
  });
  expect(anticipo.error, 'anticipo').toBeNull();
});

describe('E5 · el cliente se factura solo con su folio y su código', () => {
  it('un folio liquidado y en plazo genera su factura de prueba, que se puede descargar', async () => {
    const consulta = await portal('consultar-factura', {
      folio: EN_PLAZO.folio,
      code: EN_PLAZO.code,
    });
    expect(consulta.estado).toBe(200);

    const r = await pedir(EN_PLAZO);
    expect(r.estado).toBe(200);
    const factura = r.cuerpo.invoice as { folio: string; uuid: string };
    expect(factura.folio).toMatch(/^F-\d{4}-\d{4,}$/);

    const xml = await portal('descargar-factura', {
      folio: EN_PLAZO.folio,
      code: EN_PLAZO.code,
      format: 'xml',
    });
    expect(xml.estado).toBe(200);
    expect(String(xml.cuerpo.content)).toContain(factura.uuid);
    const pdf = await portal('descargar-factura', {
      folio: EN_PLAZO.folio,
      code: EN_PLAZO.code,
      format: 'pdf',
    });
    expect(atob(String(pdf.cuerpo.content))).toContain('%PDF');
  });

  it('un folio ya facturado se rechaza diciendo por qué, y no se duplica el timbre', async () => {
    const otra = await pedir(EN_PLAZO);
    expect(otra.estado).toBe(409);
    expect(otra.cuerpo).toEqual({ error: 'NOT_ELIGIBLE', reason: 'ALREADY_INVOICED' });
    const guardada = await pedir(YA_FACTURADA);
    expect(guardada.cuerpo).toEqual({ error: 'NOT_ELIGIBLE', reason: 'ALREADY_INVOICED' });
    expect(await timbres([EN_PLAZO.n])).toBe(1);
  });

  it('un folio de un mes anterior (fuera de plazo) se rechaza diciendo por qué', async () => {
    const r = await pedir(FUERA_DE_PLAZO);
    expect(r.estado).toBe(409);
    expect(r.cuerpo).toEqual({ error: 'NOT_ELIGIBLE', reason: 'EXPIRED' });
    expect(await timbres([FUERA_DE_PLAZO.n])).toBe(0);
  });

  it('una orden con saldo todavía no se factura', async () => {
    const r = await pedir(ORDEN_CON_SALDO);
    expect(r.estado).toBe(409);
    expect(r.cuerpo).toEqual({ error: 'NOT_ELIGIBLE', reason: 'NOT_SETTLED' });
  });

  it('un código incorrecto responde igual que un folio que no existe: no revela nada', async () => {
    const malCodigo = await pedir({ folio: PARA_EL_CAJERO.folio, code: codigo(901) });
    const sinFolio = await pedir({ folio: folio(999_999), code: PARA_EL_CAJERO.code });
    expect(malCodigo.estado).toBe(404);
    expect(malCodigo.cuerpo).toEqual({ error: 'NOT_AVAILABLE' });
    expect(sinFolio.cuerpo).toEqual(malCodigo.cuerpo);
    expect(await timbres([PARA_EL_CAJERO.n])).toBe(0);
  });

  it('reenviar el mismo formulario devuelve la misma factura, sin un segundo timbre', async () => {
    const requestId = crypto.randomUUID();
    const a = await pedir(PARA_EL_ADMIN, { requestId });
    const b = await pedir(PARA_EL_ADMIN, { requestId });
    expect(a.estado).toBe(200);
    expect(b.cuerpo).toEqual(a.cuerpo);
    expect(await timbres([PARA_EL_ADMIN.n])).toBe(1);
  });
});

describe('E6 · facturar desde el sistema es solo de administradores', () => {
  const facturar = (n: number, token: string | null) =>
    conSesion(
      'facturar',
      {
        source: { type: 'COUNTER_SALE', id: ID(n) },
        requestId: crypto.randomUUID(),
        recipient: receptor,
      },
      token,
    );

  it('sin sesión no se factura', async () => {
    expect([401, 403]).toContain((await facturar(PARA_EL_CAJERO.n, null)).estado);
  });

  it('un cajero con sesión no puede facturar: no se emite nada', async () => {
    const r = await facturar(PARA_EL_CAJERO.n, tokenCajero);
    expect(r.estado).toBe(403);
    expect(await timbres([PARA_EL_CAJERO.n])).toBe(0);
  });

  it('un administrador sí: sale la factura de prueba, y una segunda vez no se duplica', async () => {
    const r = await facturar(PARA_EL_CAJERO.n, tokenAdmin);
    expect(r.estado).toBe(200);
    const factura = r.cuerpo.invoice as { folio: string };
    expect(factura.folio).toMatch(/^F-\d{4}-\d{4,}$/);
    const otra = await facturar(PARA_EL_CAJERO.n, tokenAdmin);
    expect(otra.estado).toBe(409);
    expect(await timbres([PARA_EL_CAJERO.n])).toBe(1);
  });

  it('el cajero no lee las facturas emitidas ni sus archivos; el administrador sí', async () => {
    const comoCajero = createClient(URL, ANON, {
      ...opciones,
      global: { headers: { Authorization: `Bearer ${tokenCajero}` } },
    });
    const delCajero = await comoCajero
      .from('invoice_requests')
      .select('request_id, xml, pdf_base64');
    expect(delCajero.error).toBeNull();
    expect(delCajero.data).toEqual([]);

    const comoAdmin = createClient(URL, ANON, {
      ...opciones,
      global: { headers: { Authorization: `Bearer ${tokenAdmin}` } },
    });
    const delAdmin = await comoAdmin.from('invoice_requests').select('request_id').limit(1);
    expect(delAdmin.error).toBeNull();
    expect((delAdmin.data ?? []).length).toBe(1);
  });
});
