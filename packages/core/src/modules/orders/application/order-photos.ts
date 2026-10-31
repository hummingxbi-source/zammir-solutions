import { err, ok, type Result } from '../../../shared-kernel/result';
import type { Clock } from '../../../shared-kernel/clock';
import type { IdGenerator } from '../../../shared-kernel/id';
import { defaultPermissionPolicy, type PermissionPolicy } from '../../identity/domain/permissions';
import type { QuoteActor } from '../../quotes/application/quote-use-cases';
import type { WorkOrderStore } from './work-order-store';

/** Fotos de la medición [RF-M3-01, SINCRONIZACION §9]. Límites de esta historia (propuestos): se reducen
 *  en la tablet antes de guardarlas para que no pesen en la red del local ni en la tablet. */
export const PHOTO_MAX_SIDE_PX = 1600;
export const PHOTO_JPEG_QUALITY = 0.7;
export const PHOTO_MAX_BYTES = 800 * 1024;
export const PHOTO_MAX_PER_ORDER = 10;

/** Tamaño final de una foto: cabe en un cuadrado de `maxSide`, sin agrandarse ni cambiar la proporción. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number = PHOTO_MAX_SIDE_PX,
): { readonly width: number; readonly height: number } {
  const mayor = Math.max(width, height);
  if (mayor <= maxSide) {
    return { width, height };
  }
  const factor = maxSide / mayor;
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
  };
}

export type PhotoStatus = 'PENDING' | 'UPLOADED';

export interface OrderPhoto {
  readonly id: string;
  readonly orderId: string;
  readonly mimeType: 'image/jpeg';
  readonly sizeBytes: number;
  readonly width: number;
  readonly height: number;
  /** Instante de la foto (ISO, UTC). */
  readonly takenAt: string;
  readonly userId: string;
  readonly status: PhotoStatus;
}

/** Dónde se guardan en la tablet las fotos y sus bytes. */
export interface PhotoStore {
  put(foto: OrderPhoto, bytes: Uint8Array): Promise<void>;
  listByOrder(orderId: string): Promise<readonly OrderPhoto[]>;
  bytesOf(id: string): Promise<Uint8Array | null>;
  pending(): Promise<readonly OrderPhoto[]>;
  markUploaded(id: string): Promise<void>;
}

export interface PhotoUploadError {
  readonly code: 'UPLOAD_UNAVAILABLE';
}

/** A dónde sube la tablet las fotos cuando hay conexión (el servidor). */
export interface PhotoUploader {
  upload(path: string, bytes: Uint8Array): Promise<Result<void, PhotoUploadError>>;
}

/** Reduce una imagen a JPEG dentro de los límites; vive en la capa de infraestructura (usa el navegador). */
export interface ImageCompressor {
  compress(
    original: { readonly bytes: Uint8Array; readonly mimeType: string },
    limits: { readonly maxSide: number; readonly quality: number },
  ): Promise<
    Result<
      { readonly bytes: Uint8Array; readonly width: number; readonly height: number },
      { readonly code: 'IMAGE_UNREADABLE' }
    >
  >;
}

/** Ruta de la foto en el almacenamiento del servidor: la orden y la foto, nada personal. */
export function photoPath(orderId: string, photoId: string): string {
  return `${orderId}/${photoId}.jpg`;
}

export type PhotoErrorCode =
  | 'NOT_AUTHORIZED'
  | 'NOT_FOUND'
  | 'ORDER_CANCELLED'
  | 'TOO_MANY_PHOTOS'
  | 'IMAGE_UNREADABLE'
  | 'PHOTO_TOO_LARGE'
  | 'STORAGE_FAILED';

export interface PhotoError {
  readonly code: PhotoErrorCode;
}

export interface AttachPhotoDeps {
  readonly orders: WorkOrderStore;
  readonly photos: PhotoStore;
  readonly compressor: ImageCompressor;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
  readonly policy?: PermissionPolicy;
}

