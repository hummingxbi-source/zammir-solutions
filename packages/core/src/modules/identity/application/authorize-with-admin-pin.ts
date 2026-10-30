import type { Clock } from '../../../shared-kernel/clock';
import type { UserId } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { PinAttemptGuard } from './pin-attempt-guard';
import type { PinHasher, UserRepository } from './user-ports';

export interface AuthorizeDeps {
  /** En la tablet es la copia local de los usuarios; solo se necesita leer uno. */
  readonly users: Pick<UserRepository, 'get'>;
  readonly hasher: PinHasher;
  readonly guard: PinAttemptGuard;
  readonly clock: Clock;
}

/** Permiso puntual que un administrador da con su PIN. Se pasa a la acción restringida, que lo guarda
 *  como `authorizedBy` en la bitácora [RN-19]. */
export interface Authorization {
  readonly adminId: UserId;
  readonly authorizedAt: Date;
}

export type AuthorizationError =
  /** PIN incorrecto, o la persona no es un administrador activo. No se dice cuál para no dar pistas. */
  | { readonly code: 'AUTH_FAILED' }
  /** Demasiados intentos fallidos: hay que esperar. */
  | { readonly code: 'LOCKED'; readonly retryAfterSeconds: number };

/** Un administrador autoriza una acción restringida tecleando su PIN [RF-M2-03, RF-M3-04, RF-M10-08].
 *  Se elige al administrador (por nombre) y se teclea su PIN: aquí no se adivina entre todos.
 *  El PIN de un cajero, el de un administrador desactivado o uno incorrecto se rechazan igual. */
export async function authorizeWithAdminPin(
  deps: AuthorizeDeps,
  entrada: { readonly adminId: UserId; readonly pin: string },
): Promise<Result<Authorization, AuthorizationError>> {
  const estado = await deps.guard.check(entrada.adminId);
  if (estado.locked) {
    return err({ code: 'LOCKED', retryAfterSeconds: estado.retryAfterSeconds });
  }

  const usuario = await deps.users.get(entrada.adminId);
  const esAdministradorActivo =
    usuario.ok && usuario.value.role === 'ADMIN' && usuario.value.isActive;

  if (!usuario.ok || !esAdministradorActivo) {
    await deps.guard.recordFailure(entrada.adminId);
    return err({ code: 'AUTH_FAILED' });
  }

  if (!(await deps.hasher.verify(entrada.pin, usuario.value.pin))) {
    await deps.guard.recordFailure(entrada.adminId);
    return err({ code: 'AUTH_FAILED' });
  }

  await deps.guard.recordSuccess(entrada.adminId);
  return ok({ adminId: usuario.value.id, authorizedAt: deps.clock.now() });
}
