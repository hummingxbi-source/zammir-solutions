import type { SupabaseClient } from '@supabase/supabase-js';
import { err, ok, type PhotoUploader } from '@zammir/core';

const BUCKET = 'order-photos';

/** Sube la foto al almacenamiento privado del servidor. Si ya estaba (un envío anterior que no alcanzó a
 *  confirmarse), cuenta como subida: no se duplica ni se pisa. */
export function supabasePhotoUploader(cliente: SupabaseClient): PhotoUploader {
  return {
    async upload(ruta, bytes) {
      const r = await cliente.storage.from(BUCKET).upload(ruta, bytes, {
        contentType: 'image/jpeg',
        upsert: false,
      });
      if (r.error === null) {
        return ok(undefined);
      }
      const yaEsta = (r.error as { statusCode?: string }).statusCode === '409';
      return yaEsta ? ok(undefined) : err({ code: 'UPLOAD_UNAVAILABLE' });
    },
  };
}
