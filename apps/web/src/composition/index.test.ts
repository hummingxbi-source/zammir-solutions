import { describe, expect, it } from 'vitest';

import { createComposition } from './index';

describe('createComposition', () => {
  it('entrega los adaptadores reales de reloj e identificadores', () => {
    const { clock, idGenerator } = createComposition();
    expect(clock.now()).toBeInstanceOf(Date);
    expect(idGenerator.newId<'Device'>()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
