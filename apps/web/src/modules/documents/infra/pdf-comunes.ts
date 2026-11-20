import { rgb, type PDFFont, type PDFPage } from 'pdf-lib';

// Tamaño carta en puntos y márgenes.
export const ANCHO = 612;
export const ALTO = 792;
export const MARGEN = 40;
export const PIE = 36;
export const UTIL = ANCHO - 2 * MARGEN;

export const GRIS = rgb(0.35, 0.35, 0.35);
export const NEGRO = rgb(0, 0, 0);
export const LINEA = rgb(0.75, 0.75, 0.75);
// Verde vidrio de la marca [ADR-0037]: título, filetes y encabezado de la tabla.
export const ACENTO = rgb(15 / 255, 92 / 255, 87 / 255);
export const TINTE = rgb(0.92, 0.95, 0.94);

export interface Fuentes {
  readonly normal: PDFFont;
  readonly negrita: PDFFont;
}

/** Lo mínimo para dibujar texto: las fuentes y la página donde se dibuja. */
export interface Lienzo {
  readonly fuentes: Fuentes;
  page: PDFPage;
  y: number;
}

/** Cambia por `?` lo que la fuente estándar (WinAnsi) no puede dibujar, para que un carácter raro no
 *  tire la generación del documento. Acentos, ñ, ¿, ¡, × y ² sí se dibujan. */
export function seguro(texto: string, fuente: PDFFont): string {
  let salida = '';
  for (const caracter of texto.replace(/\s+/g, ' ')) {
    try {
      fuente.widthOfTextAtSize(caracter, 10);
      salida += caracter;
    } catch {
      salida += '?';
    }
  }
  return salida;
}

/** Parte un texto en renglones que quepan en `ancho`; una palabra más larga que el ancho se corta. */
export function envolver(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
  const limpio = seguro(texto, fuente).trim();
  if (limpio === '') {
    return [];
  }
  const renglones: string[] = [];
  let actual = '';
  const medir = (t: string): number => fuente.widthOfTextAtSize(t, tamano);
  for (const palabra of limpio.split(' ')) {
    const candidato = actual === '' ? palabra : `${actual} ${palabra}`;
    if (medir(candidato) <= ancho) {
      actual = candidato;
      continue;
    }
    if (actual !== '') {
      renglones.push(actual);
    }
    let resto = palabra;
    while (medir(resto) > ancho) {
      let corte = resto.length - 1;
      while (corte > 1 && medir(resto.slice(0, corte)) > ancho) {
        corte -= 1;
      }
      renglones.push(resto.slice(0, corte));
      resto = resto.slice(corte);
    }
    actual = resto;
  }
  if (actual !== '') {
    renglones.push(actual);
  }
  return renglones;
}

export function texto(
  e: Lienzo,
  t: string,
  x: number,
  y: number,
  opciones: { size: number; bold?: boolean; color?: ReturnType<typeof rgb>; alignRight?: number },
): void {
  const fuente = opciones.bold === true ? e.fuentes.negrita : e.fuentes.normal;
  const limpio = seguro(t, fuente);
  const xFinal =
    opciones.alignRight === undefined
      ? x
      : opciones.alignRight - fuente.widthOfTextAtSize(limpio, opciones.size);
  e.page.drawText(limpio, {
    x: xFinal,
    y,
    size: opciones.size,
    font: fuente,
    color: opciones.color ?? NEGRO,
  });
}
