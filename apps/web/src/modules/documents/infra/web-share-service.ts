import { err, ok, type ShareableFile, type ShareService } from '@zammir/core';

/** Lo que usa del navegador, para poder probarlo sin uno real. */
export interface EntornoDeCompartir {
  readonly navigator: Pick<Navigator, 'canShare' | 'share'>;
  readonly abrirEnlace: (url: string) => void;
  readonly descargar: (archivo: ShareableFile) => void;
}

function aFile(archivo: ShareableFile): File {
  return new File([new Uint8Array(archivo.bytes)], archivo.name, { type: archivo.mimeType });
}

/** Compartir con el menú del dispositivo (Web Share API) y, de respaldo, WhatsApp por enlace y descarga
 *  del PDF [RF-M2-06, ADR-0005]. */
export function webShareService(entorno: EntornoDeCompartir): ShareService {
  return {
    canShareFile(archivo) {
      // `canShare` no existe en todos los navegadores; sin él no se comparten archivos.
      if (typeof entorno.navigator.canShare !== 'function') {
        return false;
      }
      return entorno.navigator.canShare({ files: [aFile(archivo)] });
    },
    async shareFile(archivo, mensaje) {
      try {
        await entorno.navigator.share({
          files: [aFile(archivo)],
          text: mensaje,
          title: archivo.name,
        });
        return ok(undefined);
      } catch (error) {
        // El usuario cerró el menú: no es un fallo.
        if (error instanceof DOMException && error.name === 'AbortError') {
          return err({ code: 'SHARE_CANCELLED' });
        }
        return err({ code: 'SHARE_UNAVAILABLE' });
      }
    },
    openLink: entorno.abrirEnlace,
    download: entorno.descargar,
  };
}

/** Entorno real del navegador. */
export function entornoDelNavegador(): EntornoDeCompartir {
  return {
    navigator,
    abrirEnlace: (url) => {
      window.open(url, '_blank', 'noopener');
    },
    descargar: (archivo) => {
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(archivo.bytes)], { type: archivo.mimeType }),
      );
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = archivo.name;
      enlace.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 10_000);
    },
  };
}
