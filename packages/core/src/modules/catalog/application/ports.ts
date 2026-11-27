import type { CategoryId, ProductId } from '../../../shared-kernel/id';
import type { Money } from '../../../shared-kernel/money/money';
import type { Result } from '../../../shared-kernel/result';
import type { Category, ChargeUnit, PriceChange, Product, ProductKind } from '../domain/product';

export type CatalogErrorCode =
  | 'CODE_TAKEN'
  | 'NOT_FOUND'
  | 'CATEGORY_NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'CATALOG_UNAVAILABLE'
  /** Ya hay otra categoría con ese nombre (sin acentos ni mayúsculas) [RF-M1-08]. */
  | 'CATEGORY_NAME_TAKEN'
  /** No se desactiva una categoría con productos activos [RF-M1-08]. */
  | 'CATEGORY_IN_USE';

export interface CatalogError {
  readonly code: CatalogErrorCode;
}

/** Lo que el cotizador y el mostrador necesitan para vender: nada de datos fiscales, historial
 *  ni administración del catálogo [00-principios §2, segregación de interfaces]. */
export interface SellableProduct {
  readonly id: ProductId;
  readonly code: string | null;
  readonly name: string;
  readonly categoryId: CategoryId;
  readonly kind: ProductKind;
  readonly chargeUnit: ChargeUnit;
  readonly listPrice: Money;
  readonly isTaxExempt: boolean;
  readonly ruleId: string;
  readonly ruleParams: unknown;
  /** Precio abierto [RF-M1-10]: `listPrice` es la referencia. Sin el campo, el precio es fijo. */
  readonly isOpenPrice?: boolean;
  /** Descripción opcional [RF-M1-13]. */
  readonly description?: string;
}

/** Puerto de lectura para vender: solo productos activos. */
export interface ProductReader {
  listSellable(): Promise<Result<readonly SellableProduct[], CatalogError>>;
  findSellable(id: ProductId): Promise<Result<SellableProduct, CatalogError>>;
}

/** Puerto de administración del catálogo. Nada se borra: los productos se desactivan [RF-M1-04];
 *  por eso este puerto no tiene una operación de borrado. */
export interface ProductAdmin {
  create(producto: Product): Promise<Result<Product, CatalogError>>;
  /** Da de alta varios productos de golpe, **todo o nada**: si uno falla (código repetido, categoría que
   *  no existe…), no se guarda ninguno. Es lo que usa la importación del catálogo [RF-M1-05]. */
  createMany(productos: readonly Product[]): Promise<Result<readonly Product[], CatalogError>>;
  /** Cambia un producto existente. Un cambio de precio deja su historial y su entrada de bitácora
   *  con el valor anterior y el nuevo, en el mismo paso [RF-M1-06, RN-19]. Activar o desactivar
   *  también deja su entrada. */
  update(producto: Product): Promise<Result<Product, CatalogError>>;
  /** Cambios de precio de un producto, del más antiguo al más reciente. */
  priceHistory(id: ProductId): Promise<Result<readonly PriceChange[], CatalogError>>;
  get(id: ProductId): Promise<Result<Product, CatalogError>>;
  list(): Promise<Result<readonly Product[], CatalogError>>;
}

export interface CategoryReader {
  listCategories(): Promise<Result<readonly Category[], CatalogError>>;
}

/** Administración de categorías [RF-M1-08, ADR-0044]: alta, cambio de nombre, orden y claves, y desactivación.
 *  No hay borrado. */
export interface CategoryAdmin {
  createCategory(categoria: Category): Promise<Result<Category, CatalogError>>;
  updateCategory(categoria: Category): Promise<Result<Category, CatalogError>>;
}
