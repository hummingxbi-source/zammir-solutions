import { err, ok, type Result } from '../../../shared-kernel/result';
import { checkBundleItems, type BundleError } from '../domain/bundle';
import type { Product } from '../domain/product';
import type { CatalogError, ProductAdmin } from './ports';

/** Antes de guardar un paquete, revisa sus componentes contra el catálogo de este momento [RF-M1-18]. Un
 *  producto que no es paquete pasa sin leer nada. */
export async function revisarPaquete(
  products: ProductAdmin,
  producto: Product,
): Promise<Result<null, BundleError | CatalogError>> {
  if (producto.kind !== 'BUNDLE') {
    return ok(null);
  }
  const lista = await products.list();
  if (!lista.ok) {
    return lista;
  }
  // Un paquete no puede tenerse a sí mismo: se revisa contra el catálogo sin él.
  const otros = lista.value.filter((p) => p.id !== producto.id);
  const revision = checkBundleItems(producto.bundleItems ?? [], otros);
  return revision.ok ? ok(null) : err(revision.error);
}
