import { expect, test, type Page } from '@playwright/test';

// La misma estructura y clases que `EditorDeCotizacion`: lo que se prueba es la hoja de estilos real
// de la aplicación en las dos orientaciones de la tablet [RNF-28, S2-12, S2-17].
const MUESTRA = `
  <section id="muestra" class="cotizador">
    <div class="pestanas" role="tablist">
      <button class="boton boton--secundario" role="tab">Datos</button>
      <button class="boton boton--secundario" role="tab">Vista previa</button>
    </div>
    <div class="cotizador__paneles" data-pestana="datos">
      <div class="cotizador__datos">
        <div class="campo">
          <label class="campo__etiqueta" for="ancho-m">Ancho (cm)</label>
          <input id="ancho-m" class="campo__entrada" inputmode="decimal" />
        </div>
        <div class="campo">
          <label class="campo__etiqueta" for="alto-m">Alto (cm)</label>
          <input id="alto-m" class="campo__entrada" inputmode="decimal" />
        </div>
        <button class="boton">Agregar a la cotización</button>
        <ul class="lineas"><li>Vidrio claro 6 mm · 120 cm × 80 cm × 2 = 1.92 m² × $280.00 = $537.60</li></ul>
      </div>
      <div class="cotizador__vista">
        <article class="documento"><h3>Cotización</h3><p>Total $537.60</p></article>
      </div>
    </div>
  </section>`;

async function montar(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((html) => {
    document.body.insertAdjacentHTML('beforeend', html);
  }, MUESTRA);
}

function visible(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    return el !== null && getComputedStyle(el).display !== 'none';
  }, selector);
}

test('en horizontal van lado a lado, sin pestañas, y en vertical una pestaña a la vez', async ({
  page,
}) => {
  await montar(page);
  const ancho = page.viewportSize()?.width ?? 0;
  if (ancho >= 900) {
    expect(await visible(page, '#muestra .cotizador__datos')).toBe(true);
    expect(await visible(page, '#muestra .cotizador__vista')).toBe(true);
    expect(await visible(page, '#muestra .pestanas')).toBe(false);
    const [datos, vista] = await page.evaluate(() =>
      ['.cotizador__datos', '.cotizador__vista'].map((s) => {
        const caja = document.querySelector(`#muestra ${s}`)?.getBoundingClientRect();
        return { x: caja?.x ?? -1, y: caja?.y ?? -1 };
      }),
    );
    expect(vista?.x ?? 0).toBeGreaterThan(datos?.x ?? 0);
    expect(Math.abs((vista?.y ?? 0) - (datos?.y ?? 0))).toBeLessThan(2);
  } else {
    expect(await visible(page, '#muestra .pestanas')).toBe(true);
    expect(await visible(page, '#muestra .cotizador__datos')).toBe(true);
    expect(await visible(page, '#muestra .cotizador__vista')).toBe(false);
  }
});

test('ninguna orientación recorta el contenido ni agrega desplazamiento horizontal', async ({
  page,
}) => {
  await montar(page);
  const medidas = await page.evaluate(() => ({
    contenido: document.documentElement.scrollWidth,
    pantalla: document.documentElement.clientWidth,
  }));
  expect(medidas.contenido).toBeLessThanOrEqual(medidas.pantalla);
});

test('botones, pestañas y campos del cotizador miden al menos 44 px con texto de 16 px', async ({
  page,
}) => {
  await montar(page);
  const medidas = await page.evaluate(() =>
    [...document.querySelectorAll('#muestra .boton, #muestra .campo__entrada')]
      .filter((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0)
      .map((e) => {
        const caja = e.getBoundingClientRect();
        return {
          nombre: e.textContent || e.id,
          alto: caja.height,
          fuente: parseFloat(getComputedStyle(e).fontSize),
        };
      }),
  );
  expect(medidas.length).toBeGreaterThan(0);
  for (const m of medidas) {
    expect(m.alto, m.nombre).toBeGreaterThanOrEqual(44);
    expect(m.fuente, m.nombre).toBeGreaterThanOrEqual(16);
  }
});
