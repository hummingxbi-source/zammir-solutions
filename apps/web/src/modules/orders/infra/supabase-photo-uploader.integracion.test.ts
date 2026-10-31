import { photoPath } from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { nuevoDispositivo } from '../../../shared/infra/sync/servidor-de-pruebas';
import { supabasePhotoUploader } from './supabase-photo-uploader';

// S3-03 · La tablet sube las fotos de la medición al almacenamiento privado del servidor.

const JPEG_MINIMO = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9,
]);

describe('subida de fotos con el servidor real', () => {
  it('una tablet sube una foto, repetir el envío no falla ni la duplica, y otra tablet la puede leer', async () => {
    const tablet = await nuevoDispositivo();
    const otra = await nuevoDispositivo();
    const ruta = photoPath(crypto.randomUUID(), crypto.randomUUID());
    const subir = supabasePhotoUploader(tablet.session);

    expect((await subir.upload(ruta, JPEG_MINIMO)).ok).toBe(true);
    // Un envío anterior que no alcanzó a confirmarse vuelve a salir: cuenta como subido.
    expect((await subir.upload(ruta, JPEG_MINIMO)).ok).toBe(true);

    const leida = await otra.session.storage.from('order-photos').download(ruta);
    expect(leida.error).toBeNull();
    expect((await leida.data?.arrayBuffer())?.byteLength).toBe(JPEG_MINIMO.byteLength);
  });

  it('el almacenamiento rechaza lo que no es una imagen JPEG', async () => {
    const tablet = await nuevoDispositivo();
    const r = await tablet.session.storage
      .from('order-photos')
      .upload(`${crypto.randomUUID()}/x.txt`, new Uint8Array([1, 2, 3]), {
        contentType: 'text/plain',
      });
    expect(r.error).not.toBeNull();
  });

  it('quien no es una tablet registrada no puede subir', async () => {
    const tablet = await nuevoDispositivo();
    const anonimo = tablet.session.storage.from('order-photos');
    await tablet.session.auth.signOut();
    const r = await anonimo.upload(`${crypto.randomUUID()}/y.jpg`, JPEG_MINIMO, {
      contentType: 'image/jpeg',
    });
    expect(r.error).not.toBeNull();
  });
});
