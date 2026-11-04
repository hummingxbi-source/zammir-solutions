import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Identidad visual v1 [ADR-0028]: marco con barra lateral, fuentes que viajan con la aplicación, sin
// desplazamiento de lado en el celular y contraste de los componentes nuevos, medido en el navegador real.

const MUESTRA = `
  <section id="muestra" style="padding:16px">
    <header class="pagina-encabezado">
      <div class="pagina-encabezado__texto">
        <p class="rotulo pagina-encabezado__rotulo">Orden OT-2026-0003</p>
        <h2 class="pagina-encabezado__titulo">Cancel de baño</h2>
        <p class="pagina-encabezado__descripcion">Entrega estimada el 20 de noviembre.</p>
      </div>
    </header>
    <section class="tarjeta" aria-labelledby="t1">
      <header class="tarjeta__cabecera"><h3 id="t1" class="rotulo tarjeta__rotulo">Ventas del día</h3></header>
      <dl class="indicador indicador--exito">
        <dt class="rotulo indicador__rotulo">Hoy</dt>
        <dd class="cifra indicador__valor">$1,240.00</dd>
        <dd class="indicador__detalle">3 ventas</dd>
      </dl>
    </section>
    <p>
      <span class="etiqueta-estado etiqueta-estado--espera"><span class="etiqueta-estado__punto" aria-hidden="true"></span>En espera</span>
      <span class="etiqueta-estado etiqueta-estado--proceso"><span class="etiqueta-estado__punto" aria-hidden="true"></span>En proceso</span>
      <span class="etiqueta-estado etiqueta-estado--listo"><span class="etiqueta-estado__punto" aria-hidden="true"></span>Listo</span>
      <span class="etiqueta-estado etiqueta-estado--entregado"><span class="etiqueta-estado__punto" aria-hidden="true"></span>Entregado</span>
      <span class="etiqueta-estado etiqueta-estado--cancelado"><span class="etiqueta-estado__punto" aria-hidden="true"></span>Cancelado</span>
    </p>
    <p><span class="comparacion comparacion--exito">Sube 12.50 %</span> <span class="comparacion comparacion--peligro">Baja 5.00 %</span></p>
    <div class="aviso-cerrable aviso-cerrable--info" role="status"><p class="aviso-cerrable__texto">Revisa primero tu catálogo.</p></div>
    <div class="aviso-cerrable aviso-cerrable--aviso" role="status"><p class="aviso-cerrable__texto">Hay 3 operaciones sin enviar.</p></div>
    <div class="aviso aviso--error" role="alert"><div>No se pudo enviar</div><p class="aviso__que-hacer">Revisa la conexión.</p></div>
    <div class="aviso aviso--exito" role="status"><div>Guardado en la tablet</div></div>
    <div class="estado-vacio"><p class="estado-vacio__titulo">Sin cotizaciones</p><p class="estado-vacio__descripcion">Haz la primera desde el Cotizador.</p></div>
    <table class="tabla tabla--apilada" aria-label="Cuentas">
      <thead><tr><th scope="col">Cliente</th><th scope="col" class="tabla__num">Saldo</th></tr></thead>
      <tbody><tr class="fila--atrasada"><th scope="row">Ana</th><td data-label="Saldo" class="tabla__num">$100.00 <strong>Atrasada</strong></td></tr></tbody>
    </table>
    <ul class="barras" aria-label="Cobros">
      <li class="barras__fila"><span class="barras__etiqueta">Ana</span><span class="barras__pista" aria-hidden="true"><span class="barras__barra" style="inline-size:100%"></span></span><span class="barras__valor">$200.00</span></li>
    </ul>
    <div class="segmentos" role="tablist" aria-label="Vistas">
      <button class="segmento" role="tab" aria-selected="true">Datos</button>
      <button class="segmento" role="tab" aria-selected="false" tabindex="-1">Vista previa</button>
    </div>
  </section>`;

async function montar(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((html) => {
    document.querySelector('.marco__contenido')?.insertAdjacentHTML('beforeend', html);
  }, MUESTRA);
}

test('las fuentes de la identidad se cargan desde la propia aplicación', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const cargadas = await page.evaluate(() => ({
    titulo: document.fonts.check('700 16px Fraunces'),
    lectura: document.fonts.check('400 16px "Source Serif 4"'),
    etiqueta: document.fonts.check('500 14px "IBM Plex Mono"'),
  }));
  expect(cargadas).toEqual({ titulo: true, lectura: true, etiqueta: true });
  const externas = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .filter((n) => /fonts\.(googleapis|gstatic)\.com/.test(n)),
  );
  expect(externas).toEqual([]);
});

test('las fuentes quedan guardadas para abrir sin internet', async ({ request }) => {
  const respuesta = await request.get('/sw.js');
  expect(respuesta.ok()).toBe(true);
  expect(await respuesta.text()).toContain('woff2');
});

test('los componentes nuevos no tienen violaciones graves ni de contraste', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await montar(page);
  const resultado = await new AxeBuilder({ page }).include('#muestra').analyze();
  const graves = resultado.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
});

test('el panel de inicio y el marco tampoco tienen violaciones graves ni de contraste', async ({
  page,
}) => {
  await page.goto('/');
  const resultado = await new AxeBuilder({ page }).analyze();
  const graves = resultado.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(graves.map((v) => v.id)).toEqual([]);
});

test.describe('tablet horizontal y computadora', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('la barra lateral queda a la izquierda y fija mientras se desplaza el contenido', async ({
    page,
  }) => {
    await page.goto('/');
    const barra = page.locator('aside.barra');
    const caja = await barra.boundingBox();
    expect(caja?.x).toBe(0);
    expect(caja?.width).toBeGreaterThan(240);
    expect(caja?.width).toBeLessThan(300);
    const contenido = await page.locator('.marco__cuerpo').boundingBox();
    expect(contenido?.x).toBeGreaterThanOrEqual((caja?.width ?? 0) - 1);
    await expect(page.getByText('Flujo de trabajo')).toBeVisible();
    await expect(page.getByText('Administración')).toBeVisible();
  });
});

test.describe('tablet vertical', () => {
  test.use({ viewport: { width: 800, height: 1280 } });

  test('la barra pasa arriba, a todo lo ancho, y la página no se desplaza de lado', async ({
    page,
  }) => {
    await page.goto('/');
    const barra = await page.locator('aside.barra').boundingBox();
    const cuerpo = await page.locator('.marco__cuerpo').boundingBox();
    expect(barra?.width).toBeGreaterThan(700);
    expect((barra?.y ?? 0) + (barra?.height ?? 0)).toBeLessThanOrEqual((cuerpo?.y ?? 0) + 1);
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborda).toBe(false);
  });
});

test.describe('teléfono', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('el inicio y los componentes se leen sin desplazamiento horizontal', async ({ page }) => {
    await montar(page);
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborda).toBe(false);
  });

  test('las tablas se apilan: la cabecera se oculta y cada celda lleva su rótulo', async ({
    page,
  }) => {
    await montar(page);
    const celda = page.locator('#muestra td[data-label="Saldo"]');
    const estilos = await celda.evaluate((el) => {
      const antes = getComputedStyle(el, '::before');
      return { contenido: antes.content, visualizacion: getComputedStyle(el).display };
    });
    expect(estilos.contenido).toContain('Saldo');
    expect(estilos.visualizacion).toBe('flex');
  });
});
