import { describe, expect, it } from 'vitest';

import { parseCsv } from './csv';

const BOM = String.fromCharCode(0xfeff);

describe('parseCsv', () => {
  it('lee filas y celdas separadas por coma', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('entiende saltos de línea de Windows y la falta de salto final', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('quita la marca BOM que pone Excel al inicio', () => {
    expect(parseCsv(`${BOM}nombre,precio\nVidrio,280`)).toEqual([
      ['nombre', 'precio'],
      ['Vidrio', '280'],
    ]);
  });

  it('conserva los acentos y la eñe tal cual', () => {
    expect(
      parseCsv('nombre\nVidrio templado de 6 mm\nCristal doble · Ñandú · Pieza estándar · m²'),
    ).toEqual([
      ['nombre'],
      ['Vidrio templado de 6 mm'],
      ['Cristal doble · Ñandú · Pieza estándar · m²'],
    ]);
  });

  it('entiende comillas con comas, comillas dobles y saltos de línea dentro', () => {
    expect(parseCsv('a,b\n"uno, dos","dijo ""hola"""\n"línea 1\nlínea 2",x')).toEqual([
      ['a', 'b'],
      ['uno, dos', 'dijo "hola"'],
      ['línea 1\nlínea 2', 'x'],
    ]);
  });

  it('detecta el punto y coma cuando es el separador', () => {
    expect(parseCsv('nombre;precio\nVidrio;280,50\n')).toEqual([
      ['nombre', 'precio'],
      ['Vidrio', '280,50'],
    ]);
  });

  it('si hay comas y punto y coma, gana el que más aparece fuera de comillas', () => {
    expect(parseCsv('a,b,c;d\n1,2,3;4')).toEqual([
      ['a', 'b', 'c;d'],
      ['1', '2', '3;4'],
    ]);
    expect(parseCsv('"a,b,c";d;e\n1;2;3')).toEqual([
      ['a,b,c', 'd', 'e'],
      ['1', '2', '3'],
    ]);
  });

  it('ignora las filas vacías o solo con comas', () => {
    expect(parseCsv('a,b\n\n,\n1,2\n   ,  \n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('mantiene las celdas vacías en medio de una fila', () => {
    expect(parseCsv('a,b,c\n1,,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ]);
  });

  it('un archivo vacío no tiene filas', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv(BOM)).toEqual([]);
    expect(parseCsv('\n\n')).toEqual([]);
  });
});
