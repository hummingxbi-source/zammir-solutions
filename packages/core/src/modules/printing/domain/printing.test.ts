import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { encodeCp858, encodeEscPos } from './escpos';
import {
  pairLine,
  toPlainLines,
  toPlainText,
  wrapText,
  type PrintDocument,
} from './print-document';

describe('renglones del ticket', () => {
  it('parte por palabras sin pasarse del ancho', () => {
    expect(wrapText('Vidrio claro de seis milímetros', 16)).toEqual([
      'Vidrio claro de',
      'seis milímetros',
    ]);
  });

  it('una palabra más larga que el renglón se corta en pedazos', () => {
    expect(wrapText('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('respeta los saltos de línea y no pierde renglones vacíos', () => {
    expect(wrapText('uno\n\ndos', 10)).toEqual(['uno', '', 'dos']);
  });

  it('propiedad: ningún renglón pasa del ancho y no se pierden letras', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 120 }),
        fc.integer({ min: 5, max: 48 }),
        (texto, ancho) => {
          const r = wrapText(texto.replace(/\n/g, ' '), ancho);
          expect(r.every((x) => x.length <= ancho)).toBe(true);
          expect(r.join('').replace(/\s/g, '')).toBe(texto.replace(/\s/g, ''));
        },
      ),
    );
  });

  it('dos columnas: el importe de la derecha nunca se recorta', () => {
    expect(pairLine('Total', '$116.00', 20)).toBe('Total        $116.00');
    expect(pairLine('Un concepto larguísimo', '$1,160.00', 20)).toBe('Un concept $1,160.00');
    expect(pairLine('Un concepto larguísimo', '$1,160.00', 20)).toHaveLength(20);
    expect(pairLine('a', 'bbbbbbbbbbbbbbbbbbbbbbbb', 10)).toBe(' bbbbbbbbbbbbbbbbbbbbbbbb');
  });

  it('alinea al centro y a la derecha, y los bloques grandes caben en la mitad del ancho', () => {
    const doc: PrintDocument = {
      title: 't',
      width: 20,
      blocks: [
        { kind: 'text', text: 'hola', align: 'center' },
        { kind: 'text', text: 'hola', align: 'right' },
        { kind: 'text', text: 'abcdefghijklm', large: true },
        { kind: 'rule' },
        { kind: 'qr', text: 'x' },
        { kind: 'feed', lines: 2 },
      ],
    };
    expect(toPlainLines(doc)).toEqual([
      '        hola',
      '                hola',
      'abcdefghij',
      'klm',
      '--------------------',
      '[QR] x',
      '',
      '',
    ]);
    expect(toPlainText(doc).endsWith('\n')).toBe(true);
  });
});

describe('codificador ESC/POS', () => {
  it('los acentos del español salen en la página 858', () => {
    expect(encodeCp858('áéíóú ñÑ ¿¡ ü')).toEqual([
      0xa0, 0x82, 0xa1, 0xa2, 0xa3, 0x20, 0xa4, 0xa5, 0x20, 0xa8, 0xad, 0x20, 0x81,
    ]);
    expect(encodeCp858('ÁÉÍÓÚÜ')).toEqual([0xb5, 0x90, 0xd6, 0xe0, 0xe9, 0x9a]);
    expect(encodeCp858('°²×')).toEqual([0xf8, 0xfd, 0x78]);
  });

  it('lo que la página no tiene sale como signo de pregunta', () => {
    expect(encodeCp858('a☺b')).toEqual([0x61, 0x3f, 0x62]);
  });

  it('un texto sencillo: inicia, elige página, imprime, avanza y corta (byte a byte)', () => {
    const doc: PrintDocument = {
      title: 't',
      width: 32,
      blocks: [{ kind: 'text', text: 'Hola', align: 'center', bold: true }],
    };
    expect(Array.from(encodeEscPos(doc))).toEqual([
      0x1b,
      0x40, // ESC @
      0x1b,
      0x74,
      0x13, // ESC t 19 (CP858)
      0x1b,
      0x61,
      0x01, // centrado
      0x1b,
      0x45,
      0x01, // negritas
      0x1d,
      0x21,
      0x00, // tamaño normal
      0x48,
      0x6f,
      0x6c,
      0x61,
      0x0a, // "Hola" + LF
      0x1d,
      0x21,
      0x00,
      0x1b,
      0x45,
      0x00,
      0x1b,
      0x61,
      0x00, // restablece
      0x1b,
      0x64,
      0x04, // avanza 4 renglones
      0x1d,
      0x56,
      0x42,
      0x03, // corte parcial
    ]);
  });

  it('el texto grande usa doble ancho y alto', () => {
    const doc: PrintDocument = {
      title: 't',
      width: 32,
      blocks: [{ kind: 'text', text: 'A', large: true }],
    };
    const bytes = Array.from(encodeEscPos(doc));
    expect(bytes.slice(11, 14)).toEqual([0x1d, 0x21, 0x11]);
  });

  it('una línea de dos columnas y una raya salen con su ancho exacto', () => {
    const doc: PrintDocument = {
      title: 't',
      width: 12,
      blocks: [{ kind: 'pair', left: 'Total', right: '$1.00', bold: true }, { kind: 'rule' }],
    };
    const bytes = Array.from(encodeEscPos(doc));
    const texto = String.fromCharCode(...bytes.filter((b) => b >= 0x20 && b < 0x7f));
    expect(texto).toContain('Total  $1.00');
    expect(texto).toContain('------------');
  });

  it('el QR usa los comandos nativos: modelo, tamaño, corrección M, datos con su largo e impresión', () => {
    const doc: PrintDocument = { title: 't', width: 32, blocks: [{ kind: 'qr', text: 'AB' }] };
    const bytes = Array.from(encodeEscPos(doc));
    const inicio = bytes.findIndex(
      (b, i) => b === 0x1d && bytes[i + 1] === 0x28 && bytes[i + 6] === 0x41,
    );
    expect(bytes.slice(inicio, inicio + 9)).toEqual([
      0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
    ]);
    expect(bytes.slice(inicio + 9, inicio + 17)).toEqual([
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06,
    ]);
    expect(bytes.slice(inicio + 17, inicio + 25)).toEqual([
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31,
    ]);
    // guardar: largo = datos + 3
    expect(bytes.slice(inicio + 25, inicio + 36)).toEqual([
      0x1d, 0x28, 0x6b, 0x05, 0x00, 0x31, 0x50, 0x30, 0x41, 0x42, 0x1d,
    ]);
    expect(bytes.slice(inicio + 35, inicio + 43)).toEqual([
      0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
    ]);
  });

  it('un QR largo parte el largo en dos bytes', () => {
    const texto = 'x'.repeat(300);
    const doc: PrintDocument = { title: 't', width: 32, blocks: [{ kind: 'qr', text: texto }] };
    const bytes = Array.from(encodeEscPos(doc));
    const guardar = bytes.findIndex((b, i) => b === 0x1d && bytes[i + 6] === 0x50);
    expect(bytes[guardar + 3]).toBe(303 & 0xff);
    expect(bytes[guardar + 4]).toBe(303 >> 8);
  });

  it('avanzar papel limita a 255 renglones', () => {
    const doc: PrintDocument = { title: 't', width: 32, blocks: [{ kind: 'feed', lines: 999 }] };
    const bytes = Array.from(encodeEscPos(doc));
    expect(bytes.slice(5, 8)).toEqual([0x1b, 0x64, 255]);
  });
});

