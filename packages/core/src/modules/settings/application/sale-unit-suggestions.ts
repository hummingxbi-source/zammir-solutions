import { err, ok, type Result } from '../../../shared-kernel/result';
import { MAX_SALE_UNIT_LENGTH, SALE_UNIT_SUGGESTIONS } from '../../catalog/domain/sale-unit';

/** Cota técnica contra un error de captura, no regla de negocio: una lista más larga ya no ayuda a elegir. */
export const MAX_SALE_UNIT_SUGGESTIONS = 50;

export type SaleUnitSuggestionsErrorCode =
  | 'NOT_AUTHORIZED'
  /** Una unidad pasa de 20 caracteres, o son más de 50. */
  | 'INVALID'
  | 'SETTINGS_INVALID'
  | 'SETTINGS_UNAVAILABLE';

export interface SaleUnitSuggestionsError {
  readonly code: SaleUnitSuggestionsErrorCode;
}

/** Puerto: las unidades de venta que se sugieren al capturar un producto, editables en Configuración
 *  [RF-M1-11, PP-40]. */
export interface SaleUnitSuggestionsStore {
  read(): Promise<Result<readonly string[], SaleUnitSuggestionsError>>;
  write(unidades: readonly string[]): Promise<Result<void, SaleUnitSuggestionsError>>;
}

/** Lee la lista escrita, una unidad por renglón: quita espacios y renglones vacíos, y deja una sola vez cada
 *  unidad aunque cambien las mayúsculas ("Rollo" y "rollo"). `null` si una pasa de 20 caracteres o son más de
 *  50. Una lista vacía vale: entonces solo se sugieren las que ya usa el catálogo. */
export function parseSaleUnitSuggestions(texto: string): readonly string[] | null {
  const vistas = new Set<string>();
  const unidades: string[] = [];
  for (const renglon of texto.split(/\r?\n/)) {
    const unidad = renglon.trim();
    if (unidad === '') continue;
    if (unidad.length > MAX_SALE_UNIT_LENGTH) return null;
    const clave = unidad.toLocaleLowerCase('es-MX');
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    unidades.push(unidad);
  }
  return unidades.length > MAX_SALE_UNIT_SUGGESTIONS ? null : unidades;
}

/** Revisa lo que llega de la base: una lista de textos válida, o `null`. */
export function readSaleUnitSuggestions(valor: unknown): readonly string[] | null {
  if (!Array.isArray(valor) || !valor.every((u): u is string => typeof u === 'string')) {
    return null;
  }
  return parseSaleUnitSuggestions(valor.join('\n'));
}

/** Guarda la lista nueva. Solo un administrador la cambia. */
export async function saveSaleUnitSuggestions(
  store: SaleUnitSuggestionsStore,
  actor: { readonly role: string | null },
  texto: string,
): Promise<Result<readonly string[], SaleUnitSuggestionsError>> {
  if (actor.role !== 'ADMIN') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const unidades = parseSaleUnitSuggestions(texto);
  if (unidades === null) {
    return err({ code: 'INVALID' });
  }
  const r = await store.write(unidades);
  return r.ok ? ok(unidades) : r;
}

/** Adaptador en memoria, para pruebas y para cuando no hay servidor: nace con la lista base. */
export function inMemorySaleUnitSuggestions(
  inicial: readonly string[] = SALE_UNIT_SUGGESTIONS,
): SaleUnitSuggestionsStore & { current(): readonly string[] } {
  let actual = [...inicial];
  return {
    read: () => Promise.resolve(ok(actual)),
    write: (unidades) => {
      actual = [...unidades];
      return Promise.resolve(ok(undefined));
    },
    current: () => actual,
  };
}
