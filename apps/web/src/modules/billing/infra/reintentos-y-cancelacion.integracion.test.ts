import { createClient } from '@supabase/supabase-js';
import { SOLICITUD_DE_PRUEBA } from '@zammir/core/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Pruebas contra Supabase local real y las funciones `reintentar-facturas`, `cancelar-factura` y `facturar`
// [S4-20, S4-21, S4-22]. Corren con `pnpm test:integracion`, que enciende las funciones con el proveedor simulado.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const crearCliente = (llave: string) => createClient(URL, llave, opciones);

const sufijo = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
const ID = (n: number): string =>
  `5d${sufijo.slice(0, 6)}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AHORA = new Date();
const serie = 500_000 + (Number.parseInt(sufijo.slice(0, 4), 16) % 300_000);
const folioTemporal = (n: number): string => `T${String(serie)}-${String(n).padStart(4, '0')}`;

const receptor = {
  rfc: 'XAXX010101000',
  name: 'CLIENTE DE PRUEBA',
  fiscalZip: '55900',
  regime: '616',
  cfdiUse: 'G03',
};

interface Respuesta {
  readonly estado: number;
  readonly cuerpo: Record<string, unknown>;
}

let servicio: ReturnType<typeof crearCliente>;
let tokenAdmin = '';
let tokenCajero = '';
let idAdmin = '';

async function entrar(rol: 'ADMIN' | 'STAFF'): Promise<{ token: string; id: string }> {
  const correo = `rc-${rol.toLowerCase()}-${sufijo}@ejemplo.invalid`;
  const clave = `Clave-${sufijo}-${rol}1`;
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
  return { token: sesion.data.session?.access_token ?? '', id: creada.data.user?.id ?? '' };
}

async function llamar(
  funcion: string,
  datos: Record<string, unknown>,
  token: string | null = tokenAdmin,
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

const facturar = (tipo: 'COUNTER_SALE' | 'WORK_ORDER', id: string) =>
  llamar('facturar', {
    source: { type: tipo, id },
    requestId: crypto.randomUUID(),
    recipient: receptor,
  });

async function crearVenta(n: number, productoId: string): Promise<void> {
  const v = await servicio.from('counter_sales').insert({
    id: ID(n),
    temp_folio: folioTemporal(n),
    public_code: `${String.fromCharCode(65 + (n % 20))}${sufijo.slice(0, 6).toUpperCase().replace(/[01]/g, '2')}R`,
    issued_at: AHORA.toISOString(),
    subtotal_cents: 10_000,
    tax_cents: 1_600,
    total_cents: 11_600,
    customer_id: ID(3),
    device_id: ID(1),
    user_id: ID(2),
    op_id: ID(100 + n),
  });
  expect(v.error, `venta ${String(n)}`).toBeNull();
  const l = await servicio.from('counter_sale_lines').insert({
    id: ID(200 + n),
    counter_sale_id: ID(n),
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
  expect(l.error, `línea ${String(n)}`).toBeNull();
  const p = await servicio.from('payments').insert({
    id: ID(300 + n),
    group_id: ID(400 + n),
    counter_sale_id: ID(n),
    kind: 'SALE',
    method: 'TRANSFER',
    amount_cents: 11_600,
    user_id: ID(2),
    device_id: ID(1),
    paid_at: AHORA.toISOString(),
    op_id: ID(500 + n),
  });
  expect(p.error, `pago ${String(n)}`).toBeNull();
}

async function crearOrden(n: number, productoId: string): Promise<void> {
  const o = await servicio.from('work_orders').insert({
    id: ID(n),
    temp_folio: folioTemporal(n),
    public_code: `${String.fromCharCode(65 + (n % 20))}${sufijo.slice(0, 6).toUpperCase().replace(/[01]/g, '2')}S`,
    customer_id: ID(3),
    issued_at: AHORA.toISOString(),
    subtotal_cents: 10_000,
    tax_cents: 1_600,
    total_cents: 11_600,
    deposit_percent_bps: 5_000,
    deposit_required_cents: 5_800,
    device_id: ID(1),
    user_id: ID(2),
    op_id: ID(100 + n),
  });
  expect(o.error, `orden ${String(n)}`).toBeNull();
  const l = await servicio.from('work_order_lines').insert({
    id: ID(200 + n),
    work_order_id: ID(n),
    position: 1,
    product_id: productoId,
    name: 'Cancel de prueba',
    charge_unit: 'PIECE',
    unit_price_cents: 11_600,
    rule_id: 'PIECE',
    quantity: 1,
    line_total_cents: 11_600,
    base_cents: 10_000,
    tax_cents: 1_600,
  });
  expect(l.error, `línea de orden ${String(n)}`).toBeNull();
  const p = await servicio.from('payments').insert({
    id: ID(300 + n),
    group_id: ID(400 + n),
    work_order_id: ID(n),
    kind: 'BALANCE',
    method: 'TRANSFER',
    amount_cents: 11_600,
    user_id: ID(2),
    device_id: ID(1),
    paid_at: AHORA.toISOString(),
    op_id: ID(500 + n),
  });
  expect(p.error, `pago de orden ${String(n)}`).toBeNull();
}

async function ponerAjusteDeAnticipos(valor: 'a' | 'b'): Promise<void> {
  const r = await servicio
    .from('business_settings')
    .update({ value: valor })
    .eq('key', 'deposit_tax_treatment');
  expect(r.error, 'ajuste de anticipos').toBeNull();
}

beforeAll(async () => {
  expect(URL, 'faltan las variables: usa `pnpm test:integracion`').not.toBe('');
  servicio = crearCliente(SERVICIO);
  const admin = await entrar('ADMIN');
  tokenAdmin = admin.token;
  idAdmin = admin.id;
  tokenCajero = (await entrar('STAFF')).token;

  const cuenta = await servicio.auth.admin.createUser({
    email: `rc-tablet-${sufijo}@ejemplo.invalid`,
    password: `Clave-${sufijo}-Tab1`,
    email_confirm: true,
    app_metadata: { rol: 'DEVICE' },
  });
  expect(cuenta.error, 'cuenta de la tablet').toBeNull();
  const dispositivo = await servicio.from('devices').insert({
    id: ID(1),
    name: 'Tablet de reintentos',
    temp_series: 150_000 + (Number.parseInt(sufijo.slice(0, 5), 16) % 300_000),
    auth_user_id: cuenta.data.user?.id ?? null,
  });
  expect(dispositivo.error, 'dispositivo').toBeNull();
  const cliente = await servicio
    .from('customers')
    .insert({ id: ID(3), name: 'Cliente de reintentos', phone: '5512345678' });
  expect(cliente.error, 'cliente').toBeNull();

  const categoria = await servicio
    .from('product_categories')
    .select('id')
    .order('sort_order')
    .limit(1)
    .single();
  expect(categoria.error, 'categoría').toBeNull();
  const producto = await servicio.from('products').insert({
    id: ID(5),
    name: 'Producto de reintentos',
    category_id: categoria.data?.id,
    kind: 'STANDARD',
    charge_unit: 'PIECE',
    list_price_cents: 11_600,
    rule_id: 'PIECE',
  });
  expect(producto.error, 'producto').toBeNull();

  for (const n of [10, 11, 12, 13, 14, 15, 16]) {
    await crearVenta(n, ID(5));
  }
  await crearOrden(20, ID(5));
});

afterAll(async () => {
  // El ajuste de anticipos vuelve a su valor por omisión para no afectar a otras pruebas.
  await ponerAjusteDeAnticipos('a');
});

/** Una solicitud en proceso como la deja un PAC que no respondió: con lo que se le mandó, para reintentarla. */
async function solicitudEnProceso(n: number, intentos = 0): Promise<string> {
  const requestId = crypto.randomUUID();
  const snapshot = JSON.parse(JSON.stringify({ ...SOLICITUD_DE_PRUEBA, requestId })) as unknown;
  const r = await servicio.from('invoice_requests').insert({
    request_id: requestId,
    counter_sale_id: ID(n),
    channel: 'SYSTEM',
    status: 'IN_PROCESS',
    request_snapshot: snapshot,
    attempts: intentos,
    last_attempt_at: new Date(Date.now() - 3_600_000).toISOString(),
  });
  expect(r.error, `solicitud en proceso ${String(n)}`).toBeNull();
  return requestId;
}

describe('reintentar facturas en proceso [S4-20]', () => {
  it('el administrador reintenta una en particular y queda timbrada con su folio y sus archivos', async () => {
    const requestId = await solicitudEnProceso(10);
    const r = await llamar('reintentar-facturas', { requestId });
    expect(r.estado).toBe(200);
    const folio = (r.cuerpo.invoice as { folio: string }).folio;
    expect(folio).toMatch(/^F-\d{4}-\d{4,}$/);
    const fila = await servicio
      .from('invoice_requests')
      .select('status, xml, pdf_base64, recipient')
      .eq('request_id', requestId)
      .single();
    expect(fila.data).toMatchObject({ status: 'STAMPED' });
    expect(String(fila.data?.xml)).toContain('Rfc="XAXX010101000"');
  });

  it('reintentar otra vez la misma ya no hace nada: no hay nada en proceso, no se duplica', async () => {
    const requestId = await solicitudEnProceso(11);
    expect((await llamar('reintentar-facturas', { requestId })).estado).toBe(200);
    const otra = await llamar('reintentar-facturas', { requestId });
    expect(otra.estado).toBe(404);
    const folios = await servicio
      .from('invoice_requests')
      .select('invoice_folio')
      .eq('counter_sale_id', ID(11))
      .eq('status', 'STAMPED');
    expect(folios.data).toHaveLength(1);
  });

  it('la pasada automática, con la llave de servicio, termina lo pendiente y lo cuenta', async () => {
    const a = await solicitudEnProceso(12);
    const b = await solicitudEnProceso(13);
    const r = await llamar('reintentar-facturas', {}, SERVICIO);
    expect(r.estado).toBe(200);
    const resumen = r.cuerpo.summary as { stamped: number };
    expect(resumen.stamped).toBeGreaterThanOrEqual(2);
    const fila = await servicio
      .from('invoice_requests')
      .select('request_id, status')
      .in('request_id', [a, b]);
    expect(((fila.data ?? []) as { status: string }[]).map((f) => f.status)).toEqual([
      'STAMPED',
      'STAMPED',
    ]);
  });

  it('una con el tope de intentos alcanzado ya no se reintenta sola, pero un administrador sí puede', async () => {
    const requestId = await solicitudEnProceso(14, 99);
    const pasada = await llamar('reintentar-facturas', {}, SERVICIO);
    expect(pasada.estado).toBe(200);
    const antes = await servicio
      .from('invoice_requests')
      .select('status')
      .eq('request_id', requestId)
      .single();
    expect(antes.data?.status).toBe('IN_PROCESS');
    expect((await llamar('reintentar-facturas', { requestId })).estado).toBe(200);
  });

  it('solo con la llave de servicio o con un administrador: sin sesión, con un cajero o con llave falsa no', async () => {
    expect((await llamar('reintentar-facturas', {}, null)).estado).toBe(401);
    expect((await llamar('reintentar-facturas', {}, 'token-falso')).estado).toBe(401);
    expect(
      (await llamar('reintentar-facturas', { requestId: crypto.randomUUID() }, tokenCajero)).estado,
    ).toBe(403);
    // Un administrador no dispara la pasada automática: esa es solo del servidor.
    expect((await llamar('reintentar-facturas', {})).estado).toBe(403);
    expect((await llamar('reintentar-facturas', { requestId: 'no-uuid' })).estado).toBe(400);
  });
});

describe('cancelar una factura [S4-21]', () => {
  async function facturada(n: number): Promise<string> {
    const r = await facturar('COUNTER_SALE', ID(n));
    expect(r.estado).toBe(200);
    return (r.cuerpo.invoice as { folio: string }).folio;
  }

  it('un administrador cancela con un motivo del SAT: queda cancelada y en la bitácora con quién y por qué', async () => {
    const folio = await facturada(15);
    const r = await llamar('cancelar-factura', { folio, motive: '02' });
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({ status: 'CANCELLED' });
    const fila = await servicio
      .from('invoice_requests')
      .select('status, cancel_motive, cancelled_by')
      .eq('invoice_folio', folio)
      .single();
    expect(fila.data).toMatchObject({
      status: 'CANCELLED',
      cancel_motive: '02',
      cancelled_by: idAdmin,
    });
    const bitacora = await servicio
      .from('audit_log')
      .select('action, user_id, new_value')
      .eq('entity_id', folio)
      .eq('action', 'INVOICE_CANCELLED');
    expect(bitacora.data).toHaveLength(1);
    expect(bitacora.data?.[0]).toMatchObject({ user_id: idAdmin });
    expect((bitacora.data?.[0]?.new_value as { motivo: string }).motivo).toBe('02');
  });

  it('cancelada la factura, la venta se puede volver a facturar (cancelar y volver a emitir)', async () => {
    const otra = await facturar('COUNTER_SALE', ID(15));
    expect(otra.estado).toBe(200);
  });

  it('un cajero no cancela, ni con sesión; y sin sesión tampoco', async () => {
    const folio = await facturada(16);
    expect((await llamar('cancelar-factura', { folio, motive: '02' }, tokenCajero)).estado).toBe(
      403,
    );
    expect((await llamar('cancelar-factura', { folio, motive: '02' }, null)).estado).toBe(401);
    const sigue = await servicio
      .from('invoice_requests')
      .select('status')
      .eq('invoice_folio', folio)
      .single();
    expect(sigue.data?.status).toBe('STAMPED');
  });

  it('el motivo 01 exige la factura que la sustituye, ya emitida, y no otra cualquiera', async () => {
    const primera = await facturar('WORK_ORDER', ID(20));
    expect(primera.estado).toBe(200);
    const folioPrimera = (primera.cuerpo.invoice as { folio: string }).folio;
    const sin = await llamar('cancelar-factura', { folio: folioPrimera, motive: '01' });
    expect(sin.estado).toBe(400);
    expect(sin.cuerpo).toEqual({ error: 'INVALID_INPUT', fields: ['substituteFolio'] });
    const falsa = await llamar('cancelar-factura', {
      folio: folioPrimera,
      motive: '01',
      substituteFolio: 'F-2099-0001',
    });
    expect(falsa.estado).toBe(400);
  });

  it('una factura que no existe o ya cancelada no se cancela', async () => {
    expect((await llamar('cancelar-factura', { folio: 'F-2099-9999', motive: '02' })).estado).toBe(
      404,
    );
    await crearVenta(18, ID(5));
    const folio = await facturada(18);
    expect((await llamar('cancelar-factura', { folio, motive: '03' })).estado).toBe(200);
    expect((await llamar('cancelar-factura', { folio, motive: '03' })).estado).toBe(409);
  });

  it('un motivo que no es del SAT o una petición mal formada se rechazan', async () => {
    const motivo = await llamar('cancelar-factura', { folio: 'F-2099-1', motive: '09' });
    expect(motivo.estado).toBe(400);
    expect(motivo.cuerpo).toEqual({ error: 'INVALID_INPUT', fields: ['motive'] });
    expect((await llamar('cancelar-factura', { folio: 5 })).estado).toBe(400);
  });
});

describe('anticipos [S4-21, RN-27]', () => {
  it('con el ajuste en la opción (b) una orden no se factura; con la (a) sí; una venta siempre', async () => {
    await crearOrden(21, ID(5));
    await ponerAjusteDeAnticipos('b');
    const orden = await facturar('WORK_ORDER', ID(21));
    expect(orden.estado).toBe(409);
    expect(orden.cuerpo).toEqual({ error: 'DEPOSIT_TREATMENT_UNSUPPORTED' });
    await crearVenta(17, ID(5));
    expect((await facturar('COUNTER_SALE', ID(17))).estado).toBe(200);
    await ponerAjusteDeAnticipos('a');
    expect((await facturar('WORK_ORDER', ID(21))).estado).toBe(200);
  });
});

describe('lo que ve el administrador [S4-20, S4-22]', () => {
  async function comoAdmin() {
    const cliente = crearCliente(ANON);
    await cliente.auth.setSession({ access_token: tokenAdmin, refresh_token: 'no-se-usa' });
    return cliente;
  }

  it('lista las facturas con su estado, cuántos intentos van y de quién son', async () => {
    const cliente = await comoAdmin();
    const lista = await cliente.rpc('admin_invoice_list');
    expect(lista.error).toBeNull();
    const filas = lista.data as {
      status: string;
      customer_name: string | null;
      invoice_folio: string | null;
    }[];
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.some((f) => f.status === 'CANCELLED')).toBe(true);
    expect(
      filas.some((f) => f.status === 'STAMPED' && f.customer_name === 'Cliente de reintentos'),
    ).toBe(true);
  });

  it('cuenta los timbres gastados, incluidas las facturas ya canceladas', async () => {
    const cliente = await comoAdmin();
    const uso = await cliente.rpc('admin_stamp_usage');
    expect(uso.error).toBeNull();
    const fila = (uso.data as { used: number; warning_percent: number }[])[0];
    expect(fila?.used).toBeGreaterThanOrEqual(8);
    expect(fila?.warning_percent).toBe(80);
  });

  it('las facturas de un cliente salen en su historial', async () => {
    const cliente = await comoAdmin();
    const r = await cliente.rpc('admin_customer_invoices', { p_customer_id: ID(3) });
    expect(r.error).toBeNull();
    const filas = r.data as { invoice_folio: string; status: string }[];
    expect(filas.length).toBeGreaterThanOrEqual(5);
    expect(filas.every((f) => /^F-\d{4}-\d{4,}$/.test(f.invoice_folio))).toBe(true);
  });

  it('un cajero no ve nada de esto', async () => {
    const cajero = crearCliente(ANON);
    await cajero.auth.setSession({ access_token: tokenCajero, refresh_token: 'no-se-usa' });
    expect((await cajero.rpc('admin_invoice_list')).error).not.toBeNull();
    expect((await cajero.rpc('admin_stamp_usage')).error).not.toBeNull();
    expect(
      (await cajero.rpc('admin_customer_invoices', { p_customer_id: ID(3) })).error,
    ).not.toBeNull();
  });
});
