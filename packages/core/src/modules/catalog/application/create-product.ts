import type { IdGenerator } from '../../../shared-kernel/id';
import { err, type Result } from '../../../shared-kernel/result';
import type { UserRole } from '../../identity/domain/auth';
import {
  buildProduct,
  type Product,
  type ProductDraft,
  type ProductError,
} from '../domain/product';
import type { PriceRegistry } from '../domain/pricing/registry';
import type { CatalogError, ProductAdmin } from './ports';

export interface CreateProductDeps {
  readonly products: ProductAdmin;
  readonly idGenerator: IdGenerator;
  readonly priceRules: PriceRegistry;
}

/** Da de alta un producto. Solo administradores [RF-M1-04]; el producto se valida antes de guardarse. */
export async function createProduct(
  deps: CreateProductDeps,
  actor: { readonly role: UserRole | null },
  borrador: ProductDraft,
): Promise<Result<Product, ProductError | CatalogError>> {
  if (actor.role !== 'ADMIN') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const producto = buildProduct(deps.idGenerator.newId<'Product'>(), borrador, deps.priceRules);
  if (!producto.ok) {
    return producto;
  }
  return deps.products.create(producto.value);
}
