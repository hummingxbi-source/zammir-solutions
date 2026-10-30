import type { ProductId } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { Category } from '../domain/product';
import type { CatalogError, CategoryReader, ProductReader, SellableProduct } from './ports';

/** Un producto tal como viaja a la tablet: lo que se necesita para vender, su marca de activo y el
 *  número de cambio con el que el servidor lo marcó. Los desactivados también viajan, para que la
 *  tablet deje de ofrecerlos [RF-M1-04]. */
export interface ReplicatedProduct extends SellableProduct {
  readonly isActive: boolean;
  readonly changeSeq: number;
}

/** De dónde baja la tablet el catálogo (el servidor). */
export interface CatalogReplicaSource {
  /** Productos nuevos o cambiados después de `seq`, en orden de cambio, hasta `limit`. */
  productsChangedAfter(
    seq: number,
    limit: number,
  ): Promise<Result<readonly ReplicatedProduct[], CatalogError>>;
  categories(): Promise<Result<readonly Category[], CatalogError>>;
}

/** Dónde guarda la tablet el catálogo para usarlo sin internet. */
export interface CatalogLocalStore {
  /** Último número de cambio recibido; 0 si aún no ha bajado nada. */
  cursor(): Promise<number>;
  /** Guarda o reemplaza cada producto por su id y avanza el cursor al mayor número recibido. */
  applyProducts(productos: readonly ReplicatedProduct[]): Promise<void>;
  replaceCategories(categorias: readonly Category[]): Promise<void>;
  /** Todos los productos guardados, activos o no. */
  products(): Promise<readonly ReplicatedProduct[]>;
  categories(): Promise<readonly Category[]>;
}

export interface RefreshCatalogDeps {
  readonly source: CatalogReplicaSource;
  readonly store: CatalogLocalStore;
}

/** Productos por petición; el servidor puede devolver menos. */
export const REPLICA_PAGE_SIZE = 500;

/** Baja los cambios del catálogo y los guarda. Si falla a la mitad, lo ya guardado se queda y la
 *  siguiente vez continúa desde ahí; si no hay conexión, el catálogo local no se toca. */
export async function refreshCatalog(
  deps: RefreshCatalogDeps,
): Promise<Result<{ readonly received: number }, CatalogError>> {
  let recibidos = 0;
  for (;;) {
    const desde = await deps.store.cursor();
    const pagina = await deps.source.productsChangedAfter(desde, REPLICA_PAGE_SIZE);
    if (!pagina.ok) {
      return err(pagina.error);
    }
    if (pagina.value.length > 0) {
      await deps.store.applyProducts(pagina.value);
      recibidos += pagina.value.length;
    }
    if (pagina.value.length < REPLICA_PAGE_SIZE) {
      break;
    }
  }
  const categorias = await deps.source.categories();
  if (!categorias.ok) {
    return err(categorias.error);
  }
  await deps.store.replaceCategories(categorias.value);
  return ok({ received: recibidos });
}

function paraVender(p: ReplicatedProduct): SellableProduct {
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

/** Lector de productos para vender que trabaja solo con lo guardado en la tablet. */
export function localProductReader(store: CatalogLocalStore): ProductReader & CategoryReader {
  return {
    async listSellable() {
      const todos = await store.products();
      return ok(todos.filter((p) => p.isActive).map(paraVender));
    },
    async findSellable(id: ProductId) {
      const todos = await store.products();
      const hallado = todos.find((p) => p.id === id && p.isActive);
      return hallado === undefined ? err({ code: 'NOT_FOUND' }) : ok(paraVender(hallado));
    },
    async listCategories() {
      const categorias = await store.categories();
      return ok([...categorias].sort((a, b) => a.sortOrder - b.sortOrder));
    },
  };
}
