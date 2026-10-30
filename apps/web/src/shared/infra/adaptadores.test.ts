import { describe, expect, it } from 'vitest';

import { systemClock } from './system-clock';
import { uuidIdGenerator } from './uuid-id-generator';

describe('systemClock', () => {
  it('avanza con el tiempo real', async () => {
    const antes = systemClock.now().getTime();
    await new Promise((resolver) => setTimeout(resolver, 15));
    const despues = systemClock.now().getTime();
    expect(despues).toBeGreaterThan(antes);
  });
});

describe('uuidIdGenerator', () => {
  it('no repite en 10 000 llamadas', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 10_000; i += 1) {
      vistos.add(uuidIdGenerator.newId<'Customer'>());
    }
    expect(vistos.size).toBe(10_000);
  });

  it('genera UUID', () => {
    expect(uuidIdGenerator.newId<'Quote'>()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
