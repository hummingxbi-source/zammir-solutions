import type { IdGenerator, ProductId } from '../../../shared-kernel/id';
import { err, ok } from '../../../shared-kernel/result';
import { INITIAL_CATEGORIES } from '../domain/initial-categories';
import type { Category, Product } from '../domain/product';
import type { CategoryReader, ProductAdmin, ProductReader, SellableProduct } from './ports';

export interface InMemoryCatalog extends ProductAdmin, ProductReader, CategoryReader {}

function paraVender(p: Product): SellableProduct {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    categoryId: p.categoryId,
    kind: p.kind,
    chargeUnit: p.chargeUnit,
    listPrice: p.listPrice,
    isTaxExempt: p.isTaxExempt,
    ruleId: p.ruleId,
    ruleParams: p.ruleParams,
  };
}

/** Adaptador en memoria de los puertos del catálogo, para pruebas. Nace con las categorías iniciales. */
export function inMemoryCatalog(idGenerator: IdGenerator): InMemoryCatalog {
  const categorias: Category[] = INITIAL_CATEGORIES.map((c, indice) => ({
    id: idGenerator.newId<'Category'>(),
    name: c.name,
    sortOrder: indice + 1,
    fiscalDefaults: c.fiscalDefaults,
  }));
  const productos = new Map<ProductId, Product>();

  return {
    listCategories: () => Promise.resolve(ok([...categorias])),

    list: () => Promise.resolve(ok([...productos.values()])),

    create(producto) {
      if (!categorias.some((c) => c.id === producto.categoryId)) {
        return Promise.resolve(err({ code: 'CATEGORY_NOT_FOUND' }));
      }
      const repetido =
        producto.code !== null &&
        [...productos.values()].some((p) => p.code?.toLowerCase() === producto.code?.toLowerCase());
      if (repetido) {
        return Promise.resolve(err({ code: 'CODE_TAKEN' }));
      }
      productos.set(producto.id, producto);
      return Promise.resolve(ok(producto));
    },

    get(id) {
      const p = productos.get(id);
      return Promise.resolve(p === undefined ? err({ code: 'NOT_FOUND' }) : ok(p));
    },

    listSellable: () =>
      Promise.resolve(ok([...productos.values()].filter((p) => p.isActive).map(paraVender))),

    findSellable(id) {
      const p = productos.get(id);
      return Promise.resolve(p?.isActive !== true ? err({ code: 'NOT_FOUND' }) : ok(paraVender(p)));
    },
  };
}
