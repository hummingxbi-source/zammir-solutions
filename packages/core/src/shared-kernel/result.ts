/** Resultado de una operación de negocio: éxito o error tipado.
 *  Los errores de negocio son valores, no excepciones [00-principios §3.5]. */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

export function map<T, U, E>(resultado: Result<T, E>, f: (valor: T) => U): Result<U, E> {
  return resultado.ok ? ok(f(resultado.value)) : resultado;
}

export function mapErr<T, E, F>(resultado: Result<T, E>, f: (error: E) => F): Result<T, F> {
  return resultado.ok ? resultado : err(f(resultado.error));
}

/** Encadena otra operación que también puede fallar; se detiene en el primer error. */
export function andThen<T, U, E, F>(
  resultado: Result<T, E>,
  f: (valor: T) => Result<U, F>,
): Result<U, E | F> {
  return resultado.ok ? f(resultado.value) : resultado;
}

export function unwrapOr<T, E>(resultado: Result<T, E>, porDefecto: T): T {
  return resultado.ok ? resultado.value : porDefecto;
}
