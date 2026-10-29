import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { hasIdleExpired } from './auth';

const MINUTO = 60_000;
const inicio = new Date('2026-10-29T10:00:00Z');

function despues(ms: number): Date {
  return new Date(inicio.getTime() + ms);
}

describe('hasIdleExpired', () => {
  it('antes de cumplirse el tiempo la sesión sigue abierta', () => {
    expect(hasIdleExpired(inicio, despues(29 * MINUTO + 59_999), 30)).toBe(false);
  });

  it('justo al cumplirse el tiempo la sesión se cierra', () => {
    expect(hasIdleExpired(inicio, despues(30 * MINUTO), 30)).toBe(true);
  });

  it('después de cumplirse el tiempo la sesión se cierra', () => {
    expect(hasIdleExpired(inicio, despues(31 * MINUTO), 30)).toBe(true);
  });

  it('sin límite configurado (por definir, PD-21) nunca cierra la sesión por inactividad', () => {
    expect(hasIdleExpired(inicio, despues(1000 * 60 * MINUTO), null)).toBe(false);
  });

  it('con actividad reciente no cierra, sea cual sea el límite (propiedad)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 600 }), (limite) => {
        expect(hasIdleExpired(inicio, inicio, limite)).toBe(false);
      }),
    );
  });
});
