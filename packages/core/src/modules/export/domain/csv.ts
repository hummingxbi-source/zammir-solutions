/** Marca de orden de bytes UTF-8: sin ella Excel abre los acentos y la ñ mal. */
export const CSV_BOM = '﻿';

/** Un texto que empieza con `=`, `+`, `-`, `@`, tabulador o salto de línea lo interpreta Excel como fórmula y puede
 *  ejecutar algo al abrir el archivo (inyección de fórmulas). Se le antepone un apóstrofo para que sea solo texto. */
const EMPIEZA_COMO_FORMULA = /^[=+\-@\t\r]/;

/** El contenido de una celda como texto, listo para ir entre comas. Los números van tal cual (los importes ya son
 *  centavos enteros), `null` va vacío y un objeto o lista va como JSON. */
export function csvCell(valor: unknown): string {
  let texto: string;
  if (valor === null || valor === undefined) {
    return '';
  }
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? String(valor) : '';
  }
  if (typeof valor === 'boolean') {
    return valor ? 'true' : 'false';
  }
  if (typeof valor === 'string') {
    texto = EMPIEZA_COMO_FORMULA.test(valor) ? `'${valor}` : valor;
  } else {
    texto = JSON.stringify(valor);
  }
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Las columnas de una lista de renglones: las de todos, en el orden en que aparecen por primera vez. */
export function columnsOf(rows: readonly Readonly<Record<string, unknown>>[]): string[] {
  const vistas = new Set<string>();
  for (const fila of rows) {
    for (const columna of Object.keys(fila)) {
      vistas.add(columna);
    }
  }
  return [...vistas];
}

/** Una tabla como CSV (RFC 4180): encabezado y un renglón por fila, con saltos de línea `\r\n` y la marca UTF-8.
 *  Sin renglones queda vacío, porque no hay de dónde sacar las columnas. */
export function toCsv(
  rows: readonly Readonly<Record<string, unknown>>[],
  columns: readonly string[] = columnsOf(rows),
): string {
  if (columns.length === 0) {
    return CSV_BOM;
  }
  const renglones = [
    columns.map((c) => csvCell(c)).join(','),
    ...rows.map((fila) => columns.map((c) => csvCell(fila[c])).join(',')),
  ];
  return `${CSV_BOM}${renglones.join('\r\n')}\r\n`;
}
