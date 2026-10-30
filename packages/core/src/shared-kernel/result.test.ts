import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { andThen, err, map, mapErr, ok, unwrapOr, type Result } from './result';

// Funciones (no constantes) para que TypeScript no reduzca el tipo a Ok o Err.
function exito(valor: number): Result<number, string> {
  return ok(valor);
}

function fallo(mensaje: string): Result<number, string> {
  return err(mensaje);
}

function dividir(a: number, b: number): Result<number, string> {
  return b === 0 ? err('división entre cero') : ok(a / b);
}

describe('Result', () => {
  it('ok guarda el valor y err guarda el error', () => {
    expect(ok(5)).toEqual({ ok: true, value: 5 });
    expect(err('falla')).toEqual({ ok: false, error: 'falla' });
  });

  it('map transforma el éxito y deja pasar el error', () => {
    expect(map(exito(2), (x) => x * 3)).toEqual(ok(6));
    expect(map(fallo('falla'), (x) => x * 3)).toEqual(err('falla'));
  });

  it('mapErr transforma el error y deja pasar el éxito', () => {
    expect(mapErr(fallo('falla'), (e) => e.length)).toEqual(err(5));
    expect(mapErr(exito(1), (e) => e.length)).toEqual(ok(1));
  });

  it('andThen encadena éxitos y se detiene en el primer error', () => {
    expect(andThen(exito(10), (x) => dividir(x, 2))).toEqual(ok(5));
    expect(andThen(exito(10), (x) => dividir(x, 0))).toEqual(err('división entre cero'));
    expect(andThen(fallo('falló antes'), (x) => dividir(x, 2))).toEqual(err('falló antes'));
  });

  it('unwrapOr devuelve el valor o el valor por defecto', () => {
    expect(unwrapOr(exito(7), 0)).toBe(7);
    expect(unwrapOr(fallo('x'), 0)).toBe(0);
  });

  it('map con la identidad no cambia nada (propiedad)', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        expect(map(exito(n), (x) => x)).toEqual(ok(n));
      }),
    );
  });
});
