import type { Clock, IdGenerator } from '@zammir/core';

import { systemClock } from '../shared/infra/system-clock';
import { uuidIdGenerator } from '../shared/infra/uuid-id-generator';

/** Raíz de composición: el único lugar donde se eligen los adaptadores reales
 *  y se entregan a los casos de uso [00-principios §1.1]. */
export interface Composition {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

export function createComposition(): Composition {
  return { clock: systemClock, idGenerator: uuidIdGenerator };
}
