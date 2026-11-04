import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

// Pruebas contra Supabase local real y las funciones de servidor `solicitar-factura` y `descargar-factura`
// [S4-19]. Corren con `pnpm test:integracion`, que enciende las funciones con el proveedor simulado.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const crearCliente = (llave: string) => createClient(URL, llave, opciones);

const sufijo = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
const ID = (n: number): string =>
  `5b${sufijo.slice(0, 6)}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AHORA = new Date();

const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function codigo(semilla: number): string {
  let n = semilla + Number.parseInt(sufijo.slice(0, 6), 16);
  let texto = '';
  for (let i = 0; i < 8; i += 1) {
    texto += LETRAS.charAt(n % LETRAS.length);
    n = Math.floor(n / LETRAS.length) + 11 * (i + 1);
  }
  return texto;
}

const serie = 700_000 + (Number.parseInt(sufijo.slice(0, 4), 16) % 200_000);
const VENTA = { n: 10, folio: `T${String(serie)}-0001`, code: codigo(1) };
const VENTA_MIXTA = { n: 11, folio: `T${String(serie)}-0002`, code: codigo(2) };
const VENTA_SIN_CLAVES = { n: 12, folio: `T${String(serie)}-0003`, code: codigo(3) };

interface Respuesta {
  readonly estado: number;
  readonly cuerpo: Record<string, unknown>;
}

let ipDePrueba = 0;
async function llamar(
  funcion: string,
  datos: Record<string, unknown>,
  ip = `198.51.100.${String(100 + (++ipDePrueba % 100))}`,
): Promise<Respuesta> {
  const respuesta = await fetch(`${URL}/functions/v1/${funcion}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: ANON, 'x-forwarded-for': ip },
    body: JSON.stringify({ honeypot: '', elapsedMs: 10_000, ...datos }),
  });
  return {
    estado: respuesta.status,
    cuerpo: (await respuesta.json()) as Record<string, unknown>,
  };
}

const receptor = {
  rfc: 'xaxx010101000',
  name: 'CLIENTE DE PRUEBA',
  fiscalZip: '55900',
  regime: '616',
  cfdiUse: 'S01',
};

const solicitar = (v: { folio: string; code: string }, extra: Record<string, unknown> = {}) =>
  llamar('solicitar-factura', {
    folio: v.folio,
    code: v.code,
    requestId: crypto.randomUUID(),
    acceptedPrivacy: true,
    recipient: receptor,
    ...extra,
  });

let servicio: ReturnType<typeof crearCliente>;

