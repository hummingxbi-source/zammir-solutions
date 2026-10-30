import type { CategoryId } from '../../../shared-kernel/id';
import type { ProductKind } from './product';

/** Texto sin acentos, en minúsculas y con los espacios compactados, para comparar sin fijarse en cómo
 *  se escribió: "Vídrio  TEMPLADO" y "vidrio templado" quedan iguales [RF-M1-03]. */
export function normalizeSearchText(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Lo mínimo que la búsqueda necesita de un producto: sirve igual para el catálogo completo
 *  que para los productos que se ven al vender. */
export interface Searchable {
  readonly name: string;
  readonly code: string | null;
  readonly categoryId: CategoryId;
  readonly kind: ProductKind;
}

export interface ProductFilters {
  /** Texto libre: cada palabra debe aparecer en el nombre o en el código. */
  readonly text?: string;
  readonly categoryId?: CategoryId;
  readonly kind?: ProductKind;
}

/** Busca en una lista de productos ya cargada (también funciona sin internet). Las palabras se
 *  combinan con "y", y los filtros por categoría y tipo se combinan entre sí: el resultado es la
 *  intersección. Los productos cuyo nombre empieza con la búsqueda salen primero; después, por
 *  nombre. */
export function searchProducts<T extends Searchable>(
  productos: readonly T[],
  filtros: ProductFilters = {},
): T[] {
  const palabras = normalizeSearchText(filtros.text ?? '')
    .split(' ')
    .filter((palabra) => palabra !== '');

  const encontrados = productos.flatMap((producto) => {
    if (filtros.categoryId !== undefined && producto.categoryId !== filtros.categoryId) {
      return [];
    }
    if (filtros.kind !== undefined && producto.kind !== filtros.kind) {
      return [];
    }
    const nombre = normalizeSearchText(producto.name);
    const paja = `${nombre} ${normalizeSearchText(producto.code ?? '')}`;
    if (!palabras.every((palabra) => paja.includes(palabra))) {
      return [];
    }
    const empieza = palabras.length > 0 && nombre.startsWith(palabras.join(' ')) ? 0 : 1;
    return [{ producto, nombre, empieza }];
  });

  return encontrados
    .sort((a, b) => a.empieza - b.empieza || a.nombre.localeCompare(b.nombre, 'es'))
    .map((e) => e.producto);
}
