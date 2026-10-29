import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// El HTML usa las mismas clases que los componentes de shared/ui (el contrato visual).
const MUESTRA = `
  <section id="muestra">
    <button class="boton">Guardar</button>
    <button class="boton boton--secundario">Volver</button>
    <button class="boton boton--peligro">Cancelar venta</button>
    <div class="campo">
      <label class="campo__etiqueta" for="ancho">Ancho</label>
      <input id="ancho" class="campo__entrada" inputmode="decimal" />
    </div>
    <div class="aviso aviso--error anima-entrada" role="alert">
      <div>No se pudo enviar</div>
      <p class="aviso__que-hacer">Revisa la conexión e intenta de nuevo</p>
    </div>
  </section>`;

async function montarMuestra(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((html) => {
    document.body.insertAdjacentHTML('beforeend', html);
  }, MUESTRA);
}

async function nombreDeAnimacion(page: Page): Promise<string> {
  return page.evaluate(() => {
    const aviso = document.querySelector('#muestra .aviso');
    if (aviso === null) {
      throw new Error('No se encontró el aviso de la muestra');
    }
    return getComputedStyle(aviso).animationName;
  });
}

test('botones y campos miden al menos 44 px y el texto al menos 16 px [RNF-28]', async ({
  page,
}) => {
  await montarMuestra(page);
  const medidas = await page.evaluate(() =>
    [...document.querySelectorAll('#muestra .boton, #muestra .campo__entrada')].map((elemento) => {
      const caja = elemento.getBoundingClientRect();
      return {
        nombre: elemento.textContent || elemento.id,
        alto: caja.height,
        ancho: caja.width,
        fuente: parseFloat(getComputedStyle(elemento).fontSize),
      };
    }),
  );
  expect(medidas.length).toBeGreaterThan(0);
  for (const medida of medidas) {
    expect(medida.alto, medida.nombre).toBeGreaterThanOrEqual(44);
    expect(medida.ancho, medida.nombre).toBeGreaterThanOrEqual(44);
    expect(medida.fuente, medida.nombre).toBeGreaterThanOrEqual(16);
  }
});

test('con "reducir movimiento" no hay animaciones [RF-UX-09]', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await montarMuestra(page);
  const nombre = await nombreDeAnimacion(page);
  expect(nombre).toBe('none');
});

test('sin preferencia, la entrada sí se anima', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await montarMuestra(page);
  const nombre = await nombreDeAnimacion(page);
  expect(nombre).toBe('aparecer');
});

test('los componentes no tienen violaciones graves de accesibilidad ni de contraste', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await montarMuestra(page);
  const resultado = await new AxeBuilder({ page }).include('#muestra').analyze();
  const graves = resultado.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(graves).toEqual([]);
});
