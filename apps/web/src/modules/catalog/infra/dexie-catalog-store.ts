import Dexie, { type EntityTable } from 'dexie';
import type { CatalogLocalStore, Category, ReplicatedProduct } from '@zammir/core';

interface FilaDeMeta {
  readonly clave: string;
  readonly valor: number;
}

class BaseDelCatalogo extends Dexie {
  productos!: EntityTable<ReplicatedProduct, 'id'>;
  categorias!: EntityTable<Category, 'id'>;
  meta!: EntityTable<FilaDeMeta, 'clave'>;

  constructor(nombre: string) {
    super(nombre);
    this.version(1).stores({
      productos: 'id',
      categorias: 'id',
      meta: 'clave',
    });
  }
}

const CLAVE_CURSOR = 'cursor-del-catalogo';

/** Almacén del catálogo en IndexedDB: lo que la tablet guarda para vender sin internet. Cada producto
 *  se guarda por su id, así un cambio lo reemplaza en lugar de duplicarlo. */
export function dexieCatalogStore(nombre = 'zammir-catalogo'): CatalogLocalStore {
  const base = new BaseDelCatalogo(nombre);
  return {
    async cursor() {
      return (await base.meta.get(CLAVE_CURSOR))?.valor ?? 0;
    },
    async applyProducts(productos) {
      await base.transaction('rw', base.productos, base.meta, async () => {
        await base.productos.bulkPut([...productos]);
        const actual = (await base.meta.get(CLAVE_CURSOR))?.valor ?? 0;
        const mayor = productos.reduce((m, p) => Math.max(m, p.changeSeq), actual);
        await base.meta.put({ clave: CLAVE_CURSOR, valor: mayor });
      });
    },
    async replaceCategories(categorias) {
      await base.transaction('rw', base.categorias, async () => {
        await base.categorias.clear();
        await base.categorias.bulkPut([...categorias]);
      });
    },
    products: () => base.productos.toArray(),
    categories: () => base.categorias.toArray(),
  };
}
