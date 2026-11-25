import type { CategoryId } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';
import { normalizeSearchText } from './search';
import { fiscalDataIsValid, type Category, type FiscalData } from './product';

/** Largo máximo del nombre de una categoría. */
export const MAX_CATEGORY_NAME_LENGTH = 60;

export interface CategoryDraft {
  readonly name: string;
  readonly sortOrder: number;
  readonly fiscalDefaults: FiscalData;
  readonly isActive: boolean;
}

export type CategoryErrorCode = 'INVALID_NAME' | 'INVALID_SORT_ORDER' | 'INVALID_FISCAL';

export interface CategoryError {
  readonly code: CategoryErrorCode;
}

/** Valida una categoría antes de guardarla [RF-M1-08, ADR-0044]: nombre sin espacios sobrantes, orden entero
 *  positivo y claves fiscales con el formato del SAT (o vacías). */
export function buildCategory(
  id: CategoryId,
  borrador: CategoryDraft,
): Result<Category, CategoryError> {
  const nombre = borrador.name.trim().replace(/\s+/g, ' ');
  if (nombre === '' || nombre.length > MAX_CATEGORY_NAME_LENGTH) {
    return err({ code: 'INVALID_NAME' });
  }
  if (!Number.isSafeInteger(borrador.sortOrder) || borrador.sortOrder < 1) {
    return err({ code: 'INVALID_SORT_ORDER' });
  }
  if (!fiscalDataIsValid(borrador.fiscalDefaults)) {
    return err({ code: 'INVALID_FISCAL' });
  }
  return ok({
    id,
    name: nombre,
    sortOrder: borrador.sortOrder,
    fiscalDefaults: borrador.fiscalDefaults,
    isActive: borrador.isActive,
  });
}

/** ¿Ya hay otra categoría con ese nombre? Se compara sin acentos ni mayúsculas, como la importación. */
export function categoryNameTaken(
  nombre: string,
  categorias: readonly Pick<Category, 'id' | 'name'>[],
  exceptoId?: CategoryId,
): boolean {
  const buscado = normalizeSearchText(nombre);
  return categorias.some((c) => c.id !== exceptoId && normalizeSearchText(c.name) === buscado);
}

/** Orden de una categoría nueva: al final. */
export function nextSortOrder(categorias: readonly Pick<Category, 'sortOrder'>[]): number {
  return categorias.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1;
}

/** Categorías en el orden en que se muestran: por su orden y, si empatan, por nombre. */
export function sortCategories<C extends Pick<Category, 'sortOrder' | 'name'>>(
  categorias: readonly C[],
): readonly C[] {
  return [...categorias].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es-MX'),
  );
}
