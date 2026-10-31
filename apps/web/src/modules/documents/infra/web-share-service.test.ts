import { describe, expect, it, vi } from 'vitest';

import { webShareService, type EntornoDeCompartir } from './web-share-service';

const archivo = {
  name: 'Cotizacion-T1-0004.pdf',
  mimeType: 'application/pdf',
  bytes: Uint8Array.of(1, 2, 3),
};

function entorno(parcial: Partial<Pick<Navigator, 'canShare' | 'share'>>) {
  const abrir = vi.fn();
  const descargar = vi.fn();
  const e: EntornoDeCompartir = {
    navigator: parcial as Pick<Navigator, 'canShare' | 'share'>,
    abrirEnlace: abrir,
    descargar,
  };
  return { e, abrir, descargar };
}

describe('webShareService', () => {
  it('puede compartir archivos cuando el navegador lo permite', () => {
    const { e } = entorno({ canShare: () => true, share: () => Promise.resolve() });
    expect(webShareService(e).canShareFile(archivo)).toBe(true);
  });

  it('no puede si el navegador dice que no o ni siquiera tiene canShare', () => {
    expect(webShareService(entorno({ canShare: () => false }).e).canShareFile(archivo)).toBe(false);
    expect(webShareService(entorno({}).e).canShareFile(archivo)).toBe(false);
  });

  it('comparte el PDF con el mensaje', async () => {
    const share = vi.fn(() => Promise.resolve());
    const { e } = entorno({ canShare: () => true, share });
    const r = await webShareService(e).shareFile(archivo, 'Hola');
    expect(r.ok).toBe(true);
    const llamada = (share.mock.calls[0] as unknown as [ShareData])[0];
    expect(llamada.text).toBe('Hola');
    expect(llamada.files?.[0]?.name).toBe('Cotizacion-T1-0004.pdf');
    expect(llamada.files?.[0]?.type).toBe('application/pdf');
  });

  it('si la persona cierra el menú, no es un fallo', async () => {
    const { e } = entorno({
      canShare: () => true,
      share: () => Promise.reject(new DOMException('cerrado', 'AbortError')),
    });
    const r = await webShareService(e).shareFile(archivo, 'Hola');
    expect(!r.ok && r.error.code).toBe('SHARE_CANCELLED');
  });

  it('otro error del menú se reporta como no disponible', async () => {
    const { e } = entorno({ canShare: () => true, share: () => Promise.reject(new Error('x')) });
    const r = await webShareService(e).shareFile(archivo, 'Hola');
    expect(!r.ok && r.error.code).toBe('SHARE_UNAVAILABLE');
  });

  it('el respaldo abre el enlace y descarga el archivo', () => {
    const { e, abrir, descargar } = entorno({});
    const s = webShareService(e);
    s.openLink('https://wa.me/525512345678?text=Hola');
    s.download(archivo);
    expect(abrir).toHaveBeenCalledWith('https://wa.me/525512345678?text=Hola');
    expect(descargar).toHaveBeenCalledWith(archivo);
  });
});
