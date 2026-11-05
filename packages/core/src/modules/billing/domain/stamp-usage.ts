/** Cómo va el paquete de timbres del año [RF-M10-20, PD-26]. */
export type StampUsageLevel =
  /** Todavía hay de sobra. */
  | 'OK'
  /** Ya se usó el porcentaje de aviso del límite (80 % por omisión). */
  | 'WARNING'
  /** Se llegó al límite o se pasó: ya no deben salir facturas sin ampliar el paquete. */
  | 'REACHED'
  /** El límite todavía no está definido (PD-26): no hay aviso que dar. */
  | 'NO_LIMIT';

export interface StampUsage {
  readonly used: number;
  readonly limit: number | null;
  /** Cuántos quedan; `null` sin límite. Nunca negativo. */
  readonly remaining: number | null;
  /** Qué parte del límite se usó, en puntos base (8000 = 80.00 %); `null` sin límite. */
  readonly percentBps: number | null;
  readonly level: StampUsageLevel;
}

/** Evalúa los timbres usados contra el límite anual configurable. El aviso sale al llegar al porcentaje
 *  configurado (80 % por omisión) y se vuelve más serio al llegar al límite. Un límite no definido (PD-26) no
 *  inventa un número: no hay aviso [RF-M10-20]. */
export function evaluateStampUsage(entrada: {
  readonly used: number;
  readonly limit: number | null;
  readonly warningPercent: number;
}): StampUsage {
  const used = Math.max(0, Math.trunc(entrada.used));
  if (entrada.limit === null || entrada.limit <= 0) {
    return { used, limit: null, remaining: null, percentBps: null, level: 'NO_LIMIT' };
  }
  const limit = Math.trunc(entrada.limit);
  const level: StampUsageLevel =
    used >= limit ? 'REACHED' : used * 100 >= limit * entrada.warningPercent ? 'WARNING' : 'OK';
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    percentBps: Math.floor((used * 10_000) / limit),
    level,
  };
}
