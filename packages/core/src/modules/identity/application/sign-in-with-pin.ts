import type { UserId } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { LockoutPolicy } from '../domain/pin-lockout';
import type { AppUser, StaffRole, UserError } from '../domain/user';
import type { PinAttemptGuard } from './pin-attempt-guard';
import type { PinHasher } from './user-ports';

/** Lo que la tablet guarda para dejar entrar con PIN sin internet: las personas con su verificador
 *  (nunca el PIN) y los valores de configuración que el bloqueo necesita [ADR-0013]. */
export interface LoginSnapshot {
  readonly users: readonly AppUser[];
  /** `null` mientras los valores sigan por definir (PD-22): entonces no se bloquea. */
  readonly lockout: LockoutPolicy | null;
  /** Minutos sin actividad antes de volver a la pantalla de personas [RF-M4-08]. */
  readonly idleLockMinutes: number;
  /** Horas sin enviar antes de avisar que hay documentos por enviar [S2-06]. */
  readonly syncStaleHours?: number;
}

/** De dónde baja la tablet las personas y la configuración (el servidor). */
export interface LoginReplicaSource {
  load(): Promise<Result<LoginSnapshot, UserError>>;
}

/** Dónde guarda la tablet esa copia. */
export interface LocalLoginStore {
  replace(snapshot: LoginSnapshot): Promise<void>;
  /** `null` si todavía no se ha bajado nada. */
  load(): Promise<LoginSnapshot | null>;
}

/** Baja las personas y la configuración y reemplaza la copia local. Quien se desactivó o ya no está
 *  deja de poder entrar en la siguiente conexión. Sin conexión no se toca lo guardado. */
export async function refreshLogin(deps: {
  readonly source: LoginReplicaSource;
  readonly store: LocalLoginStore;
}): Promise<Result<{ readonly users: number }, UserError>> {
  const bajada = await deps.source.load();
  if (!bajada.ok) {
    return err(bajada.error);
  }
  await deps.store.replace(bajada.value);
  return ok({ users: bajada.value.users.length });
}

/** Persona que entró: lo único que el resto del sistema necesita saber de ella. */
export interface ActiveUser {
  readonly id: UserId;
  readonly name: string;
  readonly role: StaffRole;
}

export type SignInError =
  /** Esta tablet no está registrada o fue revocada: no se entra con PIN. */
  | { readonly code: 'DEVICE_NOT_READY' }
  /** Nunca se han bajado las personas: hace falta conectarse una vez. */
  | { readonly code: 'NO_USERS_YET' }
  /** PIN incorrecto, persona desconocida o desactivada. No se dice cuál para no dar pistas. */
  | { readonly code: 'AUTH_FAILED' }
  | { readonly code: 'LOCKED'; readonly retryAfterSeconds: number };

export interface SignInWithPinDeps {
  readonly store: LocalLoginStore;
  readonly hasher: PinHasher;
  readonly guard: PinAttemptGuard;
  /** ¿Esta tablet está registrada y activa? */
  readonly deviceReady: () => Promise<boolean>;
}

/** Una persona entra a la tablet con su PIN [RF-M8-03, RF-M8-04]: se elige por nombre y se teclea
 *  su PIN; la comparación es local y funciona sin internet. */
export async function signInWithPin(
  deps: SignInWithPinDeps,
  entrada: { readonly userId: UserId; readonly pin: string },
): Promise<Result<ActiveUser, SignInError>> {
  if (!(await deps.deviceReady())) {
    return err({ code: 'DEVICE_NOT_READY' });
  }
  const copia = await deps.store.load();
  if (copia === null) {
    return err({ code: 'NO_USERS_YET' });
  }
  const estado = await deps.guard.check(entrada.userId);
  if (estado.locked) {
    return err({ code: 'LOCKED', retryAfterSeconds: estado.retryAfterSeconds });
  }

  const persona = copia.users.find((u) => u.id === entrada.userId);
  if (persona?.isActive !== true) {
    await deps.guard.recordFailure(entrada.userId);
    return err({ code: 'AUTH_FAILED' });
  }
  if (!(await deps.hasher.verify(entrada.pin, persona.pin))) {
    await deps.guard.recordFailure(entrada.userId);
    return err({ code: 'AUTH_FAILED' });
  }
  await deps.guard.recordSuccess(entrada.userId);
  return ok({ id: persona.id, name: persona.name, role: persona.role });
}
