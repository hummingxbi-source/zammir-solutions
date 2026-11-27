import type { CategoryId } from '../../../shared-kernel/id';
import type { PesoRounding } from '../../../shared-kernel/money/money';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { UserRole } from '../../identity/domain/auth';
import {
  previewCategoryPriceChange,
  type BulkPriceChange,
  type BulkPriceError,
} from '../domain/bulk-prices';
import { analyzeCatalogUpdate, type UpdateAnalysis } from '../domain/import/analyze-update';
import type { PriceRegistry } from '../domain/pricing/registry';
import type { Product } from '../domain/product';
import type { CatalogError, ProductAdmin, ProductBulkChange } from './ports';

export interface BulkPricesDeps {
  readonly products: ProductAdmin;
  readonly priceRules: PriceRegistry;
}

interface Actor {
  readonly role: UserRole | null;
}

export type CatalogUpdateError =
  | CatalogError
  /** El archivo tiene errores: no se cambió nada. El detalle va en `analysis`. */
  | { readonly code: 'IMPORT_INVALID'; readonly analysis: UpdateAnalysis };

function comoCambio(p: Product): ProductBulkChange {
  return { id: p.id, name: p.name, listPrice: p.listPrice, description: p.description ?? null };
}

/** Revisa un archivo para actualizar productos por código SIN guardar nada: la vista previa con cada cambio
 *  (antes y después) y cada error con su fila [RF-M1-15]. Solo administradores, como editar a mano. */
export async function previewCatalogUpdate(
  deps: BulkPricesDeps,
  actor: Actor,
  filas: readonly (readonly string[])[],
): Promise<Result<UpdateAnalysis, CatalogError>> {
  if (actor.role !== 'ADMIN') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const productos = await deps.products.list();
  if (!productos.ok) return productos;
  return ok(
    analyzeCatalogUpdate(filas, { products: productos.value, priceRules: deps.priceRules }),
  );
}

/** Aplica el archivo para actualizar: todo o nada. Se vuelve a revisar contra el catálogo de este momento,
 *  por si cambió desde la vista previa. Cada cambio de precio deja su historial [RN-19]. */
export async function applyCatalogUpdate(
  deps: BulkPricesDeps,
  actor: Actor,
  filas: readonly (readonly string[])[],
): Promise<Result<readonly Product[], CatalogUpdateError>> {
  const vista = await previewCatalogUpdate(deps, actor, filas);
  if (!vista.ok) return vista;
  if (!vista.value.valid) {
    return err({ code: 'IMPORT_INVALID', analysis: vista.value });
  }
  return deps.products.updateMany(vista.value.updates.map((u) => comoCambio(u.after)));
}

/** Lo que cambiaría al subir o bajar por porcentaje los precios de una categoría, sin guardar nada
 *  [RF-M1-15, D3]. */
export async function previewCategoryPrices(
  deps: BulkPricesDeps,
  actor: Actor,
  categoria: CategoryId,
  puntosBase: number,
  redondeo: PesoRounding,
): Promise<Result<readonly BulkPriceChange[], CatalogError | BulkPriceError>> {
  if (actor.role !== 'ADMIN') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const productos = await deps.products.list();
  if (!productos.ok) return productos;
  return previewCategoryPriceChange(productos.value, categoria, puntosBase, redondeo);
}

/** Sube o baja por porcentaje los precios de una categoría: los mismos que mostró la vista previa,
 *  recalculados con el catálogo de este momento. Todo o nada, con historial y bitácora de cada precio. */
export async function applyCategoryPrices(
  deps: BulkPricesDeps,
  actor: Actor,
  categoria: CategoryId,
  puntosBase: number,
  redondeo: PesoRounding,
): Promise<Result<readonly Product[], CatalogError | BulkPriceError>> {
  const vista = await previewCategoryPrices(deps, actor, categoria, puntosBase, redondeo);
  if (!vista.ok) return vista;
  return deps.products.updateMany(
    vista.value.map((c) => comoCambio({ ...c.product, listPrice: c.newPrice })),
  );
}
