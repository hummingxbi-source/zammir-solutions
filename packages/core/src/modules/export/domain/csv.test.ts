import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { columnsOf, CSV_BOM, csvCell, toCsv } from './csv';

describe('celdas del CSV', () => {
  it.each([
    [null, ''],
    [undefined, ''],
    [0, '0'],
    [11_600, '11600'],
    [-500, '-500'],
    [Number.NaN, ''],
    [Number.POSITIVE_INFINITY, ''],
    [true, 'true'],
    [false, 'false'],
    ['Ana', 'Ana'],
    ['con, coma', '"con, coma"'],
    ['con "comillas"', '"con ""comillas"""'],
    ['dos\nrenglones', '"dos\nrenglones"'],
    ['salto\r\nde línea', '"salto\r\nde línea"'],
    [{ a: 1, b: 'x' }, '"{""a"":1,""b"":""x""}"'],
    [[1, 2], '"[1,2]"'],
  ])('%j → %s', (valor, esperado) => {
    expect(csvCell(valor)).toBe(esperado);
  });

  it.each([
    ['=SUMA(A1:A2)', "'=SUMA(A1:A2)"],
    ['+5215512345678', "'+5215512345678"],
    ['-cmd', "'-cmd"],
    ['@usuario', "'@usuario"],
    ['\tcon tab', "'\tcon tab"],
  ])('un texto que Excel tomaría por fórmula (%j) va como texto', (valor, esperado) => {
    expect(csvCell(valor)).toBe(esperado);
  });

  it('un número negativo no se confunde con una fórmula', () => {
    expect(csvCell(-1)).toBe('-1');
  });

  it('un texto con coma que además parece fórmula queda entre comillas y con apóstrofo', () => {
    expect(csvCell('=A1,B1')).toBe('"\'=A1,B1"');
  });
});

describe('tablas como CSV', () => {
  it('lleva la marca UTF-8, un encabezado, un renglón por fila y termina en salto de línea', () => {
    const csv = toCsv([
      { id: 1, nombre: 'Ana' },
      { id: 2, nombre: 'Beto, el grande' },
    ]);
    expect(csv).toBe(`${CSV_BOM}id,nombre\r\n1,Ana\r\n2,"Beto, el grande"\r\n`);
  });

  it('las columnas son las de todos los renglones, en el orden en que aparecen', () => {
    expect(columnsOf([{ a: 1 }, { b: 2, a: 3 }, { c: 4 }])).toEqual(['a', 'b', 'c']);
    expect(toCsv([{ a: 1 }, { b: 2 }])).toBe(`${CSV_BOM}a,b\r\n1,\r\n,2\r\n`);
  });

  it('se pueden fijar las columnas y su orden', () => {
    expect(toCsv([{ a: 1, b: 2 }], ['b', 'a'])).toBe(`${CSV_BOM}b,a\r\n2,1\r\n`);
  });

  it('un encabezado raro también se escapa', () => {
    expect(toCsv([{ 'a,b': 1 }])).toBe(`${CSV_BOM}"a,b"\r\n1\r\n`);
  });

  it('sin renglones queda vacío (solo la marca), sin inventar columnas', () => {
    expect(toCsv([])).toBe(CSV_BOM);
  });

  it('los acentos, la ñ y los emojis pasan intactos', () => {
    expect(toCsv([{ nota: 'Peña ñandú ñ 😀' }])).toContain('Peña ñandú ñ 😀');
  });

  it('lo que se escribe se puede leer de vuelta, sea cual sea el texto', () => {
    const leer = (csv: string): string[][] => {
      const cuerpo = csv.slice(CSV_BOM.length);
      const filas: string[][] = [];
      let fila: string[] = [];
      let celda = '';
      let entreComillas = false;
      for (let i = 0; i < cuerpo.length; i += 1) {
        const c = cuerpo.charAt(i);
        if (entreComillas) {
          if (c === '"' && cuerpo.charAt(i + 1) === '"') {
            celda += '"';
            i += 1;
          } else if (c === '"') {
            entreComillas = false;
          } else {
            celda += c;
          }
        } else if (c === '"') {
          entreComillas = true;
        } else if (c === ',') {
          fila.push(celda);
          celda = '';
        } else if (c === '\r' && cuerpo.charAt(i + 1) === '\n') {
          fila.push(celda);
          filas.push(fila);
          fila = [];
          celda = '';
          i += 1;
        } else {
          celda += c;
        }
      }
      return filas;
    };
    fc.assert(
      fc.property(
        fc.array(fc.string({ maxLength: 12 }), { minLength: 1, maxLength: 4 }),
        (textos) => {
          const fila = Object.fromEntries(textos.map((t, i) => [`c${String(i)}`, t]));
          const leidas = leer(toCsv([fila]));
          expect(leidas).toHaveLength(2);
          const esperadas = textos.map((t) => (/^[=+\-@\t\r]/.test(t) ? `'${t}` : t));
          expect(leidas[1]).toEqual(esperadas);
        },
      ),
    );
  });
});
