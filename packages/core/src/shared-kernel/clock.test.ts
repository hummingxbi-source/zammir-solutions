import { describe, expect, it } from 'vitest';

import { fixedClock } from './clock';

describe('fixedClock', () => {
  it('siempre devuelve el mismo instante', () => {
    const reloj = fixedClock(new Date('2026-10-28T12:00:00Z'));
    expect(reloj.now().toISOString()).toBe('2026-10-28T12:00:00.000Z');
    expect(reloj.now().toISOString()).toBe('2026-10-28T12:00:00.000Z');
  });

  it('no se altera si quien lo usa modifica la fecha que recibió', () => {
    const reloj = fixedClock(new Date('2026-10-28T12:00:00Z'));
    reloj.now().setFullYear(1999);
    expect(reloj.now().toISOString()).toBe('2026-10-28T12:00:00.000Z');
  });

  it('no cambia si se modifica la fecha original', () => {
    const original = new Date('2026-10-28T12:00:00Z');
    const reloj = fixedClock(original);
    original.setFullYear(1999);
    expect(reloj.now().toISOString()).toBe('2026-10-28T12:00:00.000Z');
  });
});
