/** Puerto: la hora actual. El dominio nunca llama a `Date.now()` ni a `new Date()`:
 *  la hora llega por aquí, para que las pruebas usen un reloj fijo [00-principios §3.4]. */
export interface Clock {
  now(): Date;
}

/** Reloj de pruebas: siempre devuelve el mismo instante. */
export function fixedClock(instante: Date): Clock {
  const marca = instante.getTime();
  return {
    now: () => new Date(marca),
  };
}
