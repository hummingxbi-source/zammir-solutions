import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId } from '../../../shared-kernel/id';
import { err, ok } from '../../../shared-kernel/result';
import type { QuoteActor } from '../../quotes/application/quote-use-cases';
import type { WorkOrder } from '../domain/work-order';
import {
  attachOrderPhoto,
  fitWithin,
  inMemoryPhotoStore,
  photoPath,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_PER_ORDER,
  PHOTO_MAX_SIDE_PX,
  uploadPendingPhotos,
  type AttachPhotoDeps,
  type ImageCompressor,
} from './order-photos';
import type { WorkOrderStore } from './work-order-store';

const cajero: QuoteActor = { userId: asId<'User'>('u1'), role: 'STAFF' };
const ORDEN = 'o1';

let contador = 0;
const ids = {
  newId: <E extends string>() => {
    contador += 1;
    return asId<E>(`foto-${String(contador)}`);
  },
};

function ordenes(estado: WorkOrder['status'] | null = 'WAITING'): WorkOrderStore {
  const orden = estado === null ? null : ({ id: ORDEN, status: estado } as unknown as WorkOrder);
  return {
    get: () => Promise.resolve(orden),
    save: () => Promise.resolve(),
    list: () => Promise.resolve(orden === null ? [] : [orden]),
    listByCustomer: () => Promise.resolve([]),
  };
}

const compresorDe = (bytes: number): ImageCompressor => ({
  compress: () => Promise.resolve(ok({ bytes: new Uint8Array(bytes), width: 1600, height: 1200 })),
});

function entorno(opciones: { estado?: WorkOrder['status'] | null; bytes?: number } = {}) {
  const photos = inMemoryPhotoStore();
  const deps: AttachPhotoDeps = {
    orders: ordenes(opciones.estado === undefined ? 'WAITING' : opciones.estado),
    photos,
    compressor: compresorDe(opciones.bytes ?? 200_000),
    idGenerator: ids,
    clock: fixedClock(new Date('2026-10-31T18:00:00.000Z')),
  };
  return { deps, photos };
}

const original = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' };

describe('tamaño de las fotos', () => {
  it('una foto grande se reduce a que su lado mayor mida el máximo, sin deformarse', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it('una foto chica no se agranda', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('propiedad: nunca pasa del máximo, nunca es de cero y conserva la proporción', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12_000 }),
        fc.integer({ min: 1, max: 12_000 }),
        (w, h) => {
          const r = fitWithin(w, h);
          expect(Math.max(r.width, r.height)).toBeLessThanOrEqual(PHOTO_MAX_SIDE_PX);
          expect(r.width).toBeGreaterThanOrEqual(1);
          expect(r.height).toBeGreaterThanOrEqual(1);
          // La proporción se conserva salvo el redondeo de cada lado a un píxel entero.
          expect(Math.abs(r.width * h - r.height * w)).toBeLessThanOrEqual(w + h);
        },
      ),
    );
  });
});

describe('adjuntar una foto a la orden', () => {
  it('la guarda en la tablet, pendiente de subir, y no toca la cola de operaciones', async () => {
    const { deps, photos } = entorno();
    const r = await attachOrderPhoto(deps, cajero, ORDEN, original);
    expect(r.ok && r.value.status).toBe('PENDING');
    expect(r.ok && r.value.sizeBytes).toBe(200_000);
    expect(r.ok && r.value.userId).toBe('u1');
    expect(await photos.listByOrder(ORDEN)).toHaveLength(1);
  });

  it('respeta el límite de tamaño: una foto que sigue pesando de más se rechaza y no se guarda', async () => {
    const { deps, photos } = entorno({ bytes: PHOTO_MAX_BYTES + 1 });
    const r = await attachOrderPhoto(deps, cajero, ORDEN, original);
    expect(!r.ok && r.error.code).toBe('PHOTO_TOO_LARGE');
    expect(await photos.listByOrder(ORDEN)).toHaveLength(0);
  });

  it('una imagen que no se puede leer se rechaza', async () => {
    const { deps } = entorno();
    const r = await attachOrderPhoto(
      {
        ...deps,
        compressor: { compress: () => Promise.resolve(err({ code: 'IMAGE_UNREADABLE' })) },
      },
      cajero,
      ORDEN,
      original,
    );
    expect(!r.ok && r.error.code).toBe('IMAGE_UNREADABLE');
  });

  it('hay un máximo de fotos por orden', async () => {
    const { deps } = entorno();
    for (let i = 0; i < PHOTO_MAX_PER_ORDER; i += 1) {
      expect((await attachOrderPhoto(deps, cajero, ORDEN, original)).ok).toBe(true);
    }
    const otra = await attachOrderPhoto(deps, cajero, ORDEN, original);
    expect(!otra.ok && otra.error.code).toBe('TOO_MANY_PHOTOS');
  });

  it('no se adjunta a una orden que no existe o está cancelada, ni sin persona activa', async () => {
    const sin = await attachOrderPhoto(entorno({ estado: null }).deps, cajero, ORDEN, original);
    expect(!sin.ok && sin.error.code).toBe('NOT_FOUND');
    const cancelada = await attachOrderPhoto(
      entorno({ estado: 'CANCELLED' }).deps,
      cajero,
      ORDEN,
      original,
    );
    expect(!cancelada.ok && cancelada.error.code).toBe('ORDER_CANCELLED');
    const nadie = await attachOrderPhoto(
      entorno().deps,
      { userId: cajero.userId, role: null },
      ORDEN,
      original,
    );
    expect(!nadie.ok && nadie.error.code).toBe('NOT_AUTHORIZED');
  });
});

describe('subir las fotos al volver la conexión', () => {
  it('sube las pendientes y las marca; la siguiente vez no sube nada', async () => {
    const { deps, photos } = entorno();
    await attachOrderPhoto(deps, cajero, ORDEN, original);
    await attachOrderPhoto(deps, cajero, ORDEN, original);
    const subidas: string[] = [];
    const uploader = {
      upload: (ruta: string) => {
        subidas.push(ruta);
        return Promise.resolve(ok(undefined));
      },
    };
    expect(await uploadPendingPhotos({ photos, uploader })).toEqual({ uploaded: 2, failed: 0 });
    expect(subidas.every((r) => r.startsWith(`${ORDEN}/`) && r.endsWith('.jpg'))).toBe(true);
    expect(await uploadPendingPhotos({ photos, uploader })).toEqual({ uploaded: 0, failed: 0 });
  });

  it('sin conexión se quedan pendientes y se reintentan; una falla no frena a las demás', async () => {
    const { deps, photos } = entorno();
    const a = await attachOrderPhoto(deps, cajero, ORDEN, original);
    await attachOrderPhoto(deps, cajero, ORDEN, original);
    let primera = true;
    const uploader = {
      upload: () => {
        const falla = primera;
        primera = false;
        return Promise.resolve(
          falla ? err({ code: 'UPLOAD_UNAVAILABLE' as const }) : ok(undefined),
        );
      },
    };
    expect(await uploadPendingPhotos({ photos, uploader })).toEqual({ uploaded: 1, failed: 1 });
    expect(await photos.pending()).toHaveLength(1);
    expect((await photos.pending())[0]?.id).toBe(a.ok ? a.value.id : '');
  });

  it('la ruta lleva la orden y la foto, nada personal', () => {
    expect(photoPath('o1', 'f1')).toBe('o1/f1.jpg');
  });
});
