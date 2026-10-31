/** Puerto: azar. El dominio nunca llama a `Math.random()`: llega por aquí para que las pruebas sean
 *  repetibles [00-principios §3.4]. */
export interface Random {
  /** Entero uniforme en [0, max). `max` es un entero ≥ 1. */
  nextInt(max: number): number;
  /** Fracción en [0, 1), para variaciones como la de la espera entre reintentos. */
  nextFraction(): number;
}

/** Azar de pruebas con semilla (mulberry32): la misma semilla da la misma secuencia. */
export function seededRandom(semilla: number): Random {
  let estado = semilla >>> 0;
  const siguiente = (): number => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    nextFraction: siguiente,
    nextInt: (max) => Math.floor(siguiente() * max),
  };
}
