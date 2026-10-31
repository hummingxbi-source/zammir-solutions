import { documentoDePrueba, documentRendererContract } from '@zammir/core/testing';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { pdfLibRenderer } from './pdf-lib-renderer';

// Cargar pdf.js tarda varios segundos y, con todo el conjunto de pruebas corriendo a la vez, puede pasar
// del límite de 5 s: este archivo lo carga antes y pide más margen solo para él.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });
beforeAll(async () => {
  await import('pdfjs-dist/legacy/build/pdf.mjs');
});

// Se lee el PDF con pdf.js, por un camino independiente del que lo generó.
async function abrir(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const tarea = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    verbosity: 0,
  });
  return tarea.promise;
}

async function textoDe(bytes: Uint8Array): Promise<string> {
  const doc = await abrir(bytes);
  const partes: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const pagina = await doc.getPage(n);
    const contenido = await pagina.getTextContent();
    partes.push(contenido.items.map((i) => ('str' in i ? i.str : '')).join(' '));
  }
  return partes.join(' ');
}

documentRendererContract('PDF (pdf-lib)', () => ({
  renderer: pdfLibRenderer(),
  textOf: textoDe,
  pagesOf: async (bytes) => (await abrir(bytes)).numPages,
}));

describe('pdfLibRenderer', () => {
  it('genera un PDF de tamaño carta', async () => {
    const r = await pdfLibRenderer().render(documentoDePrueba());
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(new TextDecoder().decode(r.value.slice(0, 5))).toBe('%PDF-');
    const doc = await abrir(r.value);
    const pagina = await doc.getPage(1);
    const [, , ancho, alto] = pagina.view;
    expect([ancho, alto]).toEqual([612, 792]);
  });

  it('numera las páginas', async () => {
    const r = await pdfLibRenderer().render(documentoDePrueba(60));
    if (!r.ok) {
      throw new Error('no se generó');
    }
    const texto = await textoDe(r.value);
    expect(texto).toMatch(/Página 1 de [2-9]/);
    expect(texto).toMatch(/Página 2 de /);
  });

  it('un carácter que la fuente no dibuja no tira el documento', async () => {
    const r = await pdfLibRenderer().render(
      documentoDePrueba(1, { customer: { name: 'Cliente 😀 ≈ 中', phone: '5512345678' } }),
    );
    expect(r.ok).toBe(true);
  });

  it('el logo (PNG) se incrusta', async () => {
    // PNG de 1×1 píxel.
    const png = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      ),
      (c) => c.charCodeAt(0),
    );
    const doc = documentoDePrueba(1);
    const r = await pdfLibRenderer().render({
      ...doc,
      business: { ...doc.business, logo: { bytes: png, format: 'png' } },
    });
    expect(r.ok).toBe(true);
  });

  it('una cotización típica (10 líneas) se genera en menos de 3 segundos [RNF-25]', async () => {
    const inicio = performance.now();
    const r = await pdfLibRenderer().render(documentoDePrueba(10));
    const duracion = performance.now() - inicio;
    expect(r.ok).toBe(true);
    // En CI se vigila una cota holgada; la medición real es en la tablet.
    expect(duracion).toBeLessThan(3000);
  });
});
