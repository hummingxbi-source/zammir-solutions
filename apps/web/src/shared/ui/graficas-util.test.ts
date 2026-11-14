import { describe, expect, it } from 'vitest';

import {
  escalaAmable,
  pesosCompactos,
  porcionesDeDona,
  textoDePorcion,
  trazoDeLinea,
} from './graficas-util';

describe('escalaAmable', () => {
  it('redondea el tope a un número amable y nunca queda por debajo del máximo', () => {
    expect(escalaAmable(232_000)).toEqual({
      tope: 240_000,
      marcas: [0, 60_000, 120_000, 180_000, 240_000],
    });
    expect(escalaAmable(100)).toEqual({ tope: 100, marcas: [0, 25, 50, 75, 100] });
    expect(escalaAmable(101).tope).toBeGreaterThanOrEqual(101);
    expect(escalaAmable(7).tope).toBeGreaterThanOrEqual(7);
  });

  it('con un máximo de 0, negativo o no finito devuelve una escala mínima', () => {
    for (const m of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(escalaAmable(m)).toEqual({ tope: 4, marcas: [0, 1, 2, 3, 4] });
    }
  });

  it('respeta el número de divisiones', () => {
    const e = escalaAmable(1_000, 2);
    expect(e.marcas).toHaveLength(3);
    expect(e.marcas[0]).toBe(0);
    expect(e.marcas[2]).toBe(e.tope);
  });

  it('el tope siempre cubre el máximo en una barrida de valores', () => {
    for (let m = 1; m < 5_000_000; m = Math.ceil(m * 1.37) + 1) {
      const e = escalaAmable(m);
      expect(e.tope).toBeGreaterThanOrEqual(m);
      expect(e.marcas.at(-1)).toBe(e.tope);
    }
  });
});

describe('pesosCompactos', () => {
  it.each([
    [0, '$0'],
    [80_000, '$800'],
    [99_950, '$1k'],
    [250_000, '$2.5k'],
    [232_000, '$2.3k'],
    [1_000_000, '$10k'],
    [15_000_000, '$150k'],
    [250_000_000, '$2.5M'],
    [-250_000, '-$2.5k'],
  ])('%i centavos → %s', (centavos, texto) => {
    expect(pesosCompactos(centavos)).toBe(texto);
  });
});

describe('porcionesDeDona', () => {
  it('las porciones suman exactamente 10 000 aunque el reparto no sea exacto', () => {
    const p = porcionesDeDona([{ valor: 1 }, { valor: 1 }, { valor: 1 }]);
    expect(p.reduce((s, x) => s + x.bps, 0)).toBe(10_000);
    expect(p.map((x) => x.bps)).toEqual([3334, 3333, 3333]);
  });

  it('cada porción empieza donde termina la anterior', () => {
    const p = porcionesDeDona([{ valor: 50 }, { valor: 30 }, { valor: 20 }]);
    expect(p.map((x) => [x.inicioBps, x.bps])).toEqual([
      [0, 5000],
      [5000, 3000],
      [8000, 2000],
    ]);
  });

  it('sin nada que repartir devuelve vacío, y los negativos cuentan como cero', () => {
    expect(porcionesDeDona([])).toEqual([]);
    expect(porcionesDeDona([{ valor: 0 }, { valor: 0 }])).toEqual([]);
    const p = porcionesDeDona([{ valor: -5 }, { valor: 10 }]);
    expect(p.map((x) => x.bps)).toEqual([0, 10_000]);
  });

  it('conserva el dato original de cada porción', () => {
    const dato = { valor: 7, etiqueta: 'A' };
    expect(porcionesDeDona([dato])[0]?.dato).toBe(dato);
  });
});

describe('textoDePorcion', () => {
  it.each([
    [10_000, '100.0 %'],
    [3333, '33.3 %'],
    [5, '0.1 %'],
    [0, '0.0 %'],
    [4, '0.0 %'],
  ])('%i bps → %s', (bps, texto) => {
    expect(textoDePorcion(bps)).toBe(texto);
  });
});

describe('trazoDeLinea', () => {
  it('sin valores no dibuja nada', () => {
    expect(trazoDeLinea([], 100, 600, 200)).toEqual({ linea: '', area: '', ultimo: null });
  });

  it('el valor máximo toca el borde de arriba y el cero el de abajo', () => {
    const t = trazoDeLinea([0, 100], 100, 600, 200);
    expect(t.linea).toBe('M0.0 200.0 L600.0 0.0');
    expect(t.ultimo).toEqual({ x: 600, y: 0 });
    expect(t.area).toBe('M0.0 200.0 L600.0 0.0 L600.0 200 L0.0 200 Z');
  });

  it('con un solo valor lo centra', () => {
    expect(trazoDeLinea([50], 100, 600, 200).linea).toBe('M300.0 100.0');
  });

  it('con tope 0 deja todo abajo y los negativos no se salen del cuadro', () => {
    expect(trazoDeLinea([5, 5], 0, 100, 40).linea).toBe('M0.0 40.0 L100.0 40.0');
    expect(trazoDeLinea([-5, 10], 10, 100, 40).linea).toBe('M0.0 40.0 L100.0 0.0');
  });
});
