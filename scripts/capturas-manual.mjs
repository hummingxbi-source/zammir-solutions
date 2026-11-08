// Genera las capturas del manual de usuario (docs/manuales/capturas) [S4-29].
// Recorre la aplicación como lo haría una persona, contra Supabase LOCAL y con datos INVENTADOS: nunca toca datos
// reales ni producción. No forma parte de la compuerta de calidad; se corre a mano cuando cambia la interfaz:
//   pnpm db:start && pnpm db:reset
//   pnpm --filter @zammir/web build && pnpm --filter @zammir/web exec vite preview --port 4180 --strictPort
//   pnpm manual:capturas
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createRequire } from 'node:module';

// El cliente de Supabase es dependencia de la aplicación web, no de la raíz.
const { createClient } = createRequire(new URL('../apps/web/package.json', import.meta.url))(
  '@supabase/supabase-js',
);

const BASE = process.env.ZAMMIR_MANUAL_URL ?? 'http://localhost:4180';
const DESTINO = new URL('../docs/manuales/capturas/', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO, { recursive: true });

// Las llaves salen de `supabase status` y viven solo en este proceso.
const estado = spawnSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
  shell: true,
  encoding: 'utf8',
});
const valores = new Map();
for (const linea of estado.stdout.split(/\r?\n/)) {
  const m = /^([A-Z_]+)="?(.*?)"?$/.exec(linea);
  if (m?.[1] !== undefined && m[2] !== undefined) valores.set(m[1], m[2]);
}
const servicio = createClient(valores.get('API_URL'), valores.get('SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ADMIN = { correo: 'marta.solis@ejemplo.invalid', clave: 'Clave-De-Prueba-2026' };
const PERSONAS = [
  { nombre: 'Marta Solís', rol: 'Administrador', pin: '739251' },
  { nombre: 'Ana Pérez', rol: 'Cajero / vendedor', pin: '482716' },
];

async function sembrar() {
  const creada = await servicio.auth.admin.createUser({
    email: ADMIN.correo,
    password: ADMIN.clave,
    email_confirm: true,
    app_metadata: { rol: 'ADMIN' },
  });
  if (creada.error && !/already/i.test(creada.error.message)) throw creada.error;

  const categorias =
    (await servicio.from('product_categories').select('id, sort_order')).data ?? [];
  const cat = (orden) => categorias.find((c) => c.sort_order === orden)?.id ?? categorias[0].id;
  const fiscal = {
    fiscal_product_service_key: '01010101',
    fiscal_unit_key: 'H87',
    fiscal_tax_object: '02',
  };
  const productos = [
    {
      name: 'Vidrio claro 6 mm',
      kind: 'CUSTOM',
      charge_unit: 'SQUARE_METER',
      list_price_cents: 28000,
      rule_id: 'AREA',
      rule_params: { measureStepMm: 50 },
    },
    {
      name: 'Espejo 4 mm',
      kind: 'CUSTOM',
      charge_unit: 'SQUARE_METER',
      list_price_cents: 35000,
      rule_id: 'AREA',
      rule_params: { measureStepMm: 50 },
    },
    {
      name: 'Cristal templado 9 mm',
      kind: 'CUSTOM',
      charge_unit: 'SQUARE_METER',
      list_price_cents: 95000,
      rule_id: 'AREA',
      rule_params: { measureStepMm: 50 },
    },
    {
      name: 'Bisagra de piso',
      kind: 'STANDARD',
      charge_unit: 'PIECE',
      list_price_cents: 120000,
      rule_id: 'PIECE',
      rule_params: {},
    },
    {
      name: 'Jaladera de acero',
      kind: 'STANDARD',
      charge_unit: 'PIECE',
      list_price_cents: 45000,
      rule_id: 'PIECE',
      rule_params: {},
    },
    {
      name: 'Instalación a domicilio',
      kind: 'SERVICE',
      charge_unit: 'SERVICE',
      list_price_cents: 80000,
      rule_id: 'SERVICE',
      rule_params: {},
    },
  ].map((p, i) => ({ ...p, ...fiscal, category_id: cat(i < 3 ? 1 : i < 5 ? 5 : 11) }));
  const ya = (await servicio.from('products').select('id').limit(1)).data ?? [];
  if (ya.length === 0) {
    const r = await servicio.from('products').insert(productos);
    if (r.error) throw r.error;
  }
}

const captura = async (pagina, nombre) => {
  await pagina.evaluate('window.scrollTo(0, 0)');
  await pagina.waitForTimeout(600);
  await pagina.screenshot({ path: `${DESTINO}${nombre}.png` });
  console.log(`captura: ${nombre}`);
};

await sembrar();
const navegador = await chromium.launch();
const contexto = (extra = {}) =>
  navegador.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    ...extra,
  });

