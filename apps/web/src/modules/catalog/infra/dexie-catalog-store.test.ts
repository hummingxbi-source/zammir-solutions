import 'fake-indexeddb/auto';
import { catalogLocalStoreContract, replicatedProduct } from '@zammir/core/testing';
import { describe, expect, it } from 'vitest';

import { dexieCatalogStore } from './dexie-catalog-store';

let contador = 0;
const nombreNuevo = (): string => {
  contador += 1;
  return `prueba-catalogo-${String(contador)}`;
};

catalogLocalStoreContract('IndexedDB (Dexie)', () => dexieCatalogStore(nombreNuevo()));

describe('dexieCatalogStore', () => {
  it('lo guardado sigue ahí al abrir la base otra vez, como al reiniciar la tablet', async () => {
    const nombre = nombreNuevo();
    await dexieCatalogStore(nombre).applyProducts([replicatedProduct('a', 5)]);
    const reabierta = dexieCatalogStore(nombre);
    expect(await reabierta.cursor()).toBe(5);
    expect(await reabierta.products()).toHaveLength(1);
  });
});