describe('refuerzo de ESC/POS y renglones', () => {
  const bytesDe = (doc: PrintDocument) => Array.from(encodeEscPos(doc));
  const sub = (a: number[], b: number[]) => a.join(',').includes(b.join(','));

  it('negritas: solo se encienden cuando se piden, en texto y en dos columnas', () => {
    const texto = (bold?: boolean): PrintDocument => ({
      title: 't',
      width: 32,
      blocks: [{ kind: 'text', text: 'A', ...(bold === undefined ? {} : { bold }) }],
    });
    expect(sub(bytesDe(texto(true)), [0x1b, 0x45, 1])).toBe(true);
    expect(sub(bytesDe(texto(false)), [0x1b, 0x45, 1])).toBe(false);
    expect(sub(bytesDe(texto()), [0x1b, 0x45, 1])).toBe(false);
    const par = (bold?: boolean): PrintDocument => ({
      title: 't',
      width: 32,
      blocks: [{ kind: 'pair', left: 'A', right: 'B', ...(bold === undefined ? {} : { bold }) }],
    });
    expect(sub(bytesDe(par(true)), [0x1b, 0x61, 0, 0x1b, 0x45, 1])).toBe(true);
    expect(sub(bytesDe(par(false)), [0x1b, 0x61, 0, 0x1b, 0x45, 0])).toBe(true);
    expect(sub(bytesDe(par()), [0x1b, 0x45, 1])).toBe(false);
    // y siempre se apagan al terminar la línea
    expect(sub(bytesDe(par(true)), [0x0a, 0x1b, 0x45, 0])).toBe(true);
  });

  it('el texto grande parte a la mitad del ancho', () => {
    const doc: PrintDocument = {
      title: 't',
      width: 10,
      blocks: [{ kind: 'text', text: 'abcdefghij', large: true }],
    };
    const texto = String.fromCharCode(...bytesDe(doc).filter((b) => b >= 0x61 && b <= 0x6a));
    expect(texto).toContain('abcde');
    expect(bytesDe(doc).filter((b) => b === 0x0a)).toHaveLength(2);
  });

  it('los caracteres de control y el borrado salen como signo de pregunta; el espacio no', () => {
    expect(encodeCp858('\u001f\u007f')).toEqual([0x3f, 0x3f]);
    expect(encodeCp858(' ~')).toEqual([0x20, 0x7e]);
  });

  it('una palabra larga después de otra manda la anterior en su propio renglón', () => {
    expect(wrapText('ab cdefghij', 4)).toEqual(['ab', 'cdef', 'ghij']);
  });

  it('los espacios de sobra no crean palabras vacías', () => {
    expect(wrapText('  uno   dos  ', 20)).toEqual(['uno dos']);
  });
});
