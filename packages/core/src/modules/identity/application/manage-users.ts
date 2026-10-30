import type { IdGenerator, UserId } from '../../../shared-kernel/id';
import { err, type Result } from '../../../shared-kernel/result';
import type { PinError, PinPolicy } from '../domain/pin';
import { validatePin } from '../domain/pin';
import type { AppUser, StaffRole, UserError } from '../domain/user';
import type { Actor } from '../domain/auth';
import type { PinHasher, UserRepository } from './user-ports';

export interface ManageUsersDeps {
  readonly users: UserRepository;
  readonly hasher: PinHasher;
  readonly idGenerator: IdGenerator;
}

/** Valores de configuración que intervienen: mínimo de dígitos del administrador y vueltas de PBKDF2. */
export interface UserPolicy extends PinPolicy {
  readonly pbkdf2Iterations: number;
}

export type ManageUsersError = UserError | PinError | { readonly code: 'PIN_REQUIRED' };

function noEsAdministrador(actor: Actor): boolean {
  return actor.role !== 'ADMIN';
}

const SIN_PERMISO = err({ code: 'NOT_AUTHORIZED' } as const);

/** Alta de un empleado con rol y PIN. Solo administradores [RF-M8-01]. El PIN se valida (4 a 6 dígitos,
 *  sin triviales, más largo para administradores) y solo se guarda su verificador. */
export async function createUser(
  deps: ManageUsersDeps,
  politica: UserPolicy,
  actor: Actor,
  entrada: { readonly name: string; readonly role: StaffRole; readonly pin: string },
): Promise<Result<AppUser, ManageUsersError>> {
  if (noEsAdministrador(actor)) {
    return SIN_PERMISO;
  }
  const name = entrada.name.trim();
  if (name === '') {
    return err({ code: 'NAME_REQUIRED' });
  }
  const pinValido = validatePin(entrada.pin, entrada.role, politica);
  if (!pinValido.ok) {
    return pinValido;
  }
  const usuario: AppUser = {
    id: deps.idGenerator.newId<'User'>(),
    name,
    role: entrada.role,
    isActive: true,
    pin: await deps.hasher.hash(entrada.pin, politica.pbkdf2Iterations),
  };
  return deps.users.create(usuario);
}

export interface UserChanges {
  readonly name?: string | undefined;
  readonly role?: StaffRole | undefined;
  /** PIN nuevo. Es obligatorio al pasar a administrador: el PIN anterior no se puede revisar. */
  readonly pin?: string | undefined;
}

/** Cambia nombre, rol o PIN. Solo administradores. Restablecer un PIN es esto mismo con `pin`. */
export async function updateUser(
  deps: ManageUsersDeps,
  politica: UserPolicy,
  actor: Actor,
  id: UserId,
  cambios: UserChanges,
): Promise<Result<AppUser, ManageUsersError>> {
  if (noEsAdministrador(actor)) {
    return SIN_PERMISO;
  }
  const actual = await deps.users.get(id);
  if (!actual.ok) {
    return actual;
  }
  const name = cambios.name === undefined ? actual.value.name : cambios.name.trim();
  if (name === '') {
    return err({ code: 'NAME_REQUIRED' });
  }
  const role = cambios.role ?? actual.value.role;
  if (role === 'ADMIN' && actual.value.role !== 'ADMIN' && cambios.pin === undefined) {
    return err({ code: 'PIN_REQUIRED' });
  }
  let pin = actual.value.pin;
  if (cambios.pin !== undefined) {
    const pinValido = validatePin(cambios.pin, role, politica);
    if (!pinValido.ok) {
      return pinValido;
    }
    pin = await deps.hasher.hash(cambios.pin, politica.pbkdf2Iterations);
  }
  return deps.users.update({ ...actual.value, name, role, pin });
}

/** Restablece el PIN de un usuario. Solo administradores, con sesión en línea (el repositorio real
 *  vive en el servidor) [RF-M8-01]. */
export function resetPin(
  deps: ManageUsersDeps,
  politica: UserPolicy,
  actor: Actor,
  id: UserId,
  pinNuevo: string,
): Promise<Result<AppUser, ManageUsersError>> {
  return updateUser(deps, politica, actor, id, { pin: pinNuevo });
}

/** Activa o desactiva a un usuario. Un usuario desactivado no puede entrar y no se borra. */
export async function setUserActive(
  deps: Pick<ManageUsersDeps, 'users'>,
  actor: Actor,
  id: UserId,
  isActive: boolean,
): Promise<Result<AppUser, UserError>> {
  if (noEsAdministrador(actor)) {
    return SIN_PERMISO;
  }
  const actual = await deps.users.get(id);
  if (!actual.ok) {
    return actual;
  }
  return deps.users.update({ ...actual.value, isActive });
}
