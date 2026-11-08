import type { ExportReport } from '@zammir/core';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

// Tamaño carta, vertical, con letra chica para que quepan las columnas.
const ANCHO = 612;
const ALTO = 792;
const MARGEN = 36;
const PIE = 30;
const UTIL = ANCHO - 2 * MARGEN;
const TAMANO = 7.5;
const INTERLINEADO = 11;
const GRIS = rgb(0.35, 0.35, 0.35);
const NEGRO = rgb(0, 0, 0);
const LINEA = rgb(0.8, 0.8, 0.8);

/** Cambia por `?` lo que la fuente estándar no puede dibujar, para que un carácter raro no tire el documento.
 *  Acentos, ñ, ¿ y ¡ sí se dibujan. */
function seguro(texto: string, fuente: PDFFont): string {
  let salida = '';
  for (const caracter of texto.replace(/\s+/g, ' ')) {
    try {
      fuente.widthOfTextAtSize(caracter, TAMANO);
      salida += caracter;
    } catch {
      salida += '?';
    }
  }
  return salida;
}

/** Recorta un texto con puntos suspensivos para que quepa en `ancho`. */
function ajustar(texto: string, fuente: PDFFont, tamano: number, ancho: number): string {
  const limpio = seguro(texto, fuente);
  if (fuente.widthOfTextAtSize(limpio, tamano) <= ancho) {
    return limpio;
  }
  let corto = limpio;
  while (corto.length > 1 && fuente.widthOfTextAtSize(`${corto}…`, tamano) > ancho) {
    corto = corto.slice(0, -1);
  }
  return `${corto.trimEnd()}…`;
}

/** Dibuja el resumen de la exportación como PDF: un título y, por cada tabla, su nombre, cuántos renglones tiene y
 *  una tabla con las columnas principales. Si una tabla no cabe completa, lo dice [S5-08]. */
export async function renderExportPdf(reporte: ExportReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(reporte.title);
  pdf.setSubject(reporte.subtitle);

  let pagina: PDFPage = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const asegurar = (alto: number): void => {
    if (y - alto < MARGEN + PIE) {
      pagina = pdf.addPage([ANCHO, ALTO]);
      y = ALTO - MARGEN;
    }
  };
  const texto = (t: string, x: number, fuente: PDFFont, tamano: number, color = NEGRO): void => {
    pagina.drawText(seguro(t, fuente), { x, y, size: tamano, font: fuente, color });
  };

  texto(reporte.title, MARGEN, negrita, 18);
  y -= 22;
  texto(reporte.subtitle, MARGEN, normal, 9, GRIS);
  y -= 24;

  for (const seccion of reporte.sections) {
    asegurar(INTERLINEADO * 5);
    texto(seccion.title, MARGEN, negrita, 11);
    const resumen = `${String(seccion.totalRows)} ${seccion.totalRows === 1 ? 'renglón' : 'renglones'}`;
    const ancho = negrita.widthOfTextAtSize(seguro(seccion.title, negrita), 11);
    texto(`  ${resumen}`, MARGEN + ancho, normal, 8, GRIS);
    y -= INTERLINEADO + 3;

    if (seccion.totalRows === 0) {
      texto('Sin renglones.', MARGEN, normal, TAMANO, GRIS);
      y -= INTERLINEADO + 10;
      continue;
    }

    const anchoColumna = UTIL / Math.max(1, seccion.columns.length);
    const encabezado = (): void => {
      seccion.columns.forEach((c, i) => {
        texto(
          ajustar(c, negrita, TAMANO, anchoColumna - 4),
          MARGEN + i * anchoColumna,
          negrita,
          TAMANO,
        );
      });
      y -= 3;
      pagina.drawLine({
        start: { x: MARGEN, y },
        end: { x: ANCHO - MARGEN, y },
        thickness: 0.5,
        color: LINEA,
      });
      y -= INTERLINEADO - 3;
    };
    encabezado();

    for (const fila of seccion.rows) {
      if (y - INTERLINEADO < MARGEN + PIE) {
        asegurar(ALTO);
        texto(`${seccion.title} (continúa)`, MARGEN, negrita, 9, GRIS);
        y -= INTERLINEADO + 2;
        encabezado();
      }
      fila.forEach((celda, i) => {
        texto(
          ajustar(celda, normal, TAMANO, anchoColumna - 4),
          MARGEN + i * anchoColumna,
          normal,
          TAMANO,
        );
      });
      y -= INTERLINEADO;
    }
    if (seccion.omittedRows > 0) {
      asegurar(INTERLINEADO * 2);
      texto(
        `… y ${String(seccion.omittedRows)} ${seccion.omittedRows === 1 ? 'renglón más' : 'renglones más'}: están completos en los archivos CSV y JSON.`,
        MARGEN,
        normal,
        TAMANO,
        GRIS,
      );
      y -= INTERLINEADO;
    }
    y -= 12;
  }

  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    p.drawText(`${reporte.title} · página ${String(i + 1)} de ${String(paginas.length)}`, {
      x: MARGEN,
      y: MARGEN - 8,
      size: 7,
      font: normal,
      color: GRIS,
    });
  });

  return pdf.save();
}
