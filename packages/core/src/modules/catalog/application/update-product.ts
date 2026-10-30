import type { ProductId } from '../../../shared-kernel/id';
import { err, type Result } from '../../../shared-kernel/result';
import type { UserRole } from '../../identity/domain/auth';
import type { PriceRegistry } from '../domain/pricing/registry';
import {
  buildProduct,
  type Product,
  type ProductDraft,
  type ProductError,
} from '../domain/product';
import type { CatalogError, ProductAdmin } from './ports';

export interface UpdateProductDeps {
  readonly products: ProductAdmin;
  readonly priceRules: PriceRegistry;
}

/** Cambia un producto: nombre, precio, regla, estado… Solo administradores [RF-M1-04]. Un cambio de
 *  precio o de estado deja su historial y su bitácora (lo garantiza el almacén). Nada se borra:
 *  para quitar un producto de la venta se desactiva. */
export async function updateProduct(
  deps: UpdateProductDeps,
  actor: { readonly role: UserRole | null },
  id: ProductId,
  borrador: ProductDraft,
): Promise<Result<Product, ProductError | CatalogError>> {
  if (actor.role !== 'ADMIN') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const producto = buildProduct(id, borrador, deps.priceRules);
  if (!producto.ok) {
    return producto;
  }
  return deps.products.update(producto.value);
}
