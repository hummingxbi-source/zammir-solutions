import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

// Pruebas contra Supabase local real y la función de servidor `facturar` [S4-16]. Corren con
// `pnpm test:integracion`, que enciende las funciones con el proveedor de timbrado simulado.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const crearCliente = (llave: string) => createClient(URL, llave, opciones);

const sufijo = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
const ID = (n: number): string =>
  `5c${sufijo.slice(0, 6)}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AHORA = new Date();
// Hace tres meses: fuera del plazo del portal, que un administrador sí puede saltar.
const HACE_TRES_MESES = new Date(AHORA.getFullYear(), AHORA.getMonth() - 3, 10, 12);

const serie = 600_000 + (Number.parseInt(sufijo.slice(0, 4), 16) % 300_000);
const venta = (n: number) => ({ n, folio: `T${String(serie)}-${String(n).padStart(4, '0')}` });

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

async function entrar(rol: 'ADMIN' | 'STAFF'): Promise<string> {
  const correo = `fact-${rol.toLowerCase()}-${sufijo}@ejemplo.invalid`;
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
  return sesion.data.session?.access_token ?? '';
}

async function facturar(datos: Record<string, unknown>, token = tokenAdmin): Promise<Respuesta> {
  const respuesta = await fetch(`${URL}/functions/v1/facturar`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: ANON,
      ...(token === '' ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(datos),
  });
  return { estado: respuesta.status, cuerpo: (await respuesta.json()) as Record<string, unknown> };
}

const pedir = (n: number, extra: Record<string, unknown> = {}) =>
  facturar({
    source: { type: 'COUNTER_SALE', id: ID(n) },
    requestId: crypto.randomUUID(),
    recipient: receptor,
    ...extra,
  });

async function crearVenta(
  n: number,
  opciones: {
    productoId: string | null;
    metodos: ('CASH' | 'TRANSFER')[];
    fecha?: Date;
    estado?: 'COMPLETED' | 'CANCELLED';
    pagado?: number;
  },
): Promise<void> {
  const fecha = opciones.fecha ?? AHORA;
  const v = venta(n);
  const insertada = await servicio.from('counter_sales').insert({
    id: ID(n),
    temp_folio: v.folio,
    public_code: `${String.fromCharCode(65 + (n % 20))}${sufijo.slice(0, 6).toUpperCase().replace(/[01]/g, '2')}Q`,
    status: opciones.estado ?? 'COMPLETED',
    issued_at: fecha.toISOString(),
    subtotal_cents: 10_000,
    tax_cents: 1_600,
    total_cents: 11_600,
    device_id: ID(1),
    user_id: ID(2),
    op_id: ID(100 + n),
  });
  expect(insertada.error, `venta ${String(n)}`).toBeNull();
  const linea = await servicio.from('counter_sale_lines').insert({
    id: ID(200 + n),
    counter_sale_id: ID(n),
    position: 1,
    product_id: opciones.productoId,
    name: 'Chapa de prueba',
    charge_unit: 'PIECE',
    unit_price_cents: 11_600,
    rule_id: 'PIECE',
    quantity: 1,
    line_total_cents: 11_600,
    base_cents: 10_000,
    tax_cents: 1_600,
  });
  expect(linea.error, `línea ${String(n)}`).toBeNull();
  for (const [i, metodo] of opciones.metodos.entries()) {
    const total = opciones.pagado ?? 11_600;
    const monto = opciones.metodos.length === 1 ? total : i === 0 ? total - 600 : 600;
    const pago = await servicio.from('payments').insert({
      id: ID(300 + n * 10 + i),
      group_id: ID(400 + n),
      counter_sale_id: ID(n),
      kind: 'SALE',
      method: metodo,
      amount_cents: monto,
      ...(metodo === 'CASH' ? { cash_received_cents: monto, change_cents: 0 } : {}),
      user_id: ID(2),
      device_id: ID(1),
      paid_at: fecha.toISOString(),
      op_id: ID(500 + n * 10 + i),
    });
    expect(pago.error, `pago ${String(n)}-${String(i)}`).toBeNull();
  }
}

beforeAll(async () => {
  expect(URL, 'faltan las variables: usa `pnpm test:integracion`').not.toBe('');
  servicio = crearCliente(SERVICIO);
  tokenAdmin = await entrar('ADMIN');
  tokenCajero = await entrar('STAFF');

  const cuenta = await servicio.auth.admin.createUser({
    email: `fact-tablet-${sufijo}@ejemplo.invalid`,
    password: `Clave-${sufijo}-Tab1`,
    email_confirm: true,
    app_metadata: { rol: 'DEVICE' },
  });
  expect(cuenta.error, 'cuenta de la tablet').toBeNull();
  const dispositivo = await servicio.from('devices').insert({
    id: ID(1),
    name: 'Tablet de facturar',
    temp_series: 100_000 + (Number.parseInt(sufijo.slice(0, 5), 16) % 400_000),
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
    name: 'Producto de facturar',
    category_id: categoria.data?.id,
    kind: 'STANDARD',
    charge_unit: 'PIECE',
    list_price_cents: 11_600,
    rule_id: 'PIECE',
  });
  expect(producto.error, 'producto').toBeNull();

  await crearVenta(10, { productoId: ID(5), metodos: ['CASH'], fecha: HACE_TRES_MESES });
  await crearVenta(11, { productoId: ID(5), metodos: ['TRANSFER'] });
  await crearVenta(12, { productoId: ID(5), metodos: ['CASH', 'TRANSFER'] });
  await crearVenta(13, { productoId: ID(5), metodos: ['TRANSFER'], pagado: 5_000 });
  await crearVenta(14, { productoId: ID(5), metodos: ['TRANSFER'], estado: 'CANCELLED' });
  await crearVenta(15, { productoId: null, metodos: ['TRANSFER'] });
  await crearVenta(16, { productoId: ID(5), metodos: ['TRANSFER'] });
});

describe('facturar desde el sistema (función de servidor facturar)', () => {
  it('sin sesión o con una sesión que no vale no hace nada', async () => {
    expect((await facturar({}, '')).estado).toBe(401);
    expect((await facturar({}, 'token-falso')).estado).toBe(401);
  });

  it('un cajero con sesión no factura: solo un administrador, o con su autorización', async () => {
    const r = await facturar(
      {
        source: { type: 'COUNTER_SALE', id: ID(11) },
        requestId: crypto.randomUUID(),
        recipient: receptor,
      },
      tokenCajero,
    );
    expect(r.estado).toBe(403);
    expect(r.cuerpo).toEqual({ error: 'NOT_AUTHORIZED' });
  });

  it('un administrador factura aunque haya pasado el plazo del portal y queda el folio F', async () => {
    const r = await pedir(10);
    expect(r.estado).toBe(200);
    const factura = r.cuerpo.invoice as { folio: string; uuid: string };
    expect(factura.folio).toMatch(/^F-\d{4}-\d{4,}$/);
    const guardada = await servicio
      .from('invoice_requests')
      .select('status, channel, payment_form, xml, recipient')
      .eq('invoice_folio', factura.folio)
      .single();
    expect(guardada.data).toMatchObject({
      status: 'STAMPED',
      channel: 'SYSTEM',
      payment_form: '01',
    });
    expect(String(guardada.data?.xml)).toContain(factura.uuid);
  });

  it('reenviar la misma solicitud devuelve la misma factura; otra sobre la misma venta se rechaza', async () => {
    const requestId = crypto.randomUUID();
    const a = await pedir(16, { requestId });
    const b = await pedir(16, { requestId });
    expect(a.estado).toBe(200);
    expect(b.cuerpo).toEqual(a.cuerpo);
    const otra = await pedir(16);
    expect(otra.estado).toBe(409);
    expect(otra.cuerpo).toEqual({ error: 'NOT_ELIGIBLE', reason: 'ALREADY_INVOICED' });
  });

  it('con saldo o cancelada no se factura', async () => {
    const saldo = await pedir(13);
    expect(saldo.cuerpo).toEqual({ error: 'NOT_ELIGIBLE', reason: 'NOT_SETTLED' });
    const cancelada = await pedir(14);
    expect(cancelada.cuerpo).toEqual({ error: 'NOT_ELIGIBLE', reason: 'CANCELLED' });
  });

  it('un pago mixto exige elegir la forma de pago y se factura con la que se elija', async () => {
    const sin = await pedir(12);
    expect(sin.estado).toBe(409);
    expect(sin.cuerpo).toEqual({ error: 'PAYMENT_FORM_REQUIRED' });
    const con = await pedir(12, { paymentForm: '03' });
    expect(con.estado).toBe(200);
    const folio = (con.cuerpo.invoice as { folio: string }).folio;
    const guardada = await servicio
      .from('invoice_requests')
      .select('payment_form')
      .eq('invoice_folio', folio)
      .single();
    expect(guardada.data?.payment_form).toBe('03');
  });

  it('un concepto sin claves del SAT no se factura', async () => {
    const r = await pedir(15);
    expect(r.estado).toBe(409);
    expect(r.cuerpo).toEqual({ error: 'NOT_BILLABLE', reason: 'FISCAL_DATA_MISSING' });
  });

  it('datos fiscales inválidos se rechazan y dicen cuáles campos', async () => {
    const r = await pedir(11, { recipient: { ...receptor, rfc: 'CORTO', regime: '999' } });
    expect(r.estado).toBe(400);
    expect(r.cuerpo).toEqual({
      error: 'INVALID_INPUT',
      fields: ['recipient.rfc', 'recipient.regime'],
    });
  });

  it('una venta que no existe y peticiones mal formadas se rechazan', async () => {
    expect(
      (
        await facturar({
          source: { type: 'COUNTER_SALE', id: ID(999) },
          requestId: crypto.randomUUID(),
          recipient: receptor,
        })
      ).estado,
    ).toBe(404);
    expect((await facturar({ source: { type: 'QUOTE', id: ID(10) } })).estado).toBe(400);
    expect((await facturar({ source: { type: 'COUNTER_SALE', id: 'no-uuid' } })).estado).toBe(400);
  });

  it('el administrador ve lo facturable desde su sesión y un cajero no', async () => {
    const admin = crearCliente(ANON);
    await admin.auth.setSession({ access_token: tokenAdmin, refresh_token: 'no-se-usa' });
    const lista = await admin.rpc('admin_invoice_candidates');
    expect(lista.error).toBeNull();
    const folios = (lista.data as { folio: string }[]).map((f) => f.folio);
    expect(folios).toContain(venta(11).folio);
    expect(folios).not.toContain(venta(13).folio);
    expect(folios).not.toContain(venta(14).folio);
    expect(folios).not.toContain(venta(10).folio);
    const cajero = crearCliente(ANON);
    await cajero.auth.setSession({ access_token: tokenCajero, refresh_token: 'no-se-usa' });
    expect((await cajero.rpc('admin_invoice_candidates')).error).not.toBeNull();
  });
});
