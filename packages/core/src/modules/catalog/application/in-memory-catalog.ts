import type { Clock } from '../../../shared-kernel/clock';
import type { IdGenerator, ProductId } from '../../../shared-kernel/id';
import { err, ok } from '../../../shared-kernel/result';
import type { InMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { recordAuditEntry } from '../../audit/application/record-audit-entry';
import { INITIAL_CATEGORIES } from '../domain/initial-categories';
import type { Category, PriceChange, Product } from '../domain/product';
import type { CategoryReader, ProductAdmin, ProductReader, SellableProduct } from './ports';

export interface InMemoryCatalog extends ProductAdmin, ProductReader, CategoryReader {}

export interface InMemoryCatalogDeps {
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
  readonly auditLog: InMemoryAuditLog;
}

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

type AccionDeProducto = 'PRODUCT_PRICE_CHANGED' | 'PRODUCT_ACTIVATED' | 'PRODUCT_DEACTIVATED';

/** Adaptador en memoria de los puertos del catálogo, para pruebas. Nace con las categorías iniciales. */
export function inMemoryCatalog(deps: InMemoryCatalogDeps): InMemoryCatalog {
  const categorias: Category[] = INITIAL_CATEGORIES.map((c, indice) => ({
    id: deps.idGenerator.newId<'Category'>(),
    name: c.name,
    sortOrder: indice + 1,
    fiscalDefaults: c.fiscalDefaults,
  }));
  const productos = new Map<ProductId, Product>();
  const historial = new Map<ProductId, PriceChange[]>();
  const auditoria = { auditLog: deps.auditLog, clock: deps.clock, idGenerator: deps.idGenerator };

  function codigoOcupado(producto: Product): boolean {
    return (
      producto.code !== null &&
      [...productos.values()].some(
        (p) => p.id !== producto.id && p.code?.toLowerCase() === producto.code?.toLowerCase(),
      )
    );
  }

  function dejarBitacora(
    producto: Product,
    action: AccionDeProducto,
    oldValue: Record<string, number | boolean>,
    newValue: Record<string, number | boolean>,
  ) {
    return recordAuditEntry(auditoria, {
      userId: null,
      deviceId: null,
      action,
      entityType: 'product',
      entityId: producto.id,
      oldValue,
      newValue,
    });
  }

  return {
    listCategories: () => Promise.resolve(ok([...categorias])),

    list: () => Promise.resolve(ok([...productos.values()])),

    create(producto) {
      if (!categorias.some((c) => c.id === producto.categoryId)) {
        return Promise.resolve(err({ code: 'CATEGORY_NOT_FOUND' }));
      }
      if (codigoOcupado(producto)) {
        return Promise.resolve(err({ code: 'CODE_TAKEN' }));
      }
      productos.set(producto.id, producto);
      return Promise.resolve(ok(producto));
    },

    async update(producto) {
      const anterior = productos.get(producto.id);
      if (anterior === undefined) {
        return err({ code: 'NOT_FOUND' });
      }
      if (!categorias.some((c) => c.id === producto.categoryId)) {
        return err({ code: 'CATEGORY_NOT_FOUND' });
      }
      if (codigoOcupado(producto)) {
        return err({ code: 'CODE_TAKEN' });
      }
      productos.set(producto.id, producto);

      if (anterior.listPrice !== producto.listPrice) {
        historial.set(producto.id, [
          ...(historial.get(producto.id) ?? []),
          {
            productId: producto.id,
            oldPrice: anterior.listPrice,
            newPrice: producto.listPrice,
            changedAt: deps.clock.now(),
          },
        ]);
        await dejarBitacora(
          producto,
          'PRODUCT_PRICE_CHANGED',
          { precio_centavos: anterior.listPrice },
          { precio_centavos: producto.listPrice },
        );
      }
      if (anterior.isActive !== producto.isActive) {
        await dejarBitacora(
          producto,
          producto.isActive ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
          { activo: anterior.isActive },
          { activo: producto.isActive },
        );
      }
      return ok(producto);
    },

    priceHistory(id) {
      return Promise.resolve(ok(historial.get(id) ?? []));
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
