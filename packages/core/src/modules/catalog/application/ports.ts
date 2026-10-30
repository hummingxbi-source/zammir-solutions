import type { CategoryId, ProductId } from '../../../shared-kernel/id';
import type { Money } from '../../../shared-kernel/money/money';
import type { Result } from '../../../shared-kernel/result';
import type { Category, ChargeUnit, PriceChange, Product, ProductKind } from '../domain/product';

export type CatalogErrorCode =
  'CODE_TAKEN' | 'NOT_FOUND' | 'CATEGORY_NOT_FOUND' | 'NOT_AUTHORIZED' | 'CATALOG_UNAVAILABLE';

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
