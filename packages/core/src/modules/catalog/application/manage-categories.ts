import type { CategoryId, IdGenerator } from '../../../shared-kernel/id';
import { err, type Result } from '../../../shared-kernel/result';
import type { UserRole } from '../../identity/domain/auth';
import {
  buildCategory,
  categoryNameTaken,
  nextSortOrder,
  type CategoryError,
} from '../domain/category';
import type { Category, FiscalData } from '../domain/product';
import type { CatalogError, CategoryAdmin, CategoryReader, ProductAdmin } from './ports';

export interface ManageCategoriesDeps {
  readonly categories: CategoryReader & CategoryAdmin;
  readonly products: Pick<ProductAdmin, 'list'>;
  readonly idGenerator: IdGenerator;
}

interface Actor {
  readonly role: UserRole | null;
}

async function todas(
  deps: ManageCategoriesDeps,
): Promise<Result<readonly Category[], CatalogError>> {
  return deps.categories.listCategories();
}

/** Da de alta una categoría, al final de la lista [RF-M1-08, ADR-0044]. Solo administradores. Hereda las
 *  claves fiscales que se den (las de prueba hasta que el contador las revise, PD-29). */
export async function createCategory(
  deps: ManageCategoriesDeps,
  actor: Actor,
  entrada: { readonly name: string; readonly fiscalDefaults: FiscalData },
): Promise<Result<Category, CategoryError | CatalogError>> {
  if (actor.role !== 'ADMIN') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const lista = await todas(deps);
  if (!lista.ok) {
    return lista;
  }
  const categoria = buildCategory(deps.idGenerator.newId<'Category'>(), {
    name: entrada.name,
    sortOrder: nextSortOrder(lista.value),
    fiscalDefaults: entrada.fiscalDefaults,
    isActive: true,
  });
  if (!categoria.ok) {
    return categoria;
  }
  if (categoryNameTaken(categoria.value.name, lista.value)) {
    return err({ code: 'CATEGORY_NAME_TAKEN' });
  }
  return deps.categories.createCategory(categoria.value);
}

/** Cambia el nombre, el orden, las claves o si está activa [RF-M1-08]. Una categoría con productos activos no
 *  se desactiva: primero se mueven o desactivan sus productos. Nada se borra. */
export async function updateCategory(
  deps: ManageCategoriesDeps,
  actor: Actor,
  cambio: Category,
): Promise<Result<Category, CategoryError | CatalogError>> {
  if (actor.role !== 'ADMIN') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const lista = await todas(deps);
  if (!lista.ok) {
    return lista;
  }
  const anterior = lista.value.find((c) => c.id === cambio.id);
  if (anterior === undefined) {
    return err({ code: 'NOT_FOUND' });
  }
  const categoria = buildCategory(cambio.id, cambio);
  if (!categoria.ok) {
    return categoria;
  }
  if (categoryNameTaken(categoria.value.name, lista.value, cambio.id)) {
    return err({ code: 'CATEGORY_NAME_TAKEN' });
  }
  if (anterior.isActive && !categoria.value.isActive) {
    const productos = await deps.products.list();
    if (!productos.ok) {
      return productos;
    }
    if (productos.value.some((p) => p.isActive && p.categoryId === cambio.id)) {
      return err({ code: 'CATEGORY_IN_USE' });
    }
  }
  return deps.categories.updateCategory(categoria.value);
}

/** Sube o baja una categoría un lugar, intercambiando su orden con la vecina [RF-M1-08]. */
export async function moveCategory(
  deps: ManageCategoriesDeps,
  actor: Actor,
  id: CategoryId,
  direccion: 'UP' | 'DOWN',
): Promise<Result<readonly Category[], CategoryError | CatalogError>> {
  if (actor.role !== 'ADMIN') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const lista = await todas(deps);
  if (!lista.ok) {
    return lista;
  }
  const ordenadas = [...lista.value].sort((a, b) => a.sortOrder - b.sortOrder);
  const i = ordenadas.findIndex((c) => c.id === id);
  const j = direccion === 'UP' ? i - 1 : i + 1;
  const esta = ordenadas[i];
  const vecina = ordenadas[j];
  if (esta === undefined) {
    return err({ code: 'NOT_FOUND' });
  }
  if (vecina === undefined) {
    return { ok: true, value: ordenadas };
  }
  const a = await deps.categories.updateCategory({ ...esta, sortOrder: vecina.sortOrder });
  if (!a.ok) {
    return a;
  }
  const b = await deps.categories.updateCategory({ ...vecina, sortOrder: esta.sortOrder });
  if (!b.ok) {
    return b;
  }
  return todas(deps);
}
