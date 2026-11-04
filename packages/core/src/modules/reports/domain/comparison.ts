/** Cómo va un periodo contra el anterior [RF-M7-01]. */
export type Trend = 'UP' | 'DOWN' | 'SAME' | 'NO_BASELINE';

export interface Comparison {
  readonly currentCents: number;
  readonly previousCents: number;
  readonly deltaCents: number;
  /** Cambio porcentual en puntos base (1250 = 12.50 %), redondeado al más cercano; `null` si el periodo
   *  anterior fue cero (no hay contra qué comparar y un porcentaje infinito no dice nada). */
  readonly percentBps: number | null;
  readonly trend: Trend;
}

/** Compara dos importes en centavos con aritmética entera. */
export function compareAmounts(actual: number, anterior: number): Comparison {
  const delta = actual - anterior;
  if (anterior === 0) {
    return {
      currentCents: actual,
      previousCents: anterior,
      deltaCents: delta,
      percentBps: null,
      trend: 'NO_BASELINE',
    };
  }
  const magnitud = Math.round((Math.abs(delta) * 10_000) / anterior);
  return {
    currentCents: actual,
    previousCents: anterior,
    deltaCents: delta,
    percentBps: delta < 0 ? -magnitud : magnitud,
    trend: delta > 0 ? 'UP' : delta < 0 ? 'DOWN' : 'SAME',
  };
}
