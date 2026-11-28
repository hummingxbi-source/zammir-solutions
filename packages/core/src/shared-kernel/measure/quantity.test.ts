import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  addQuantities,
  isValidQuantity,
  isWholeQuantity,
  milliToQuantity,
  parseQuantity,
  quantityToMilli,
} from './quantity';

describe('cantidad con hasta 3 decimales [ADR-0048, D2]', () => {
  it('pasa a milésimas enteras, aunque el número traiga error de punto flotante', () => {
    expect(quantityToMilli(1.5)).toBe(1500);
    expect(quantityToMilli(1.255)).toBe(1255);
    expect(quantityToMilli(0.001)).toBe(1);
    expect(quantityToMilli(2)).toBe(2000);
    expect(quantityToMilli(999_999_999.999)).toBe(999_999_999_999);
    expect(quantityToMilli(0.1 + 0.2)).toBe(300);
  });

  it('no acepta cero, negativos, más de 3 decimales, infinitos ni lo que no cabe', () => {
    for (const malo of [0, -1, 1.2345, 0.0001, Number.NaN, Infinity, 1_000_000_000]) {
      expect(quantityToMilli(malo)).toBeNull();
      expect(isValidQuantity(malo)).toBe(false);
    }
  });

  it('de milésimas a cantidad, limpia', () => {
    expect(milliToQuantity(1500)).toBe(1.5);
    expect(milliToQuantity(333)).toBe(0.333);
    expect(milliToQuantity(2000)).toBe(2);
  });

  it('entera de 1 en adelante', () => {
    expect(isWholeQuantity(1)).toBe(true);
    expect(isWholeQuantity(3)).toBe(true);
    expect(isWholeQuantity(1.5)).toBe(false);
    expect(isWholeQuantity(0)).toBe(false);
  });

  it('suma en milésimas: 0.1 + 0.2 es 0.3', () => {
    expect(addQuantities(0.1, 0.2)).toBe(0.3);
    expect(addQuantities(1.5, 1)).toBe(2.5);
    expect(addQuantities(1.2345, 1)).toBeNull();
    expect(addQuantities(1, 0)).toBeNull();
    expect(addQuantities(999_999_999.999, 1)).toBe(1_000_000_000.999);
  });

  it('lee lo escrito: con decimales solo si el producto los admite', () => {
    expect(parseQuantity(' 1.5 ', true)).toEqual({ ok: true, value: 1.5 });
    expect(parseQuantity('0.333', true)).toEqual({ ok: true, value: 0.333 });
    expect(parseQuantity('2', false)).toEqual({ ok: true, value: 2 });
    for (const [texto, decimales] of [
      ['1.5', false],
      ['1.2345', true],
      ['0', true],
      ['0.000', true],
      ['1e3', true],
      ['0x10', true],
      ['-1', true],
      ['1,5', true],
      ['', true],
      ['.5', true],
    ] as const) {
      expect(parseQuantity(texto, decimales)).toEqual({
        ok: false,
        error: { code: 'QUANTITY_INVALID' },
      });
    }
  });

  it('propiedad: toda cantidad de hasta 3 decimales va a milésimas y regresa igual', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000_000 }), (milesimas) => {
        const cantidad = milliToQuantity(milesimas);
        expect(quantityToMilli(cantidad)).toBe(milesimas);
        expect(parseQuantity(String(cantidad), true)).toEqual({ ok: true, value: cantidad });
      }),
    );
  });
});
