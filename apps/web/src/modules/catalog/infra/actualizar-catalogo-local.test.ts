import 'fake-indexeddb/auto';
import {
  asId,
  err,
  inMemoryCatalogLocalStore,
  ok,
  type CatalogReplicaSource,
  type DeviceCredentials,
  type DeviceCredentialsStore,
} from '@zammir/core';
import { replicatedProduct } from '@zammir/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { actualizarCatalogoLocal } from './actualizar-catalogo-local';

const credenciales: DeviceCredentials = {
  device: { id: asId<'Device'>('d-1'), name: 'Mostrador', tempSeries: 1 },
  session: { accessToken: 'a', refreshToken: 'r' },
  registeredAt: new Date(0),
};

const tienda = (c: DeviceCredentials | null): DeviceCredentialsStore => ({
  load: () => Promise.resolve(c),
  save: () => Promise.resolve(),
  clear: () => Promise.resolve(),
});

const fuenteConUnProducto: CatalogReplicaSource = {
  productsChangedAfter: () => Promise.resolve(ok([replicatedProduct('a', 1)])),
  categories: () => Promise.resolve(ok([])),
};

describe('actualizarCatalogoLocal', () => {
  it('con la tablet registrada abre su sesión y baja el catálogo', async () => {
    const store = inMemoryCatalogLocalStore();
    const fuenteConSesion = vi.fn(() => Promise.resolve(fuenteConUnProducto));
    const r = await actualizarCatalogoLocal({
      credenciales: tienda(credenciales),
      fuenteConSesion,
      store,
    });
    expect(r.ok && r.value.received).toBe(1);
    expect(fuenteConSesion).toHaveBeenCalledWith(credenciales);
    expect(await store.products()).toHaveLength(1);
  });

  it('sin tablet registrada no hace nada', async () => {
    const fuenteConSesion = vi.fn(() => Promise.resolve(fuenteConUnProducto));
    const r = await actualizarCatalogoLocal({
      credenciales: tienda(null),
      fuenteConSesion,
      store: inMemoryCatalogLocalStore(),
    });
    expect(!r.ok && r.error.code).toBe('NOT_REGISTERED');
    expect(fuenteConSesion).not.toHaveBeenCalled();
  });

  it('si no se puede abrir la sesión, conserva lo guardado y avisa', async () => {
    const store = inMemoryCatalogLocalStore();
    await store.applyProducts([replicatedProduct('a', 1)]);
    const r = await actualizarCatalogoLocal({
      credenciales: tienda(credenciales),
      fuenteConSesion: () => Promise.resolve(null),
      store,
    });
    expect(!r.ok && r.error.code).toBe('CATALOG_UNAVAILABLE');
    expect(await store.products()).toHaveLength(1);
  });

  it('si el servidor falla, devuelve el error y no toca lo guardado', async () => {
    const store = inMemoryCatalogLocalStore();
    await store.applyProducts([replicatedProduct('a', 1)]);
    const caida: CatalogReplicaSource = {
      productsChangedAfter: () => Promise.resolve(err({ code: 'CATALOG_UNAVAILABLE' })),
      categories: () => Promise.resolve(ok([])),
    };
    const r = await actualizarCatalogoLocal({
      credenciales: tienda(credenciales),
      fuenteConSesion: () => Promise.resolve(caida),
      store,
    });
    expect(!r.ok && r.error.code).toBe('CATALOG_UNAVAILABLE');
    expect(await store.products()).toHaveLength(1);
  });
});
