import { err, fitWithin, ok, type ImageCompressor } from '@zammir/core';

/** Reduce una foto a JPEG en la tablet con el lienzo del navegador: lado mayor y calidad acotados
 *  [S3-03]. Corre sin internet. Si el navegador no puede leer la imagen, devuelve el error. */
export function canvasImageCompressor(): ImageCompressor {
  return {
    async compress(original, limites) {
      try {
        const imagen = await createImageBitmap(
          new Blob([Uint8Array.from(original.bytes)], { type: original.mimeType }),
        );
        const { width, height } = fitWithin(imagen.width, imagen.height, limites.maxSide);
        const lienzo = new OffscreenCanvas(width, height);
        const contexto = lienzo.getContext('2d');
        if (contexto === null) {
          return err({ code: 'IMAGE_UNREADABLE' });
        }
        contexto.drawImage(imagen, 0, 0, width, height);
        imagen.close();
        const blob = await lienzo.convertToBlob({ type: 'image/jpeg', quality: limites.quality });
        return ok({ bytes: new Uint8Array(await blob.arrayBuffer()), width, height });
      } catch {
        return err({ code: 'IMAGE_UNREADABLE' });
      }
    },
  };
}
