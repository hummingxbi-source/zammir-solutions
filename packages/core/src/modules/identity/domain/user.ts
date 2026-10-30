import type { UserId } from '../../../shared-kernel/id';
import type { PinVerifier } from './pin';

/** Rol de un empleado del mostrador: administrador o cajero/vendedor [RF-M8-01]. */
export type StaffRole = 'ADMIN' | 'STAFF';

/** Una persona que usa el sistema con su PIN en la tablet registrada. Nunca se borra: se desactiva [RN-18]. */
export interface AppUser {
  readonly id: UserId;
  readonly name: string;
  readonly role: StaffRole;
  readonly isActive: boolean;
  /** Lo único que se guarda del PIN; el PIN en sí no existe en ningún almacén. */
  readonly pin: PinVerifier;
}

export type UserErrorCode =
  | 'NAME_REQUIRED'
  /** Ya hay un usuario con ese nombre (se elige por nombre en la tablet, no puede haber dos iguales). */
  | 'NAME_TAKEN'
  | 'NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'USERS_UNAVAILABLE';

export interface UserError {
  readonly code: UserErrorCode;
}
