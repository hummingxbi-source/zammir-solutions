/** Bloqueo por intentos fallidos de PIN [RNF-09, ADR-0013, PD-22]. Los valores salen de la
 *  configuración (`pin_max_failed_attempts`, `pin_lock_seconds`, `pin_lock_max_seconds`). */
export interface LockoutPolicy {
  /** Intentos fallidos seguidos que se toleran antes de bloquear; el que llega a este número ya bloquea. */
  readonly maxAttempts: number;
  /** Duración del primer bloqueo, en segundos. */
  readonly baseSeconds: number;
  /** El bloqueo nunca pasa de esto. */
  readonly capSeconds: number;
}

/** Segundos de bloqueo tras `failures` intentos fallidos seguidos: 0 mientras no se llegue al máximo y,
 *  desde ahí, el bloqueo se duplica con cada intento fallido más (30 s, 60 s, 120 s…) hasta el tope. */
export function lockDurationSeconds(failures: number, politica: LockoutPolicy): number {
  if (failures < politica.maxAttempts) {
    return 0;
  }
  // El exponente se acota para que un contador enorme no produzca infinitos antes del tope.
  const duplicaciones = Math.min(failures - politica.maxAttempts, 30);
  return Math.min(politica.capSeconds, politica.baseSeconds * 2 ** duplicaciones);
}
