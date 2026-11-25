/** La API de Supabase entrega como máximo 1000 filas por consulta (`max_rows`). Una lista que lee sin paginar
 *  se corta en silencio al pasar de ese número [AJ-01, ADR-0044]. Este ayudante pide página por página hasta
 *  recibir una incompleta. La consulta debe tener un orden total (con un desempate único) para que ninguna
 *  fila se repita ni se salte entre páginas. */

export const TAMANO_DE_PAGINA = 1000;

interface RespuestaDePagina<T> {
  readonly data: readonly T[] | null;
  readonly error: unknown;
}

/** `pagina(desde, hasta)` arma una consulta NUEVA con `.range(desde, hasta)` (ambos incluidos): un constructor
 *  de Supabase no se puede reutilizar después de esperarlo. */
export async function leerTodo<T, E>(
  pagina: (desde: number, hasta: number) => PromiseLike<RespuestaDePagina<T>>,
  aError: (error: unknown) => E,
  tamano: number = TAMANO_DE_PAGINA,
): Promise<
  { readonly ok: true; readonly filas: readonly T[] } | { readonly ok: false; readonly error: E }
> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += tamano) {
    const respuesta = await pagina(desde, desde + tamano - 1);
    if (respuesta.error !== null && respuesta.error !== undefined) {
      return { ok: false, error: aError(respuesta.error) };
    }
    const datos = respuesta.data ?? [];
    filas.push(...datos);
    if (datos.length < tamano) {
      return { ok: true, filas };
    }
  }
}