// ---------- Administrador: personas y código de tablet ----------
const admin = await (await contexto()).newPage();
await admin.goto(`${BASE}/usuarios`);
await admin.getByLabel('Correo').fill(ADMIN.correo);
await admin.getByLabel('Contraseña').fill(ADMIN.clave);
await admin.getByRole('button', { name: 'Entrar' }).click();
await admin.getByRole('heading', { name: 'Personas del mostrador' }).waitFor();
for (const p of PERSONAS) {
  await admin.getByLabel('Nombre', { exact: true }).first().fill(p.nombre);
  await admin.getByLabel('Rol').selectOption({ label: p.rol });
  await admin.getByLabel('PIN', { exact: true }).first().fill(p.pin);
  await admin.getByRole('button', { name: 'Dar de alta' }).click();
  await admin.getByText(p.nombre).first().waitFor();
}
await captura(admin, '20-usuarios');
await admin.getByRole('button', { name: 'Generar código' }).click();
const codigo = (await admin.locator('.codigo-registro strong').innerText()).trim();
await captura(admin, '21-tablets-codigo');

// ---------- Tablet: conectar, entrar con PIN, cotizar, orden y mostrador ----------
const tablet = await (await contexto()).newPage();
try {
  await tablet.goto(`${BASE}/conectar`);
  await tablet.getByLabel('Código de registro').fill(codigo);
  await tablet.getByLabel(/Nombre de esta tablet/).fill('Mostrador');
  await tablet.getByRole('button', { name: 'Conectar' }).click();
  await tablet.getByText(/quedó conectada/).waitFor();
  await captura(tablet, '00-conectar-tablet');

  async function entrarConPin(persona) {
    await tablet.getByRole('button', { name: persona.nombre }).click();
    for (const d of persona.pin)
      await tablet
        .getByRole('group', { name: 'Teclado numérico' })
        .getByRole('button', { name: d, exact: true })
        .click();
  }

  // La tablet baja el catálogo, las personas y la configuración al conectarse; hay que darle un momento.
  await tablet.goto(`${BASE}/cotizador`);
  await tablet.waitForTimeout(6000);
  await tablet.goto(`${BASE}/cotizador`);
  await tablet.getByRole('link', { name: 'Entrar con PIN' }).click();
  await tablet.getByRole('heading', { name: '¿Quién va a usar la tablet?' }).waitFor();
  await captura(tablet, '01-entrar-con-pin');
  await entrarConPin(PERSONAS[1]);
  await tablet.getByRole('button', { name: 'Entrar', exact: true }).click();
  await tablet.getByText('Hola, Ana.').waitFor();
  await captura(tablet, '02-panel-de-inicio');
  await tablet.getByRole('link', { name: 'Cotizador' }).first().click();
  await tablet.getByRole('button', { name: 'Nueva cotización' }).waitFor();
  await captura(tablet, '03-cotizador-inicio');

  await tablet.getByRole('button', { name: 'Nueva cotización' }).click();
  await tablet.getByRole('button', { name: 'Cliente nuevo' }).click();
  await tablet.getByLabel('Nombre', { exact: true }).fill('Roberto Campos');
  await tablet.getByLabel(/WhatsApp/).fill('5598765432');
  await tablet.getByRole('button', { name: 'Guardar cliente' }).click();
  await tablet.getByLabel('Buscar producto o servicio').fill('Vidrio');
  await tablet
    .getByRole('button', { name: /Vidrio claro 6 mm/ })
    .first()
    .click();
  await tablet.getByLabel('Ancho').fill('120');
  await tablet.getByLabel('Alto').fill('90');
  await tablet.getByLabel('Cantidad').fill('2');
  await tablet.getByRole('button', { name: 'Agregar a la cotización' }).click();
  await tablet.getByLabel('Buscar producto o servicio').fill('Instalación');
  await tablet
    .getByRole('button', { name: /Instalación a domicilio/ })
    .first()
    .click();
  await tablet.getByRole('button', { name: 'Agregar a la cotización' }).click();
  await captura(tablet, '04-cotizacion-en-armado');
  await tablet.getByRole('button', { name: 'Emitir cotización' }).click();
  await tablet.getByRole('button', { name: 'Marcar como aceptada' }).waitFor();
  await captura(tablet, '05-cotizacion-emitida');

  // Aceptar la cotización. Sin recargar: la persona activa vive en memoria.
  await tablet.getByRole('button', { name: 'Marcar como aceptada' }).click();

  // Mostrador: turno de caja y una venta.
  await tablet.getByRole('link', { name: 'Mostrador' }).first().click();
  await tablet.getByLabel('Fondo inicial en el cajón (opcional)').fill('500');
  await captura(tablet, '06-mostrador-sin-turno');
  await tablet.getByRole('button', { name: 'Abrir turno' }).click();
  await tablet.getByLabel('Buscar producto o servicio').fill('Jaladera');
  // Una pieza estándar se agrega al ticket con solo tocarla; lo que va a medida pide ancho y alto.
  await tablet
    .getByRole('button', { name: /Jaladera de acero/ })
    .first()
    .click();
  await tablet.getByText('1 × $450.00 = $450.00').waitFor();
  await captura(tablet, '07-mostrador-ticket');
  await tablet.getByRole('button', { name: 'Cobrar' }).click();
  await captura(tablet, '08-mostrador-cobrar');
  await tablet.getByLabel('Efectivo recibido').fill('500');
  await tablet.getByLabel('Efectivo que se aplica').fill('450');
  await tablet.getByLabel('Transferencia', { exact: true }).fill('0');
  await tablet.getByRole('button', { name: 'Registrar cobro' }).click();
  await tablet.getByText('Venta registrada').waitFor();
  await captura(tablet, '08b-venta-registrada');

  // Orden de trabajo y anticipo.
  await tablet.getByRole('link', { name: 'Órdenes de trabajo' }).first().click();
  await tablet.getByRole('button', { name: 'Crear orden de trabajo' }).waitFor();
  await captura(tablet, '09-ordenes-por-convertir');
  await tablet.getByRole('button', { name: 'Crear orden de trabajo' }).first().click();
  await tablet.getByRole('button', { name: 'Cobrar' }).first().waitFor();
  await captura(tablet, '10-orden-detalle');
  await tablet.getByRole('button', { name: 'Cobrar' }).first().click();
  await tablet.getByLabel('Efectivo recibido').fill('800');
  await tablet.getByLabel('Efectivo que se aplica').fill('702.40');
  await tablet.getByLabel('Transferencia', { exact: true }).fill('0');
  await captura(tablet, '11-cobrar-anticipo');
  await tablet.getByRole('button', { name: 'Registrar cobro' }).click();
  await tablet.getByText('Cobro registrado en la tablet.').waitFor();
  await captura(tablet, '12-anticipo-cobrado');

  // Cuentas por cobrar y corte de caja.
  await tablet.getByRole('link', { name: 'Cuentas por cobrar' }).first().click();
  await tablet.getByRole('heading', { name: 'Cuentas por cobrar' }).waitFor();
  await captura(tablet, '13-cuentas-por-cobrar');
  await tablet.getByRole('link', { name: 'Mostrador' }).first().click();
  await tablet.getByRole('button', { name: 'Cerrar turno' }).click();
  // Fondo 500 + venta de 450 + anticipo de 702.40 en efectivo: el corte sale exacto.
  await tablet.getByLabel('Efectivo contado').fill('1652.40');
  await captura(tablet, '14-cerrar-turno');
  await tablet.getByRole('button', { name: 'Cerrar y calcular el corte' }).click();
  await tablet.getByText('Corte cerrado').waitFor();
  await captura(tablet, '15-corte-de-caja');

  // Reportes: solo los ve un administrador, que entra con su PIN.
  await tablet.getByRole('button', { name: 'Cambiar de usuario' }).click();
  await entrarConPin(PERSONAS[0]);
  await tablet.getByRole('button', { name: 'Entrar', exact: true }).click();
  await tablet.getByText('Hola, Marta.').waitFor();
  await tablet.getByText('Ventas de hoy').first().waitFor();
  await captura(tablet, '16-panel-del-administrador');
  await tablet.getByRole('link', { name: 'Reportes' }).first().click();
  await tablet.waitForURL('**/reportes');
  await tablet.waitForTimeout(2500);
  await captura(tablet, '17-reportes');
} catch (error) {
  // Si un paso falla, deja una imagen de cómo se veía la pantalla para entender por qué.
  await tablet.screenshot({ path: process.env.ZAMMIR_DEBUG ?? 'debug.png' });
  throw error;
}