/** Adjunta una foto de la medición a la orden: la reduce, respeta el límite de tamaño y la guarda en la
 *  tablet. NO toca la cola de operaciones: la foto se sube aparte, cuando haya conexión, sin bloquear nada
 *  de la orden [S3-03]. */
export async function attachOrderPhoto(
  deps: AttachPhotoDeps,
  actor: QuoteActor,
  orderId: string,
  original: { readonly bytes: Uint8Array; readonly mimeType: string },
): Promise<Result<OrderPhoto, PhotoError>> {
  const permisos = deps.policy ?? defaultPermissionPolicy;
  if (permisos.check(actor.role, 'ORDER_ADVANCE') === 'DENY') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const orden = await deps.orders.get(orderId);
  if (orden === null) {
    return err({ code: 'NOT_FOUND' });
  }
  if (orden.status === 'CANCELLED') {
    return err({ code: 'ORDER_CANCELLED' });
  }
  if ((await deps.photos.listByOrder(orderId)).length >= PHOTO_MAX_PER_ORDER) {
    return err({ code: 'TOO_MANY_PHOTOS' });
  }
  const reducida = await deps.compressor.compress(original, {
    maxSide: PHOTO_MAX_SIDE_PX,
    quality: PHOTO_JPEG_QUALITY,
  });
  if (!reducida.ok) {
    return err({ code: 'IMAGE_UNREADABLE' });
  }
  if (reducida.value.bytes.byteLength > PHOTO_MAX_BYTES) {
    return err({ code: 'PHOTO_TOO_LARGE' });
  }
  const foto: OrderPhoto = {
    id: deps.idGenerator.newId<'Photo'>(),
    orderId,
    mimeType: 'image/jpeg',
    sizeBytes: reducida.value.bytes.byteLength,
    width: reducida.value.width,
    height: reducida.value.height,
    takenAt: deps.clock.now().toISOString(),
    userId: actor.userId,
    status: 'PENDING',
  };
  try {
    await deps.photos.put(foto, reducida.value.bytes);
  } catch {
    return err({ code: 'STORAGE_FAILED' });
  }
  return ok(foto);
}

/** Sube las fotos pendientes. Una que no se pueda subir se queda pendiente y se reintenta después; nunca
 *  se pierde ni detiene a las demás. */
export async function uploadPendingPhotos(deps: {
  readonly photos: PhotoStore;
  readonly uploader: PhotoUploader;
}): Promise<{ readonly uploaded: number; readonly failed: number }> {
  let subidas = 0;
  let fallidas = 0;
  for (const foto of await deps.photos.pending()) {
    const bytes = await deps.photos.bytesOf(foto.id);
    if (bytes === null) {
      continue;
    }
    const r = await deps.uploader.upload(photoPath(foto.orderId, foto.id), bytes);
    if (r.ok) {
      await deps.photos.markUploaded(foto.id);
      subidas += 1;
    } else {
      fallidas += 1;
    }
  }
  return { uploaded: subidas, failed: fallidas };
}

/** Almacén de fotos en memoria, para pruebas. */
export function inMemoryPhotoStore(): PhotoStore {
  const fotos = new Map<string, { foto: OrderPhoto; bytes: Uint8Array }>();
  return {
    put(foto, bytes) {
      fotos.set(foto.id, { foto, bytes: Uint8Array.from(bytes) });
      return Promise.resolve();
    },
    listByOrder: (orderId) =>
      Promise.resolve([...fotos.values()].map((x) => x.foto).filter((f) => f.orderId === orderId)),
    bytesOf: (id) => Promise.resolve(fotos.get(id)?.bytes ?? null),
    pending: () =>
      Promise.resolve([...fotos.values()].map((x) => x.foto).filter((f) => f.status === 'PENDING')),
    markUploaded(id) {
      const actual = fotos.get(id);
      if (actual !== undefined) {
        fotos.set(id, { ...actual, foto: { ...actual.foto, status: 'UPLOADED' } });
      }
      return Promise.resolve();
    },
  };
}
