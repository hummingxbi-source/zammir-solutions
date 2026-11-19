import { documentoDePrueba } from '@zammir/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  htmlDocumentPrinter,
  htmlSheetPrinter,
  imprimirHtmlDesdeElNavegador,
} from './html-document-printer';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('impresión del documento', () => {
  it('manda a imprimir la página del documento y avisa que se abrió la impresión', async () => {
    const imprimirHtml = vi.fn(() => Promise.resolve());
    const impresora = htmlDocumentPrinter({ imprimirHtml }, 'COPIA');
    const r = await impresora.print(documentoDePrueba(1));
    expect(r.ok).toBe(true);
    expect(imprimirHtml).toHaveBeenCalledTimes(1);
    const html = String((imprimirHtml.mock.calls as unknown as string[][])[0]?.[0]);
    expect(html).toContain('COT-2026-0012');
    expect(html).not.toContain('class="marca"');
  });

  it('una reimpresión lleva la marca de copia', async () => {
    const imprimirHtml = vi.fn(() => Promise.resolve());
    await htmlDocumentPrinter({ imprimirHtml }, 'COPIA').print(documentoDePrueba(1), {
      copia: true,
    });
    expect(String((imprimirHtml.mock.calls as unknown as string[][])[0]?.[0])).toContain(
      '<span class="marca">COPIA</span>',
    );
  });

  it('sin impresión en el navegador responde que no está disponible', async () => {
    const r = await htmlDocumentPrinter(undefined, 'COPIA').print(documentoDePrueba(1));
    expect(r).toEqual({ ok: false, error: { code: 'PRINT_UNAVAILABLE' } });
  });

  it('si el navegador falla, responde que no se pudo imprimir y no se rompe', async () => {
    const r = await htmlDocumentPrinter(
      { imprimirHtml: () => Promise.reject(new Error('sin impresora')) },
      'COPIA',
    ).print(documentoDePrueba(1));
    expect(r).toEqual({ ok: false, error: { code: 'PRINT_FAILED' } });
  });
});

const DESCRIPTOR = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');

/** jsdom no imprime: se pone un marco falso con el que se ve que se pidió imprimir. */
function ponerVentanaDelMarco(ventanaDelMarco: unknown): void {
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    configurable: true,
    get: () => ventanaDelMarco,
  });
}

afterEach(() => {
  if (DESCRIPTOR !== undefined) {
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', DESCRIPTOR);
  }
});

describe('impresión de la hoja de resumen', () => {
  const hoja = {
    business: { name: 'ZAMMIR', phone: null, address: null },
    title: 'Corte de caja',
    subtitle: null,
    meta: [],
    sections: [],
    note: null,
    pageLabel: 'Página {n} de {total}',
  };

  it('manda la página de la hoja a imprimir', async () => {
    const imprimirHtml = vi.fn(() => Promise.resolve());
    const r = await htmlSheetPrinter({ imprimirHtml }).print(hoja);
    expect(r.ok).toBe(true);
    expect(String((imprimirHtml.mock.calls as unknown as string[][])[0]?.[0])).toContain(
      'Corte de caja',
    );
  });

  it('sin impresión o si falla, responde el error', async () => {
    expect(await htmlSheetPrinter(undefined).print(hoja)).toEqual({
      ok: false,
      error: { code: 'PRINT_UNAVAILABLE' },
    });
    expect(
      await htmlSheetPrinter({ imprimirHtml: () => Promise.reject(new Error('x')) }).print(hoja),
    ).toEqual({ ok: false, error: { code: 'PRINT_FAILED' } });
  });
});

describe('impresión desde el navegador', () => {
  it('pone la página en un marco oculto, la imprime y lo quita al terminar', async () => {
    const imprimir = vi.fn();
    const falsa = Object.assign(new EventTarget(), { focus: vi.fn(), print: imprimir });
    ponerVentanaDelMarco(falsa);

    const promesa = imprimirHtmlDesdeElNavegador(window).imprimirHtml('<p>hola</p>');
    const marco = document.querySelector('iframe');
    expect(marco).not.toBeNull();
    expect(marco?.getAttribute('aria-hidden')).toBe('true');
    expect(marco?.getAttribute('srcdoc')).toBe('<p>hola</p>');
    marco?.dispatchEvent(new Event('load'));
    await promesa;
    expect(imprimir).toHaveBeenCalledTimes(1);

    // Al terminar de imprimir, el marco desaparece.
    falsa.dispatchEvent(new Event('afterprint'));
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('si imprimir lanza un error, rechaza y no deja el marco', async () => {
    ponerVentanaDelMarco(
      Object.assign(new EventTarget(), {
        focus: vi.fn(),
        print: () => {
          throw new Error('no imprime');
        },
      }),
    );
    const promesa = imprimirHtmlDesdeElNavegador(window).imprimirHtml('<p>hola</p>');
    document.querySelector('iframe')?.dispatchEvent(new Event('load'));
    await expect(promesa).rejects.toThrow('no imprime');
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('si el marco no tiene ventana, rechaza', async () => {
    ponerVentanaDelMarco(null);
    const promesa = imprimirHtmlDesdeElNavegador(window).imprimirHtml('<p>hola</p>');
    document.querySelector('iframe')?.dispatchEvent(new Event('load'));
    await expect(promesa).rejects.toThrow('NO_FRAME');
    expect(document.querySelector('iframe')).toBeNull();
  });
});
