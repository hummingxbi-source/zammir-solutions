import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';
import {
  catalogLocalStoreContract,
  dineroDePrueba,
  replicatedCategory,
  replicatedProduct,
} from '../contracts/catalog-local-store.contract';
import { inMemoryCatalogLocalStore } from './in-memory-catalog-local-store';
import type { CatalogError } from './ports';
import {
  localProductReader,
  refreshCatalog,
  REPLICA_PAGE_SIZE,
  type CatalogReplicaSource,
  type ReplicatedProduct,
} from './replica';

catalogLocalStoreContract('memoria', () => inMemoryCatalogLocalStore());

/** Servidor falso: guarda productos y responde "lo que cambió después de seq". */
function servidor(inicial: readonly ReplicatedProduct[] = []) {
  let productos = [...inicial];
  let caido = false;
  const peticiones: number[] = [];
  const fuente: CatalogReplicaSource = {
    productsChangedAfter: (seq, limite) => {
      peticiones.push(seq);
      if (caido) {
        return Promise.resolve(err<CatalogError>({ code: 'CATALOG_UNAVAILABLE' }));
      }
      const pagina = productos
        .filter((p) => p.changeSeq > seq)
        .sort((a, b) => a.changeSeq - b.changeSeq)
        .slice(0, limite);
      return Promise.resolve(ok(pagina) as Result<readonly ReplicatedProduct[], CatalogError>);
    },
    categories: () =>
      Promise.resolve(
        caido
          ? err<CatalogError>({ code: 'CATALOG_UNAVAILABLE' })
          : ok([replicatedCategory('c-2', 2), replicatedCategory('c-1', 1)]),
      ),
  };
  return {
    fuente,
    peticiones,
    cambiar: (p: ReplicatedProduct) => {
      productos = [...productos.filter((x) => x.id !== p.id), p];
    },
    caer: (valor: boolean) => {
      caido = valor;
    },
  };
}

describe('refreshCatalog', () => {
  it('la primera vez baja todo el catálogo y las categorías', async () => {
    const s = servidor([replicatedProduct('a', 1), replicatedProduct('b', 2)]);
    const store = inMemoryCatalogLocalStore();
    const r = await refreshCatalog({ source: s.fuente, store });
    expect(r.ok && r.value.received).toBe(2);
    expect(await store.products()).toHaveLength(2);
    expect(await store.cursor()).toBe(2);
    expect(await store.categories()).toHaveLength(2);
  });

  it('después solo pide lo que cambió y un cambio de precio no duplica el producto', async () => {
    const s = servidor([replicatedProduct('a', 1), replicatedProduct('b', 2)]);
    const store = inMemoryCatalogLocalStore();
    await refreshCatalog({ source: s.fuente, store });
    s.cambiar(replicatedProduct('a', 3, { listPrice: dineroDePrueba(15_000) }));
    const r = await refreshCatalog({ source: s.fuente, store });
    expect(r.ok && r.value.received).toBe(1);
    const lector = localProductReader(store);
    const lista = await lector.listSellable();
    expect(lista.ok && lista.value).toHaveLength(2);
    const a = await lector.findSellable(asId<'Product'>('a'));
    expect(a.ok && a.value.listPrice).toBe(dineroDePrueba(15_000));
    expect(s.peticiones.slice(-1)).toEqual([2]);
  });

  it('sin cambios no baja nada', async () => {
    const s = servidor([replicatedProduct('a', 1)]);
    const store = inMemoryCatalogLocalStore();
    await refreshCatalog({ source: s.fuente, store });
    const r = await refreshCatalog({ source: s.fuente, store });
    expect(r.ok && r.value.received).toBe(0);
  });

  it('un producto desactivado deja de ofrecerse', async () => {
    const s = servidor([replicatedProduct('a', 1), replicatedProduct('b', 2)]);
    const store = inMemoryCatalogLocalStore();
    await refreshCatalog({ source: s.fuente, store });
    s.cambiar(replicatedProduct('b', 3, { isActive: false }));
    await refreshCatalog({ source: s.fuente, store });
    const lector = localProductReader(store);
    const lista = await lector.listSellable();
    expect(lista.ok && lista.value.map((p) => p.id)).toEqual(['a']);
    const b = await lector.findSellable(asId<'Product'>('b'));
    expect(!b.ok && b.error.code).toBe('NOT_FOUND');
  });

  it('sin conexión conserva lo guardado y avisa del error', async () => {
    const s = servidor([replicatedProduct('a', 1)]);
    const store = inMemoryCatalogLocalStore();
    await refreshCatalog({ source: s.fuente, store });
    s.caer(true);
    const r = await refreshCatalog({ source: s.fuente, store });
    expect(!r.ok && r.error.code).toBe('CATALOG_UNAVAILABLE');
    const lista = await localProductReader(store).listSellable();
    expect(lista.ok && lista.value).toHaveLength(1);
  });

  it('con más productos que una página, los baja todos pidiendo por tandas', async () => {
    const muchos = Array.from({ length: REPLICA_PAGE_SIZE + 3 }, (_v, i) =>
      replicatedProduct(`p${String(i)}`, i + 1),
    );
    const s = servidor(muchos);
    const store = inMemoryCatalogLocalStore();
    const r = await refreshCatalog({ source: s.fuente, store });
    expect(r.ok && r.value.received).toBe(REPLICA_PAGE_SIZE + 3);
    expect(s.peticiones).toEqual([0, REPLICA_PAGE_SIZE]);
  });

  it('si se corta a la mitad, lo ya guardado se queda y continúa desde ahí', async () => {
    const muchos = Array.from({ length: REPLICA_PAGE_SIZE + 3 }, (_v, i) =>
      replicatedProduct(`p${String(i)}`, i + 1),
    );
    const s = servidor(muchos);
    const store = inMemoryCatalogLocalStore();
    let llamadas = 0;
    const cortada: CatalogReplicaSource = {
      ...s.fuente,
      productsChangedAfter: (seq, limite) => {
        llamadas += 1;
        return llamadas === 2
          ? Promise.resolve(err<CatalogError>({ code: 'CATALOG_UNAVAILABLE' }))
          : s.fuente.productsChangedAfter(seq, limite);
      },
    };
    const primera = await refreshCatalog({ source: cortada, store });
    expect(primera.ok).toBe(false);
    expect(await store.cursor()).toBe(REPLICA_PAGE_SIZE);
    const segunda = await refreshCatalog({ source: s.fuente, store });
    expect(segunda.ok && segunda.value.received).toBe(3);
    expect(await store.products()).toHaveLength(REPLICA_PAGE_SIZE + 3);
  });
});

describe('localProductReader', () => {
  it('las categorías salen en su orden', async () => {
    const store = inMemoryCatalogLocalStore();
    await store.replaceCategories([replicatedCategory('c-2', 2), replicatedCategory('c-1', 1)]);
    const r = await localProductReader(store).listCategories();
    expect(r.ok && r.value.map((c) => c.id)).toEqual(['c-1', 'c-2']);
  });
});
