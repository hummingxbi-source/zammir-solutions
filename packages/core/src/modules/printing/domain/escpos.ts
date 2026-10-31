import { pairLine, wrapText, type PrintDocument } from './print-document';

/** Tabla de la página de códigos 858 (la que traen las impresoras térmicas) para el español de México. */
const CP858: Readonly<Record<string, number>> = {
  ü: 0x81,
  é: 0x82,
  á: 0xa0,
  í: 0xa1,
  ó: 0xa2,
  ú: 0xa3,
  ñ: 0xa4,
  Ñ: 0xa5,
  '¿': 0xa8,
  '¡': 0xad,
  Ü: 0x9a,
  É: 0x90,
  Á: 0xb5,
  Í: 0xd6,
  Ó: 0xe0,
  Ú: 0xe9,
  '°': 0xf8,
  '²': 0xfd,
  '×': 0x78,
};

/** Convierte texto a bytes de la página 858; lo que no existe en ella sale como `?`. */
export function encodeCp858(texto: string): readonly number[] {
  const bytes: number[] = [];
  for (const c of texto) {
    const codigo = c.codePointAt(0) ?? 63;
    if (codigo >= 0x20 && codigo < 0x7f) {
      bytes.push(codigo);
    } else {
      bytes.push(CP858[c] ?? 63);
    }
  }
  return bytes;
}

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function bytesDeQr(texto: string): readonly number[] {
  const datos = encodeCp858(texto);
  const largo = datos.length + 3;
  return [
    // modelo 2
    GS,
    0x28,
    0x6b,
    0x04,
    0x00,
    0x31,
    0x41,
    0x32,
    0x00,
    // tamaño del módulo: 6 puntos
    GS,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x43,
    0x06,
    // corrección de errores M
    GS,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x45,
    0x31,
    // guardar los datos
    GS,
    0x28,
    0x6b,
    largo & 0xff,
    (largo >> 8) & 0xff,
    0x31,
    0x50,
    0x30,
    ...datos,
    // imprimir
    GS,
    0x28,
    0x6b,
    0x03,
    0x00,
    0x31,
    0x51,
    0x30,
  ];
}

const ALINEACION = { left: 0, center: 1, right: 2 } as const;

/** Codifica el documento en ESC/POS: inicia la impresora, elige la página 858, imprime cada bloque, avanza
 *  el papel y corta. Se prueba byte a byte; la impresora real se prueba al final con la tablet [S3-21]. */
export function encodeEscPos(documento: PrintDocument): Uint8Array {
  const salida: number[] = [ESC, 0x40, ESC, 0x74, 0x13];
  const { width } = documento;
  for (const bloque of documento.blocks) {
    switch (bloque.kind) {
      case 'text': {
        const grande = bloque.large === true;
        const ancho = grande ? Math.floor(width / 2) : width;
        salida.push(ESC, 0x61, ALINEACION[bloque.align ?? 'left']);
        salida.push(ESC, 0x45, bloque.bold === true ? 1 : 0);
        salida.push(GS, 0x21, grande ? 0x11 : 0x00);
        for (const r of wrapText(bloque.text, ancho)) {
          salida.push(...encodeCp858(r), LF);
        }
        salida.push(GS, 0x21, 0x00, ESC, 0x45, 0x00, ESC, 0x61, 0x00);
        break;
      }
      case 'pair':
        salida.push(ESC, 0x61, 0x00, ESC, 0x45, bloque.bold === true ? 1 : 0);
        salida.push(...encodeCp858(pairLine(bloque.left, bloque.right, width)), LF);
        salida.push(ESC, 0x45, 0x00);
        break;
      case 'rule':
        salida.push(ESC, 0x61, 0x00, ...encodeCp858('-'.repeat(width)), LF);
        break;
      case 'qr':
        salida.push(ESC, 0x61, 0x01, ...bytesDeQr(bloque.text), LF, ESC, 0x61, 0x00);
        break;
      case 'feed':
        salida.push(ESC, 0x64, Math.min(255, Math.max(0, bloque.lines)));
        break;
    }
  }
  // avanzar y cortar (corte parcial)
  salida.push(ESC, 0x64, 0x04, GS, 0x56, 0x42, 0x03);
  return Uint8Array.from(salida);
}