// ---------- Administrador: lo que se ve en la computadora ----------
// Las operaciones de la tablet llegan al servidor solas; se les da un momento.
await admin.waitForTimeout(4000);
for (const [ruta, titulo, nombre] of [
  ['/clientes', 'Clientes', '22-clientes'],
  ['/catalogo', 'Catálogo', '23-catalogo'],
  ['/configuracion', 'Configuración', '24-configuracion'],
]) {
  await admin.goto(`${BASE}${ruta}`);
  await admin.getByRole('heading', { name: titulo, exact: true }).first().waitFor();
  await captura(admin, nombre);
}
await admin.goto(`${BASE}/facturas`);
await admin
  .getByRole('button', { name: /^Facturar / })
  .first()
  .waitFor();
await captura(admin, '25-facturas-por-facturar');
await admin
  .getByRole('button', { name: /^Facturar / })
  .first()
  .click();
await admin.getByLabel('RFC').fill('XAXX010101000');
await admin.getByLabel('Nombre o razón social').fill('PUBLICO EN GENERAL');
await admin.getByLabel('Código postal fiscal').fill('55900');
await admin.getByLabel('Régimen fiscal').selectOption({ index: 1 });
await admin.getByLabel('Uso de la factura').selectOption({ index: 1 });
await captura(admin, '26-facturar-formulario');
await admin.getByRole('button', { name: 'Timbrar factura' }).click();
await admin.getByText('Factura emitida').first().waitFor();
await captura(admin, '27-factura-emitida');
await admin.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
await admin.getByRole('tab', { name: 'Emitidas' }).click();
await admin.getByText('Vigente').first().waitFor();
await captura(admin, '28-facturas-emitidas');

// ---------- El cliente, desde su teléfono: el portal público de facturas ----------
const telefono = await (await contexto({ viewport: { width: 390, height: 800 } })).newPage();
await telefono.goto(`${BASE}/factura`);
await telefono.waitForTimeout(1500);
await captura(telefono, '29-portal-de-facturas');

await navegador.close();
console.log(`Capturas guardadas en ${DESTINO}`);
