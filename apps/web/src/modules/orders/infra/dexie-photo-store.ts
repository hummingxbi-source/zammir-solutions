import Dexie, { type EntityTable } from 'dexie';
import type { OrderPhoto, PhotoStore } from '@zammir/core';

type Fila = OrderPhoto & { readonly bytes: Uint8Array };

class BaseDeFotos extends Dexie {
  fotos!: EntityTable<Fila, 'id'>;
  constructor(nombre: string) {
    super(nombre);
    this.version(1).stores({ fotos: 'id, orderId, status' });
  }
}

function sinBytes({ bytes: _bytes, ...foto }: Fila): OrderPhoto {
  return foto;
}

/** Fotos de la medición guardadas en la tablet (IndexedDB), con sus bytes, hasta que se suben. */
export function dexiePhotoStore(nombre = 'zammir-fotos'): PhotoStore {
  const base = new BaseDeFotos(nombre);
  return {
    async put(foto, bytes) {
      await base.fotos.put({ ...foto, bytes });
    },
    async listByOrder(orderId) {
      return (await base.fotos.where('orderId').equals(orderId).sortBy('takenAt')).map(sinBytes);
    },
    async bytesOf(id) {
      return (await base.fotos.get(id))?.bytes ?? null;
    },
    async pending() {
      return (await base.fotos.where('status').equals('PENDING').toArray()).map(sinBytes);
    },
    async markUploaded(id) {
      await base.fotos.update(id, { status: 'UPLOADED' });
    },
  };
}
