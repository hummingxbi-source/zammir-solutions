import { describe, expect, it } from 'vitest';

import { err, ok } from '../../../shared-kernel/result';
import { documentoDePrueba } from '../contracts/document-renderer.contract';
import type { DocumentRenderer, ShareableFile, ShareError, ShareService } from './ports';
import { pdfFileName, shareQuote, whatsappUrl } from './share-quote';

function servicio(opciones: { puede: boolean; resultado?: ShareError }) {
  const llamadas: string[] = [];
  let compartido: ShareableFile | null = null;
  const share: ShareService = {
    canShareFile: () => opciones.puede,
    shareFile: (archivo, mensaje) => {
      compartido = archivo;
      llamadas.push(`compartir:${mensaje}`);
      return Promise.resolve(
        opciones.resultado === undefined ? ok(undefined) : err(opciones.resultado),
      );
    },
    openLink: (url) => llamadas.push(`enlace:${url}`),
    download: (archivo) => llamadas.push(`descarga:${archivo.name}`),
  };
  return { share, llamadas, archivo: () => compartido };
}

const mensaje = 'Hola Ana, aquí está tu cotización de Vidriería: ñandú, año, corazón & más 50%';

/** Renderizador de pruebas: devuelve la firma de un PDF; el contenido real se prueba en su contrato. */
function fakeDocumentRenderer(): DocumentRenderer {
  return { render: () => Promise.resolve(ok(Uint8Array.of(0x25, 0x50, 0x44, 0x46))) };
}

describe('whatsappUrl', () => {
  it('lleva la clave de México, el teléfono y el mensaje bien codificado con acentos y ñ', () => {
    const url = whatsappUrl('5512345678', mensaje);
    expect(url.startsWith('https://wa.me/525512345678?text=')).toBe(true);
    expect(decodeURIComponent(url.slice(url.indexOf('?text=') + 6))).toBe(mensaje);
    expect(url).not.toContain(' ');
    expect(url).toContain('%C3%B1'); // ñ
    expect(url).toContain('%26'); // &
    expect(url).toContain('%25'); // %
  });
});

describe('pdfFileName', () => {
  it('usa el folio definitivo si ya se envió y el provisional si no', () => {
    expect(pdfFileName({ folio: 'COT-2026-0012', tempFolio: 'T1-0004' })).toBe(
      'Cotizacion-COT-2026-0012.pdf',
    );
    expect(pdfFileName({ folio: null, tempFolio: 'T1-0004' })).toBe('Cotizacion-T1-0004.pdf');
    expect(pdfFileName({ folio: null, tempFolio: null })).toBe('Cotizacion-borrador.pdf');
  });
});

describe('shareQuote', () => {
  const deps = (
    s: ReturnType<typeof servicio>,
    renderer: DocumentRenderer = fakeDocumentRenderer(),
  ) => ({
    renderer,
    share: s.share,
  });

  it('con soporte para compartir archivos abre el menú del dispositivo con el PDF', async () => {
    const s = servicio({ puede: true });
    const r = await shareQuote(deps(s), documentoDePrueba(), mensaje);
    expect(r).toEqual({ ok: true, value: 'SHARED' });
    expect(s.llamadas).toEqual([`compartir:${mensaje}`]);
    expect(s.archivo()?.name).toBe('Cotizacion-COT-2026-0012.pdf');
    expect(s.archivo()?.mimeType).toBe('application/pdf');
  });

  it('si la persona cierra el menú no se hace nada más', async () => {
    const s = servicio({ puede: true, resultado: { code: 'SHARE_CANCELLED' } });
    const r = await shareQuote(deps(s), documentoDePrueba(), mensaje);
    expect(r).toEqual({ ok: true, value: 'CANCELLED' });
    expect(s.llamadas).toEqual([`compartir:${mensaje}`]);
  });

  it('sin soporte para archivos descarga el PDF y abre WhatsApp con el mensaje', async () => {
    const s = servicio({ puede: false });
    const r = await shareQuote(deps(s), documentoDePrueba(), mensaje);
    expect(r).toEqual({ ok: true, value: 'FALLBACK' });
    expect(s.llamadas).toEqual([
      'descarga:Cotizacion-COT-2026-0012.pdf',
      `enlace:${whatsappUrl('5512345678', mensaje)}`,
    ]);
  });

  it('si el menú falla por otra razón cae al respaldo', async () => {
    const s = servicio({ puede: true, resultado: { code: 'SHARE_UNAVAILABLE' } });
    const r = await shareQuote(deps(s), documentoDePrueba(), mensaje);
    expect(r).toEqual({ ok: true, value: 'FALLBACK' });
    expect(s.llamadas.some((l) => l.startsWith('descarga:'))).toBe(true);
  });

  it('si no se pudo generar el PDF devuelve el error y no comparte nada', async () => {
    const roto: DocumentRenderer = {
      render: () => Promise.resolve(err({ code: 'RENDER_FAILED' })),
    };
    const s = servicio({ puede: true });
    const r = await shareQuote(deps(s, roto), documentoDePrueba(), mensaje);
    expect(r).toEqual({ ok: false, error: { code: 'RENDER_FAILED' } });
    expect(s.llamadas).toEqual([]);
  });

  it('no existe forma de imprimir en tamaño carta en el puerto', () => {
    const s = servicio({ puede: true });
    expect(Object.keys(s.share)).not.toContain('print');
  });
});
