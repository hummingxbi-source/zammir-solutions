/** Lo que sale de una impresora de tickets: bloques sencillos que el codificador ESC/POS, el texto plano y
 *  las pruebas leen igual. No sabe de Bluetooth ni de papel; solo de renglones [S3-20]. */
export type PrintBlock =
  | {
      readonly kind: 'text';
      readonly text: string;
      readonly align?: 'left' | 'center' | 'right';
      readonly bold?: boolean;
      readonly large?: boolean;
    }
  | {
      readonly kind: 'pair';
      readonly left: string;
      readonly right: string;
      readonly bold?: boolean;
    }
  | { readonly kind: 'rule' }
  | { readonly kind: 'qr'; readonly text: string }
  | { readonly kind: 'feed'; readonly lines: number };

/** Caracteres por renglón según el papel: 58 mm ≈ 32, 80 mm ≈ 42 o 48 (configurable, PD-15). */
export type PaperWidth = 32 | 42 | 48;

export interface PrintDocument {
  readonly title: string;
  /** Caracteres por renglón (normalmente un `PaperWidth`). */
  readonly width: number;
  readonly blocks: readonly PrintBlock[];
}

/** Parte un texto en renglones de a lo más `ancho` caracteres sin cortar palabras (salvo que una sola
 *  palabra no quepa). */
export function wrapText(texto: string, ancho: number): readonly string[] {
  const renglones: string[] = [];
  for (const parrafo of texto.split('\n')) {
    let actual = '';
    for (const palabra of parrafo.split(/\s+/).filter((p) => p !== '')) {
      let resto = palabra;
      while (resto.length > ancho) {
        if (actual !== '') {
          renglones.push(actual);
          actual = '';
        }
        renglones.push(resto.slice(0, ancho));
        resto = resto.slice(ancho);
      }
      if (actual === '') {
        actual = resto;
      } else if (actual.length + 1 + resto.length <= ancho) {
        actual = `${actual} ${resto}`;
      } else {
        renglones.push(actual);
        actual = resto;
      }
    }
    renglones.push(actual);
  }
  return renglones;
}

function alinear(texto: string, ancho: number, alineacion: 'left' | 'center' | 'right'): string {
  if (alineacion === 'left') {
    return texto;
  }
  const hueco = Math.max(0, ancho - texto.length);
  return alineacion === 'right'
    ? `${' '.repeat(hueco)}${texto}`
    : `${' '.repeat(Math.floor(hueco / 2))}${texto}`;
}

/** Renglón con dos columnas: lo de la izquierda se recorta antes que perder lo de la derecha (el importe). */
export function pairLine(left: string, right: string, ancho: number): string {
  if (right === '') {
    return left;
  }
  const lugar = Math.max(0, ancho - right.length - 1);
  const izquierda = left.length > lugar ? left.slice(0, lugar) : left;
  const relleno = Math.max(1, ancho - izquierda.length - right.length);
  return `${izquierda}${' '.repeat(relleno)}${right}`;
}

/** El ticket como texto plano, renglón por renglón. Es lo que se compara contra la versión aprobada y lo que
 *  se manda cuando el respaldo es compartir o imprimir desde Android. */
export function toPlainLines(documento: PrintDocument): readonly string[] {
  const { width } = documento;
  const salida: string[] = [];
  for (const bloque of documento.blocks) {
    switch (bloque.kind) {
      case 'text': {
        const ancho = bloque.large === true ? Math.floor(width / 2) : width;
        for (const r of wrapText(bloque.text, ancho)) {
          salida.push(alinear(r, ancho, bloque.align ?? 'left'));
        }
        break;
      }
      case 'pair':
        salida.push(pairLine(bloque.left, bloque.right, width));
        break;
      case 'rule':
        salida.push('-'.repeat(width));
        break;
      case 'qr':
        salida.push(`[QR] ${bloque.text}`);
        break;
      case 'feed':
        for (let i = 0; i < bloque.lines; i += 1) {
          salida.push('');
        }
        break;
    }
  }
  return salida;
}

export function toPlainText(documento: PrintDocument): string {
  return `${toPlainLines(documento).join('\n')}\n`;
}