async function crearVenta(
  v: { n: number; folio: string; code: string },
  opciones: { productoId: string | null; metodos: ('CASH' | 'TRANSFER')[] },
): Promise<void> {
  const venta = await servicio.from('counter_sales').insert({
    id: ID(v.n),
    temp_folio: v.folio,
    public_code: v.code,
    issued_at: AHORA.toISOString(),
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
  expect(linea.error, `línea ${String(v.n)}`).toBeNull();
  for (const [i, metodo] of opciones.metodos.entries()) {
    const monto = opciones.metodos.length === 1 ? 11_600 : i === 0 ? 11_000 : 600;
    const pago = await servicio.from('payments').insert({
      id: ID(300 + v.n * 10 + i),
      group_id: ID(400 + v.n),
      counter_sale_id: ID(v.n),
      kind: 'SALE',
      method: metodo,
      amount_cents: monto,
      ...(metodo === 'CASH' ? { cash_received_cents: monto, change_cents: 0 } : {}),
      user_id: ID(2),
      device_id: ID(1),
      paid_at: AHORA.toISOString(),
      op_id: ID(500 + v.n * 10 + i),
    });
    expect(pago.error, `pago ${String(v.n)}-${String(i)}`).toBeNull();
  }
}

beforeAll(async () => {
  expect(URL, 'faltan las variables: usa `pnpm test:integracion`').not.toBe('');
  servicio = crearCliente(SERVICIO);
  const cuenta = await servicio.auth.admin.createUser({
    email: `solicitud-tablet-${sufijo}@ejemplo.invalid`,
    password: `Clave-${sufijo}-Tab1`,
    email_confirm: true,
    app_metadata: { rol: 'DEVICE' },
  });
  expect(cuenta.error, 'cuenta').toBeNull();
  const dispositivo = await servicio.from('devices').insert({
    id: ID(1),
    name: 'Tablet de la solicitud',
    temp_series: 200_000 + (Number.parseInt(sufijo.slice(0, 5), 16) % 500_000),
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
    name: 'Producto de la solicitud',
    category_id: categoria.data?.id,
    kind: 'STANDARD',
    charge_unit: 'PIECE',
    list_price_cents: 11_600,
    rule_id: 'PIECE',
  });
  expect(producto.error, 'producto').toBeNull();

  await crearVenta(VENTA, { productoId: ID(5), metodos: ['CASH'] });
  await crearVenta(VENTA_MIXTA, { productoId: ID(5), metodos: ['CASH', 'TRANSFER'] });
  await crearVenta(VENTA_SIN_CLAVES, { productoId: null, metodos: ['TRANSFER'] });
});

describe('solicitar y descargar la factura desde el portal', () => {
  it('con todo en orden emite la factura con folio F, la guarda y se puede descargar', async () => {
    const r = await solicitar(VENTA);
    expect(r.estado).toBe(200);
    const factura = r.cuerpo.invoice as { folio: string; uuid: string };
    expect(factura.folio).toMatch(/^F-\d{4}-\d{4,}$/);
    expect(factura.uuid).not.toBe('');

    const xml = await llamar('descargar-factura', {
      folio: VENTA.folio,
      code: VENTA.code,
      format: 'xml',
    });
    expect(xml.estado).toBe(200);
    expect(xml.cuerpo.filename).toBe(`${factura.folio}.xml`);
    expect(xml.cuerpo.encoding).toBe('utf8');
    expect(String(xml.cuerpo.content)).toContain(factura.uuid);
    expect(String(xml.cuerpo.content)).toContain('Rfc="XAXX010101000"');

    const pdf = await llamar('descargar-factura', {
      folio: VENTA.folio,
      code: VENTA.code,
      format: 'pdf',
    });
    expect(pdf.estado).toBe(200);
    expect(pdf.cuerpo.encoding).toBe('base64');
    expect(atob(String(pdf.cuerpo.content))).toContain('%PDF');
  });

  it('una operación, una factura: la venta ya facturada no admite otra solicitud ni en la consulta', async () => {
    const otra = await solicitar(VENTA);
    expect(otra.estado).toBe(409);
    expect(otra.cuerpo).toEqual({ error: 'NOT_ELIGIBLE', reason: 'ALREADY_INVOICED' });
    const consulta = await llamar('consultar-factura', { folio: VENTA.folio, code: VENTA.code });
    expect(consulta.cuerpo).toEqual({ error: 'NOT_ELIGIBLE', reason: 'ALREADY_INVOICED' });
  });

  it('reenviar el mismo formulario no duplica la factura: devuelve la misma', async () => {
    const venta = { n: 13, folio: `T${String(serie)}-0004`, code: codigo(4) };
    await crearVenta(venta, { productoId: ID(5), metodos: ['TRANSFER'] });
    const requestId = crypto.randomUUID();
    const a = await solicitar(venta, { requestId });
    const b = await solicitar(venta, { requestId });
    expect(a.estado).toBe(200);
    expect(b.estado).toBe(200);
    expect(b.cuerpo).toEqual(a.cuerpo);
  });

  it('sin la casilla del aviso de privacidad no se emite nada', async () => {
    const r = await solicitar(VENTA_MIXTA, { acceptedPrivacy: false });
    expect(r.estado).toBe(400);
    expect(r.cuerpo).toEqual({ error: 'PRIVACY_NOT_ACCEPTED' });
  });

  it('datos fiscales inválidos se rechazan y dicen cuáles campos', async () => {
    const r = await solicitar(VENTA_MIXTA, {
      recipient: { ...receptor, rfc: 'CORTO', regime: '999' },
    });
    expect(r.estado).toBe(400);
    expect(r.cuerpo).toEqual({
      error: 'INVALID_INPUT',
      fields: ['recipient.rfc', 'recipient.regime'],
    });
  });

  it('un pago mixto no se factura solo: la forma de pago la define el contador', async () => {
    const r = await solicitar(VENTA_MIXTA);
    expect(r.estado).toBe(409);
    expect(r.cuerpo).toEqual({ error: 'PAYMENT_FORM_UNDEFINED' });
  });

  it('un concepto sin claves del SAT no se factura', async () => {
    const r = await solicitar(VENTA_SIN_CLAVES);
    expect(r.estado).toBe(409);
    expect(r.cuerpo).toEqual({ error: 'NOT_BILLABLE', reason: 'FISCAL_DATA_MISSING' });
  });

  it('un código que no cuadra responde lo mismo que en la consulta, y no hay archivos sin factura', async () => {
    const mal = await solicitar({ folio: VENTA_MIXTA.folio, code: codigo(77) });
    expect(mal.estado).toBe(404);
    expect(mal.cuerpo).toEqual({ error: 'NOT_AVAILABLE' });
    const sinFactura = await llamar('descargar-factura', {
      folio: VENTA_MIXTA.folio,
      code: VENTA_MIXTA.code,
      format: 'pdf',
    });
    expect(sinFactura.estado).toBe(404);
    const otroCodigo = await llamar('descargar-factura', {
      folio: VENTA.folio,
      code: codigo(78),
      format: 'pdf',
    });
    expect(otroCodigo.cuerpo).toEqual(sinFactura.cuerpo);
  });

  it('un programa (campo trampa lleno) no emite ni descarga', async () => {
    const r = await solicitar(VENTA_MIXTA, { honeypot: 'spam' });
    expect(r.estado).toBe(404);
    const d = await llamar('descargar-factura', {
      folio: VENTA.folio,
      code: VENTA.code,
      format: 'xml',
      honeypot: 'spam',
    });
    expect(d.estado).toBe(404);
  });

  it('peticiones mal formadas no rompen las funciones', async () => {
    expect((await llamar('solicitar-factura', { folio: 'x' })).estado).toBe(400);
    expect(
      (
        await llamar('solicitar-factura', {
          folio: 'a',
          code: 'b',
          requestId: 'no-uuid',
          recipient: {},
        })
      ).estado,
    ).toBe(400);
    expect(
      (await llamar('descargar-factura', { folio: 'a', code: 'b', format: 'doc' })).estado,
    ).toBe(400);
  });

  it('el navegador no puede leer las facturas guardadas ni llamar a sus funciones', async () => {
    const anonimo = crearCliente(ANON);
    expect((await anonimo.from('invoice_requests').select('*')).error).not.toBeNull();
    const archivos = await anonimo.rpc('portal_invoice_files', {
      p_source_type: 'COUNTER_SALE',
      p_source_id: ID(10),
    });
    expect(archivos.error).not.toBeNull();
    const sello = await anonimo.rpc('portal_invoice_mark_stamped', {
      p_request_id: crypto.randomUUID(),
      p_uuid: 'x',
      p_stamped_at: new Date().toISOString(),
      p_recipient: {},
      p_payment_form: '01',
      p_xml: 'x',
      p_pdf_base64: 'x',
    });
    expect(sello.error).not.toBeNull();
  });
});
