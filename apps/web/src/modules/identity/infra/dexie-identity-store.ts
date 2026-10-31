import Dexie, { type EntityTable } from 'dexie';
import {
  lockDurationSeconds,
  type Clock,
  type LocalLoginStore,
  type LockoutPolicy,
  type LoginSnapshot,
  type PinAttemptGuard,
  type UserId,
} from '@zammir/core';

interface FilaDeCopia {
  readonly clave: string;
  readonly copia: LoginSnapshot;
}

interface FilaDeIntentos {
  readonly userId: UserId;
  readonly failures: number;
  readonly lockedUntilMs: number;
}

class BaseDeIdentidad extends Dexie {
  copia!: EntityTable<FilaDeCopia, 'clave'>;
  intentos!: EntityTable<FilaDeIntentos, 'userId'>;

  constructor(nombre: string) {
    super(nombre);
    this.version(1).stores({ copia: 'clave', intentos: 'userId' });
  }
}

const CLAVE = 'personas';

/** Personas y configuración de entrada guardadas en IndexedDB de la tablet. Lo guardado son los
 *  verificadores del PIN, nunca el PIN [ADR-0013]. Comparten base con los intentos fallidos, que así
 *  sobreviven a cerrar la aplicación. */
export function dexieIdentity(nombre = 'zammir-identidad'): {
  readonly store: LocalLoginStore;
  readonly guard: (clock: Clock, politica: () => Promise<LockoutPolicy | null>) => PinAttemptGuard;
} {
  const base = new BaseDeIdentidad(nombre);
  return {
    store: {
      async replace(nueva) {
        await base.copia.put({ clave: CLAVE, copia: nueva });
      },
      async load() {
        return (await base.copia.get(CLAVE))?.copia ?? null;
      },
    },
    guard: (clock, politica) => ({
      async check(userId) {
        const restante =
          ((await base.intentos.get(userId))?.lockedUntilMs ?? 0) - clock.now().getTime();
        return restante > 0
          ? { locked: true, retryAfterSeconds: Math.ceil(restante / 1000) }
          : { locked: false };
      },
      async recordFailure(userId) {
        const reglas = await politica();
        await base.transaction('rw', base.intentos, async () => {
          const previo = await base.intentos.get(userId);
          const failures = (previo?.failures ?? 0) + 1;
          const segundos = reglas === null ? 0 : lockDurationSeconds(failures, reglas);
          await base.intentos.put({
            userId,
            failures,
            lockedUntilMs:
              segundos > 0 ? clock.now().getTime() + segundos * 1000 : (previo?.lockedUntilMs ?? 0),
          });
        });
      },
      async recordSuccess(userId) {
        await base.intentos.delete(userId);
      },
    }),
  };
}
