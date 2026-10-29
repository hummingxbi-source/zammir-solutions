import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { sumar } from './suma';

describe('sumar (andamio de pruebas)', () => {
  it('suma dos enteros', () => {
    expect(sumar(2, 3)).toBe(5);
  });

  it('es conmutativa para cualquier par de enteros (propiedad)', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        expect(sumar(a, b)).toBe(sumar(b, a));
      }),
    );
  });
});
