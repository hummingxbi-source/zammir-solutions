import type { Clock } from '../../../shared-kernel/clock';
import type { UserId } from '../../../shared-kernel/id';
import { lockDurationSeconds, type LockoutPolicy } from '../domain/pin-lockout';

export type LockStatus =
  { readonly locked: false } | { readonly locked: true; readonly retryAfterSeconds: number };

/** Puerto: cuenta los intentos fallidos de PIN por persona y bloquea con tiempo creciente.
 *  En la tablet vive en IndexedDB (sobrevive a cerrar la aplicación) [ADR-0013 punto 3]. */
export interface PinAttemptGuard {
  check(userId: UserId): Promise<LockStatus>;
  recordFailure(userId: UserId): Promise<void>;
  /** Un acierto borra los intentos fallidos. */
  recordSuccess(userId: UserId): Promise<void>;
}

interface Registro {
  failures: number;
  lockedUntilMs: number;
}

/** Adaptador en memoria. Con `politica` en `null` (valores todavía por definir) no bloquea nunca. */
export function inMemoryPinAttemptGuard(
  clock: Clock,
  politica: LockoutPolicy | null,
): PinAttemptGuard {
  const registros = new Map<UserId, Registro>();

  return {
    check(userId) {
      const restante = (registros.get(userId)?.lockedUntilMs ?? 0) - clock.now().getTime();
      return Promise.resolve(
        restante > 0
          ? { locked: true, retryAfterSeconds: Math.ceil(restante / 1000) }
          : { locked: false },
      );
    },

    recordFailure(userId) {
      const registro = registros.get(userId) ?? { failures: 0, lockedUntilMs: 0 };
      registro.failures += 1;
      if (politica !== null) {
        const segundos = lockDurationSeconds(registro.failures, politica);
        if (segundos > 0) {
          registro.lockedUntilMs = clock.now().getTime() + segundos * 1000;
        }
      }
      registros.set(userId, registro);
      return Promise.resolve();
    },

    recordSuccess(userId) {
      registros.delete(userId);
      return Promise.resolve();
    },
  };
}
