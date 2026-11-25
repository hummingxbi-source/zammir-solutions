import { describe, expect, it } from 'vitest';

import { leerTodo, TAMANO_DE_PAGINA } from './leer-todo';

/** Una fuente falsa que respeta `range(desde, hasta)` como la API: ambos incluidos y nunca más de `tope`. */
function fuente(total: number, tope = TAMANO_DE_PAGINA) {
  const filas = Array.from({ length: total }, (_, i) => i);
  const pedidas: [number, number][] = [];
  const pagina = (desde: number, hasta: number) => {
    pedidas.push([desde, hasta]);
    const fin = Math.min(hasta + 1, desde + tope);
    return Promise.resolve({ data: filas.slice(desde, fin), error: null });
  };
  return { pagina, pedidas };
}

describe('leer todas las filas por páginas (AJ-01)', () => {
  it.each([0, 1, 999, 1000, 1001, 2500])(
    'con %i filas las trae todas, en orden y sin repetir',
    async (total) => {
      const { pagina } = fuente(total);
      const r = await leerTodo(pagina, (e) => e);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.filas).toEqual(Array.from({ length: total }, (_, i) => i));
      }
    },
  );

  it('pide páginas contiguas y se detiene en la primera incompleta', async () => {
    const { pagina, pedidas } = fuente(2500);
    await leerTodo(pagina, (e) => e);
    expect(pedidas).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('con exactamente una página llena pide una más para confirmar que no hay otra', async () => {
    const { pagina, pedidas } = fuente(1000);
    await leerTodo(pagina, (e) => e);
    expect(pedidas).toHaveLength(2);
  });

  it('respeta un tamaño de página propio', async () => {
    const { pagina, pedidas } = fuente(25, 10);
    const r = await leerTodo(pagina, (e) => e, 10);
    expect(r.ok && r.filas.length).toBe(25);
    expect(pedidas).toHaveLength(3);
  });

  it('si una página falla, regresa el error y no una lista a medias', async () => {
    let llamadas = 0;
    const r = await leerTodo(
      () => {
        llamadas += 1;
        return Promise.resolve(
          llamadas === 1
            ? { data: Array.from({ length: 1000 }, () => 0), error: null }
            : { data: null, error: { code: '57014' } },
        );
      },
      (e) => ({ traducido: e }),
    );
    expect(r).toEqual({ ok: false, error: { traducido: { code: '57014' } } });
  });

  it('una respuesta sin datos ni error cuenta como vacía', async () => {
    const r = await leerTodo(
      () => Promise.resolve({ data: null, error: null }),
      (e) => e,
    );
    expect(r).toEqual({ ok: true, filas: [] });
  });
});
