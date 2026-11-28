import type { Clock } from '../../../shared-kernel/clock';
import type { IdGenerator, ProductId } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { InMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { recordAuditEntry } from '../../audit/application/record-audit-entry';
import { categoryNameTaken } from '../domain/category';
import { INITIAL_CATEGORIES } from '../domain/initial-categories';
import type { Category, PriceChange, Product } from '../domain/product';
import type {
  CatalogError,
  CategoryAdmin,
  CategoryReader,
  ProductAdmin,
  ProductReader,
  SellableProduct,
} from './ports';

export interface InMemoryCatalog
  extends ProductAdmin, ProductReader, CategoryReader, CategoryAdmin {}

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
    ...(p.isOpenPrice === true ? { isOpenPrice: true } : {}),
    ...(p.description === undefined ? {} : { description: p.description }),
    ...(p.saleUnitName === undefined ? {} : { saleUnitName: p.saleUnitName }),
    ...(p.bundleItems === undefined ? {} : { bundleItems: p.bundleItems }),
  };
}

type AccionDeProducto = 'PRODUCT_PRICE_CHANGED' | 'PRODUCT_ACTIVATED' | 'PRODUCT_DEACTIVATED';
type AccionDeCategoria =
  'CATEGORY_CREATED' | 'CATEGORY_UPDATED' | 'CATEGORY_ACTIVATED' | 'CATEGORY_DEACTIVATED';

/** Adaptador en memoria de los puertos del catálogo, para pruebas. Nace con las categorías iniciales. */
export function inMemoryCatalog(deps: InMemoryCatalogDeps): InMemoryCatalog {
  const categorias: Category[] = INITIAL_CATEGORIES.map((c, indice) => ({
    id: deps.idGenerator.newId<'Category'>(),
    name: c.name,
    sortOrder: indice + 1,
    fiscalDefaults: c.fiscalDefaults,
    isActive: true,
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

  function bitacoraDeCategoria(c: Category, action: AccionDeCategoria, anterior: Category | null) {
    return recordAuditEntry(auditoria, {
      userId: null,
      deviceId: null,
      action,
      entityType: 'product_category',
      entityId: c.id,
      oldValue: anterior === null ? null : { nombre: anterior.name, activa: anterior.isActive },
      newValue: { nombre: c.name, activa: c.isActive },
    });
  }

  async function actualizar(producto: Product): Promise<Result<Product, CatalogError>> {
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
  }

  return {
    listCategories: () => Promise.resolve(ok([...categorias])),

    async createCategory(categoria) {
      if (categoryNameTaken(categoria.name, categorias)) {
        return err({ code: 'CATEGORY_NAME_TAKEN' });
      }
      categorias.push(categoria);
      await bitacoraDeCategoria(categoria, 'CATEGORY_CREATED', null);
      return ok(categoria);
    },

    async updateCategory(categoria) {
      const i = categorias.findIndex((c) => c.id === categoria.id);
      const anterior = categorias[i];
      if (anterior === undefined) {
        return err({ code: 'NOT_FOUND' });
      }
      if (categoryNameTaken(categoria.name, categorias, categoria.id)) {
        return err({ code: 'CATEGORY_NAME_TAKEN' });
      }
      if (
        anterior.isActive &&
        !categoria.isActive &&
        [...productos.values()].some((p) => p.isActive && p.categoryId === categoria.id)
      ) {
        return err({ code: 'CATEGORY_IN_USE' });
      }
      categorias[i] = categoria;
      await bitacoraDeCategoria(
        categoria,
        anterior.isActive === categoria.isActive
          ? 'CATEGORY_UPDATED'
          : categoria.isActive
            ? 'CATEGORY_ACTIVATED'
            : 'CATEGORY_DEACTIVATED',
        anterior,
      );
      return ok(categoria);
    },

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

    createMany(lote) {
      const codigos = new Set<string>();
      for (const producto of lote) {
        if (!categorias.some((cat) => cat.id === producto.categoryId)) {
          return Promise.resolve(err({ code: 'CATEGORY_NOT_FOUND' }));
        }
        const clave = producto.code?.toLowerCase();
        if (codigoOcupado(producto) || (clave !== undefined && codigos.has(clave))) {
          return Promise.resolve(err({ code: 'CODE_TAKEN' }));
        }
        if (clave !== undefined) {
          codigos.add(clave);
        }
      }
      for (const producto of lote) {
        productos.set(producto.id, producto);
      }
      return Promise.resolve(ok([...lote]));
    },

    update: actualizar,

    async updateMany(cambios) {
      // Todo o nada: primero se revisa que existan todos.
      if (cambios.some((c) => !productos.has(c.id))) {
        return err({ code: 'NOT_FOUND' });
      }
      const resultado: Product[] = [];
      for (const c of cambios) {
        const anterior = productos.get(c.id);
        if (anterior === undefined) continue;
        const sinDescripcion = Object.fromEntries(
          Object.entries(anterior).filter(([campo]) => campo !== 'description'),
        ) as unknown as Product;
        const r = await actualizar({
          ...sinDescripcion,
          name: c.name,
          listPrice: c.listPrice,
          ...(c.description === null ? {} : { description: c.description }),
        });
        if (r.ok) resultado.push(r.value);
      }
      return ok(resultado);
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
