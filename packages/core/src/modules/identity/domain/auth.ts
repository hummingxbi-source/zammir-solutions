/** Rol de un usuario del sistema [docs/producto/GLOSARIO.md]: administrador, cajero/vendedor o la tablet registrada. */
export type UserRole = 'ADMIN' | 'STAFF' | 'DEVICE';

export interface AuthenticatedUser {
  readonly userId: string;
  readonly email: string;
  /** `null` si la cuenta existe pero todavía no tiene rol asignado: no tiene permisos. */
  readonly role: UserRole | null;
}

export type AuthErrorCode =
  /** Datos mal escritos (correo sin forma de correo, contraseña vacía). */
  | 'INVALID_INPUT'
  /** Correo o contraseña incorrectos. Nunca se distingue cuál de los dos, para no revelar qué correos existen. */
  | 'INVALID_CREDENTIALS'
  /** La cuenta es válida pero no es de administrador. */
  | 'NOT_AN_ADMIN'
  /** No hubo conexión con el servidor. */
  | 'NETWORK_UNAVAILABLE';

export interface AuthError {
  readonly code: AuthErrorCode;
}

const MS_POR_MINUTO = 60_000;

/** ¿Ya pasó el tiempo de inactividad? Sin límite configurado (`null`, por definir en PD-21)
 *  no se cierra la sesión por este motivo: el valor no se inventa. */
export function hasIdleExpired(
  lastActivityAt: Date,
  now: Date,
  limitMinutes: number | null,
): boolean {
  if (limitMinutes === null) {
    return false;
  }
  return now.getTime() - lastActivityAt.getTime() >= limitMinutes * MS_POR_MINUTO;
}

/** Quién pide una acción: su rol decide si el caso de uso la permite. Sin rol (`null`) no tiene permisos. */
export interface Actor {
  readonly role: UserRole | null;
}
