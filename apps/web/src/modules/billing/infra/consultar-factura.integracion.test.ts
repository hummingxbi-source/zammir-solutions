import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Pruebas contra Supabase local real y la función de servidor `consultar-factura` [S4-18].
// Corren con `pnpm test:integracion`, que enciende las funciones si hace falta.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
function crearCliente(llave: string) {
  return createClient(URL, llave, opciones);
}

// Datos propios de esta prueba, con identificadores y códigos que no chocan con otras.
const sufijo = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
const ID = (n: number): string =>
  `5a${sufijo.slice(0, 6)}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AHORA = new Date();
const MES_PASADO = new Date(AHORA.getFullYear(), AHORA.getMonth() - 2, 15, 12);

// Códigos públicos válidos (A-Z y 2-9), únicos para esta corrida.
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function codigo(semilla: number): string {
  let n = semilla + Number.parseInt(sufijo.slice(0, 6), 16);
  let texto = '';
  for (let i = 0; i < 8; i += 1) {
    texto += LETRAS.charAt(n % LETRAS.length);
    n = Math.floor(n / LETRAS.length) + 7 * (i + 1);
  }
  return texto;
}

const CODIGO_VENTA = codigo(1);
const CODIGO_ORDEN_CON_SALDO = codigo(2);
const CODIGO_VENTA_VIEJA = codigo(3);
const CODIGO_VENTA_FACTURADA = codigo(4);
const FOLIO_VENTA = `T${String(900_000 + Number.parseInt(sufijo.slice(0, 4), 16))}-0001`;
const FOLIO_ORDEN = `T${String(900_000 + Number.parseInt(sufijo.slice(0, 4), 16))}-0002`;
const FOLIO_VIEJA = `T${String(900_000 + Number.parseInt(sufijo.slice(0, 4), 16))}-0003`;
const FOLIO_FACTURADA = `T${String(900_000 + Number.parseInt(sufijo.slice(0, 4), 16))}-0004`;

interface Respuesta {
  readonly estado: number;
  readonly cuerpo: Record<string, unknown>;
  readonly reintentar: string | null;
}

let ipDePrueba = 0;
async function consultar(
  datos: Record<string, unknown>,
  ip = `198.51.100.${String(++ipDePrueba % 250)}`,
): Promise<Respuesta> {
  const respuesta = await fetch(`${URL}/functions/v1/consultar-factura`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: ANON, 'x-forwarded-for': ip },
    body: JSON.stringify({ honeypot: '', elapsedMs: 10_000, ...datos }),
  });
  return {
    estado: respuesta.status,
    cuerpo: (await respuesta.json()) as Record<string, unknown>,
    reintentar: respuesta.headers.get('retry-after'),
  };
}

let servicio: ReturnType<typeof crearCliente>;
const venta = (id: number, folio: string, code: string, issuedAt: Date) => ({
  id: ID(id),
  temp_folio: folio,
  public_code: code,
  issued_at: issuedAt.toISOString(),
  subtotal_cents: 10_000,
  tax_cents: 1_600,
  total_cents: 11_600,
  device_id: ID(1),
  user_id: ID(2),
  op_id: ID(100 + id),
});

beforeAll(async () => {
  expect(URL, 'faltan las variables: usa `pnpm test:integracion`').not.toBe('');
  servicio = crearCliente(SERVICIO);
  const cuenta = await servicio.auth.admin.createUser({
    email: `portal-tablet-${sufijo}@ejemplo.invalid`,
    password: `Clave-${sufijo}-Tab1`,
    email_confirm: true,
    app_metadata: { rol: 'DEVICE' },
  });
  expect(cuenta.error, 'cuenta de la tablet').toBeNull();
  const dispositivo = await servicio.from('devices').insert({
    id: ID(1),
    name: 'Tablet del portal',
    temp_series: 300_000 + (Number.parseInt(sufijo.slice(0, 5), 16) % 500_000),
    auth_user_id: cuenta.data.user?.id ?? null,
  });
  expect(dispositivo.error, 'dispositivo').toBeNull();
  const cliente = await servicio
    .from('customers')
    .insert({ id: ID(3), name: 'Cliente del portal', phone: '5512345678' });
  expect(cliente.error, 'cliente').toBeNull();

  for (const [n, folio, code, fecha] of [
    [10, FOLIO_VENTA, CODIGO_VENTA, AHORA],
    [11, FOLIO_VIEJA, CODIGO_VENTA_VIEJA, MES_PASADO],
    [12, FOLIO_FACTURADA, CODIGO_VENTA_FACTURADA, AHORA],
  ] as const) {
    const v = await servicio.from('counter_sales').insert(venta(n, folio, code, fecha));
    expect(v.error, `venta ${String(n)}`).toBeNull();
    const l = await servicio.from('counter_sale_lines').insert({
      id: ID(200 + n),
      counter_sale_id: ID(n),
      position: 1,
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
      paid_at: fecha.toISOString(),
      op_id: ID(500 + n),
    });
    expect(p.error, `pago ${String(n)}`).toBeNull();
  }

  const facturada = await servicio.from('invoice_requests').insert({
    request_id: ID(600),
    counter_sale_id: ID(12),
    channel: 'PORTAL',
  });
  expect(facturada.error, 'factura pedida').toBeNull();

  const orden = await servicio.from('work_orders').insert({
    id: ID(20),
    temp_folio: FOLIO_ORDEN,
    public_code: CODIGO_ORDEN_CON_SALDO,
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
    work_order_id: ID(20),
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

afterAll(async () => {
  // Lo contable no se borra (RN-18): estos datos de prueba quedan en la base local.
});

describe('portal de autofacturación (función de servidor consultar-factura)', () => {
  it('con folio y código correctos de una venta liquidada y en plazo, devuelve solo conceptos y total', async () => {
    const r = await consultar({ folio: FOLIO_VENTA, code: CODIGO_VENTA });
    expect(r.estado).toBe(200);
    const documento = r.cuerpo.document as Record<string, unknown>;
    expect(documento.totalCents).toBe(11_600);
    expect(documento.lines).toEqual([
      { name: 'Chapa de prueba', quantity: 1, lineTotalCents: 11_600 },
    ]);
    expect(Object.keys(documento).sort()).toEqual([
      'deadline',
      'folio',
      'lines',
      'totalCents',
      'type',
    ]);
  });

  it('acepta el código con minúsculas y guion, como lo teclea una persona', async () => {
    const tecleado = `${CODIGO_VENTA.slice(0, 4)}-${CODIGO_VENTA.slice(4)}`.toLowerCase();
    const r = await consultar({ folio: FOLIO_VENTA.toLowerCase(), code: tecleado });
    expect(r.estado).toBe(200);
  });

  it('un código incorrecto y un folio inexistente responden exactamente lo mismo', async () => {
    const malo = await consultar({ folio: FOLIO_VENTA, code: codigo(77) });
    const inexistente = await consultar({ folio: 'V-2099-0001', code: codigo(78) });
    expect(malo.estado).toBe(404);
    expect(malo.cuerpo).toEqual({ error: 'NOT_AVAILABLE' });
    expect(inexistente.estado).toBe(malo.estado);
    expect(inexistente.cuerpo).toEqual(malo.cuerpo);
  });

  it('el código de otro documento con un folio que no es el suyo no revela nada', async () => {
    const r = await consultar({ folio: FOLIO_VIEJA, code: CODIGO_VENTA });
    expect(r.estado).toBe(404);
    expect(r.cuerpo).toEqual({ error: 'NOT_AVAILABLE' });
  });

  it('con el código correcto pero con saldo, vencida o ya facturada, dice por qué no', async () => {
    const saldo = await consultar({ folio: FOLIO_ORDEN, code: CODIGO_ORDEN_CON_SALDO });
    expect(saldo.estado).toBe(409);
    expect(saldo.cuerpo).toEqual({ error: 'NOT_ELIGIBLE', reason: 'NOT_SETTLED' });
    const vieja = await consultar({ folio: FOLIO_VIEJA, code: CODIGO_VENTA_VIEJA });
    expect(vieja.cuerpo).toEqual({ error: 'NOT_ELIGIBLE', reason: 'EXPIRED' });
    const facturada = await consultar({ folio: FOLIO_FACTURADA, code: CODIGO_VENTA_FACTURADA });
    expect(facturada.cuerpo).toEqual({ error: 'NOT_ELIGIBLE', reason: 'ALREADY_INVOICED' });
  });

  it('el campo trampa lleno o el envío demasiado rápido frenan al programa', async () => {
    const trampa = await consultar({ folio: FOLIO_VENTA, code: CODIGO_VENTA, honeypot: 'spam' });
    expect(trampa.estado).toBe(404);
    const rapido = await consultar({ folio: FOLIO_VENTA, code: CODIGO_VENTA, elapsedMs: 50 });
    expect(rapido.estado).toBe(404);
  });

  it('demasiados intentos fallidos sobre un folio lo bloquean, incluso con el código bueno', async () => {
    const folio = 'V-2098-0042';
    for (let i = 0; i < 5; i += 1) {
      const r = await consultar({ folio, code: codigo(900 + i) });
      expect(r.estado).toBe(404);
    }
    const bloqueado = await consultar({ folio, code: codigo(999) });
    expect(bloqueado.estado).toBe(429);
    expect(bloqueado.cuerpo.error).toBe('TOO_MANY_ATTEMPTS');
    expect(Number(bloqueado.reintentar)).toBeGreaterThan(0);
  });

  it('demasiados intentos fallidos desde una misma IP la bloquean aunque cambie de folio', async () => {
    const ip = '203.0.113.200';
    for (let i = 0; i < 15; i += 1) {
      const r = await consultar({ folio: `V-2097-${String(1000 + i)}`, code: codigo(800 + i) }, ip);
      expect(r.estado).toBe(404);
    }
    const bloqueada = await consultar({ folio: FOLIO_VENTA, code: CODIGO_VENTA }, ip);
    expect(bloqueada.estado).toBe(429);
  });

  it('una petición mal formada no revela nada ni rompe la función', async () => {
    const sinCampos = await consultar({ folio: 5 });
    expect(sinCampos.estado).toBe(400);
    const respuesta = await fetch(`${URL}/functions/v1/consultar-factura`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: ANON },
      body: 'no es json',
    });
    expect(respuesta.status).toBe(400);
    const metodo = await fetch(`${URL}/functions/v1/consultar-factura`, {
      method: 'GET',
      headers: { apikey: ANON },
    });
    expect(metodo.status).toBe(405);
  });

  it('el navegador no puede leer las tablas del portal ni llamar a sus funciones directamente', async () => {
    const anonimo = crearCliente(ANON);
    const tabla = await anonimo.from('portal_attempts').select('*');
    expect(tabla.error).not.toBeNull();
    const facturas = await anonimo.from('invoice_requests').select('*');
    expect(facturas.error).not.toBeNull();
    const funcion = await anonimo.rpc('portal_find_document', {
      p_folio: FOLIO_VENTA,
      p_code: CODIGO_VENTA,
    });
    expect(funcion.error).not.toBeNull();
    const ventas = await anonimo.from('counter_sales').select('*');
    expect(ventas.error !== null || ventas.data.length === 0).toBe(true);
  });
});
