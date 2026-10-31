import type { Clock } from '../../../shared-kernel/clock';
import type { UserId } from '../../../shared-kernel/id';
import type { ActiveUser } from './sign-in-with-pin';

export type SessionState =
  { readonly kind: 'LOCKED' } | { readonly kind: 'ACTIVE'; readonly user: ActiveUser };

/** Quién está usando la tablet ahora [RF-M8-03, RF-M4-08]. La sesión del dispositivo no se toca: solo
 *  cambia la persona. Al pasar el tiempo sin actividad, la tablet vuelve a la pantalla de personas;
 *  lo que cada persona tenía capturado se conserva como su borrador. */
export interface ActiveUserSession {
  state(): SessionState;
  /** La persona activa, o `null` si la tablet está bloqueada. Toda acción se atribuye a ella. */
  actingUser(): ActiveUser | null;
  enter(user: ActiveUser): void;
  /** Se llama en cada actividad (toque, tecla). Si ya pasó el tiempo, bloquea en lugar de renovar. */
  touch(): void;
  /** Revisa si ya pasó el tiempo sin actividad; lo llama un temporizador. */
  check(): void;
  /** Cambiar de usuario: vuelve a la pantalla de personas conservando los borradores. */
  switchUser(): void;
  saveDraft(userId: UserId, key: string, value: unknown): void;
  draft(userId: UserId, key: string): unknown;
  subscribe(listener: () => void): () => void;
}

/** `idleMinutes` se consulta en cada revisión (puede cambiar al bajar la configuración); `null`
 *  (valor por definir) no bloquea por inactividad. */
export function createActiveUserSession(
  clock: Clock,
  idleMinutes: () => number | null,
): ActiveUserSession {
  let estado: SessionState = { kind: 'LOCKED' };
  let ultimaActividadMs = 0;
  const borradores = new Map<string, unknown>();
  const oyentes = new Set<() => void>();

  function cambiar(nuevo: SessionState): void {
    estado = nuevo;
    for (const oyente of [...oyentes]) {
      oyente();
    }
  }

  function vencida(): boolean {
    const limite = idleMinutes();
    return limite !== null && clock.now().getTime() - ultimaActividadMs >= limite * 60_000;
  }

  return {
    state: () => estado,
    actingUser: () => (estado.kind === 'ACTIVE' ? estado.user : null),
    enter(user) {
      ultimaActividadMs = clock.now().getTime();
      cambiar({ kind: 'ACTIVE', user });
    },
    touch() {
      if (estado.kind !== 'ACTIVE') {
        return;
      }
      if (vencida()) {
        cambiar({ kind: 'LOCKED' });
        return;
      }
      ultimaActividadMs = clock.now().getTime();
    },
    check() {
      if (estado.kind === 'ACTIVE' && vencida()) {
        cambiar({ kind: 'LOCKED' });
      }
    },
    switchUser() {
      if (estado.kind === 'ACTIVE') {
        cambiar({ kind: 'LOCKED' });
      }
    },
    saveDraft(userId, key, value) {
      borradores.set(`${userId}\u0000${key}`, value);
    },
    draft: (userId, key) => borradores.get(`${userId}\u0000${key}`),
    subscribe(listener) {
      oyentes.add(listener);
      return () => {
        oyentes.delete(listener);
      };
    },
  };
}
