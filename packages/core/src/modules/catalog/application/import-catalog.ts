import type { IdGenerator } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { Actor } from '../../identity/domain/auth';
import { defaultPermissionPolicy } from '../../identity/domain/permissions';
import { analyzeCatalogImport, type ImportAnalysis } from '../domain/import/analyze';
import type { PriceRegistry } from '../domain/pricing/registry';
import type { Category, Product } from '../domain/product';
import type { CatalogError, CategoryReader, ProductAdmin } from './ports';

export interface ImportCatalogDeps {
  readonly products: ProductAdmin;
  readonly categories: CategoryReader;
  readonly idGenerator: IdGenerator;
  readonly priceRules: PriceRegistry;
}

export type ImportCatalogError =
  | CatalogError
  /** El archivo tiene errores: no se importó nada. El detalle va en `analysis`. */
  | { readonly code: 'IMPORT_INVALID'; readonly analysis: ImportAnalysis };

async function leerContexto(
  deps: ImportCatalogDeps,
): Promise<Result<{ categories: readonly Category[]; codes: string[] }, CatalogError>> {
  const categorias = await deps.categories.listCategories();
  if (!categorias.ok) return categorias;
  const productos = await deps.products.list();
  if (!productos.ok) return productos;
  return ok({
    categories: categorias.value,
    codes: productos.value.flatMap((p) => (p.code === null ? [] : [p.code])),
  });
}

/** Revisa el archivo SIN guardar nada: es lo que muestra la vista previa con cada error y su fila. */
export async function previewCatalogImport(
  deps: ImportCatalogDeps,
  actor: Actor,
  filas: readonly (readonly string[])[],
): Promise<Result<ImportAnalysis, CatalogError>> {
  if (defaultPermissionPolicy.check(actor.role, 'CATALOG_EDIT') === 'DENY') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const contexto = await leerContexto(deps);
  if (!contexto.ok) return contexto;
  return ok(
    analyzeCatalogImport(filas, {
      categories: contexto.value.categories,
      existingCodes: contexto.value.codes,
      priceRules: deps.priceRules,
    }),
  );
}

/** Importa el catálogo desde un archivo ya leído: todo o nada. Si el archivo tiene cualquier error, no se
 *  guarda ninguna fila y se devuelve el análisis para corregirlo. Solo quien puede editar el catálogo. */
export async function importCatalog(
  deps: ImportCatalogDeps,
  actor: Actor,
  filas: readonly (readonly string[])[],
): Promise<Result<readonly Product[], ImportCatalogError>> {
  const vista = await previewCatalogImport(deps, actor, filas);
  if (!vista.ok) return vista;
  if (!vista.value.valid) {
    return err({ code: 'IMPORT_INVALID', analysis: vista.value });
  }
  const productos: Product[] = vista.value.rows.flatMap((fila) =>
    fila.draft === null ? [] : [{ id: deps.idGenerator.newId<'Product'>(), ...fila.draft }],
  );
  return deps.products.createMany(productos);
}
