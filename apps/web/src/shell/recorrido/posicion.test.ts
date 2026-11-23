import { describe, expect, it } from 'vitest';

import { ANCHO_DE_HOJA, colocarGlobo, esVisible, SEPARACION } from './posicion';

const pantalla = { width: 1280, height: 800 };
const globo = { width: 400, height: 240 };

describe('dónde va el globo del recorrido', () => {
  it('sin elemento va al centro de la pantalla', () => {
    expect(colocarGlobo(null, globo, pantalla)).toEqual({ lado: 'centro', top: 280, left: 440 });
  });

  it('debajo del elemento si cabe, centrado sobre él', () => {
    const c = colocarGlobo({ top: 100, left: 600, width: 200, height: 50 }, globo, pantalla);
    expect(c).toEqual({ lado: 'abajo', top: 150 + SEPARACION, left: 500 });
  });

  it('arriba si abajo no cabe', () => {
    const c = colocarGlobo({ top: 600, left: 600, width: 200, height: 50 }, globo, pantalla);
    expect(c.lado).toBe('arriba');
    expect(c.top).toBe(600 - SEPARACION - 240);
  });

  it('respeta el lado preferido: los botones de la barra lateral llevan el globo a la derecha', () => {
    const c = colocarGlobo(
      { top: 200, left: 10, width: 220, height: 44 },
      globo,
      pantalla,
      'derecha',
    );
    expect(c.lado).toBe('derecha');
    expect(c.left).toBe(230 + SEPARACION);
  });

  it('nunca se sale de la pantalla por los lados', () => {
    const c = colocarGlobo({ top: 100, left: 1200, width: 60, height: 30 }, globo, pantalla);
    expect(c.left + globo.width).toBeLessThanOrEqual(pantalla.width - SEPARACION);
    const d = colocarGlobo({ top: 100, left: 0, width: 20, height: 30 }, globo, pantalla);
    expect(d.left).toBeGreaterThanOrEqual(SEPARACION);
  });

  it('con un elemento enorme se pega a la orilla donde tapa menos', () => {
    const c = colocarGlobo({ top: 40, left: 0, width: 1280, height: 560 }, globo, pantalla);
    expect(c.lado).toBe('abajo');
    expect(c.top).toBe(pantalla.height - globo.height - SEPARACION);
  });

  it('en pantallas angostas va como hoja al pie', () => {
    const c = colocarGlobo(
      { top: 10, left: 10, width: 50, height: 50 },
      { width: 375, height: 300 },
      { width: ANCHO_DE_HOJA - 1, height: 800 },
    );
    expect(c).toEqual({ lado: 'hoja', top: 500, left: 0 });
  });

  it('un elemento de tamaño cero no se puede enfocar', () => {
    expect(esVisible({ top: 0, left: 0, width: 0, height: 10 })).toBe(false);
    expect(esVisible({ top: 0, left: 0, width: 10, height: 10 })).toBe(true);
  });
});
