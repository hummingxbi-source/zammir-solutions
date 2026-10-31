import type { ProductId } from '../../../shared-kernel/id';
import type { Category } from '../domain/product';
import type { CatalogLocalStore, ReplicatedProduct } from './replica';

/** Almacén local del catálogo en memoria, para pruebas. */
export function inMemoryCatalogLocalStore(): CatalogLocalStore {
  const productos = new Map<ProductId, ReplicatedProduct>();
  let categorias: readonly Category[] = [];
  let cursor = 0;
  return {
    cursor: () => Promise.resolve(cursor),
    applyProducts: (nuevos) => {
      for (const p of nuevos) {
        productos.set(p.id, p);
        cursor = Math.max(cursor, p.changeSeq);
      }
      return Promise.resolve();
    },
    replaceCategories: (nuevas) => {
      categorias = [...nuevas];
      return Promise.resolve();
    },
    products: () => Promise.resolve([...productos.values()]),
    categories: () => Promise.resolve(categorias),
  };
}
