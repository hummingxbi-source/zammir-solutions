import { err, ok, type SheetRenderer, type SummarySheet } from '@zammir/core';
import { PDFDocument, StandardFonts } from 'pdf-lib';

import {
  ACENTO,
  ALTO,
  ANCHO,
  envolver,
  GRIS,
  LINEA,
  MARGEN,
  PIE,
  seguro,
  texto,
  TINTE,
  UTIL,
  type Fuentes,
  type Lienzo,
} from './pdf-comunes';

interface Estado extends Lienzo {
  readonly pdf: PDFDocument;
  readonly hoja: SummarySheet;
}

function paginaNueva(e: Estado): void {
  e.page = e.pdf.addPage([ANCHO, ALTO]);
  e.y = ALTO - MARGEN;
  texto(e, e.hoja.business.name, MARGEN, e.y - 10, { size: 10, bold: true });
  texto(e, e.hoja.title, 0, e.y - 10, { size: 10, alignRight: MARGEN + UTIL });
  e.y -= 38;
}

function asegurarEspacio(e: Estado, alto: number): void {
  if (e.y - alto < MARGEN + PIE) {
    paginaNueva(e);
  }
}

async function encabezado(e: Estado): Promise<void> {
  const { hoja } = e;
  let xTexto = MARGEN;
  if (hoja.business.logo !== undefined) {
    const imagen =
      hoja.business.logo.format === 'png'
        ? await e.pdf.embedPng(hoja.business.logo.bytes)
        : await e.pdf.embedJpg(hoja.business.logo.bytes);
    const escala = Math.min(64 / imagen.width, 64 / imagen.height, 1);
    e.page.drawImage(imagen, {
      x: MARGEN,
      y: e.y - imagen.height * escala,
      width: imagen.width * escala,
      height: imagen.height * escala,
    });
    xTexto = MARGEN + imagen.width * escala + 12;
  }
  texto(e, hoja.business.name, xTexto, e.y - 12, { size: 16, bold: true });
  let yNegocio = e.y - 28;
  for (const dato of [hoja.business.address, hoja.business.phone]) {
    if (dato !== null) {
      texto(e, dato, xTexto, yNegocio, { size: 9, color: GRIS });
      yNegocio -= 12;
    }
  }
  texto(e, hoja.title.toUpperCase(), 0, e.y - 12, {
    size: 14,
    bold: true,
    color: ACENTO,
    alignRight: MARGEN + UTIL,
  });
  if (hoja.subtitle !== null) {
    texto(e, hoja.subtitle, 0, e.y - 28, { size: 11, bold: true, alignRight: MARGEN + UTIL });
  }
  e.y -= Math.max(76, e.y - yNegocio + 14);
  e.page.drawLine({
    start: { x: MARGEN, y: e.y },
    end: { x: MARGEN + UTIL, y: e.y },
    color: ACENTO,
    thickness: 1.5,
  });
  e.y -= 18;
  for (const linea of hoja.meta) {
    texto(e, linea, MARGEN, e.y, { size: 10 });
    e.y -= 14;
  }
  e.y -= 8;
}

function secciones(e: Estado): void {
  for (const seccion of e.hoja.sections) {
    asegurarEspacio(e, 40);
    if (seccion.title !== null) {
      e.page.drawRectangle({ x: MARGEN, y: e.y - 6, width: UTIL, height: 20, color: TINTE });
      texto(e, seccion.title, MARGEN + 6, e.y, { size: 10, bold: true, color: ACENTO });
      e.y -= 24;
    }
    for (const fila of seccion.rows) {
      const fuerte = fila.strong === true;
      const tamano = fuerte ? 12 : 10;
      const renglones = envolver(
        fila.label,
        e.fuentes[fuerte ? 'negrita' : 'normal'],
        tamano,
        UTIL - 140,
      );
      asegurarEspacio(e, renglones.length * 14 + 6);
      renglones.forEach((renglon, i) => {
        texto(e, renglon, MARGEN + 6, e.y - i * 14, { size: tamano, bold: fuerte });
      });
      texto(e, fila.value, 0, e.y, { size: tamano, bold: fuerte, alignRight: MARGEN + UTIL - 6 });
      e.y -= Math.max(1, renglones.length) * 14 + 2;
      e.page.drawLine({
        start: { x: MARGEN, y: e.y + 9 },
        end: { x: MARGEN + UTIL, y: e.y + 9 },
        color: LINEA,
      });
    }
    e.y -= 14;
  }
  if (e.hoja.note !== null) {
    for (const renglon of envolver(e.hoja.note, e.fuentes.normal, 9, UTIL)) {
      asegurarEspacio(e, 12);
      texto(e, renglon, MARGEN, e.y, { size: 9, color: GRIS });
      e.y -= 12;
    }
  }
}

function pies(e: Estado): void {
  const paginas = e.pdf.getPages();
  paginas.forEach((pagina, i) => {
    const t = e.hoja.pageLabel
      .replace('{n}', String(i + 1))
      .replace('{total}', String(paginas.length));
    const limpio = seguro(t, e.fuentes.normal);
    pagina.drawText(limpio, {
      x: MARGEN + UTIL - e.fuentes.normal.widthOfTextAtSize(limpio, 8),
      y: MARGEN - 10,
      size: 8,
      font: e.fuentes.normal,
      color: GRIS,
    });
  });
}

/** Generador de PDF carta de una hoja de resumen (el corte de caja), con `pdf-lib`: corre en la tablet, sin
 *  internet y sin servidor [ADR-0040]. */
export function pdfLibSheetRenderer(): SheetRenderer {
  return {
    async render(hoja) {
      try {
        const pdf = await PDFDocument.create();
        const fuentes: Fuentes = {
          normal: await pdf.embedFont(StandardFonts.Helvetica),
          negrita: await pdf.embedFont(StandardFonts.HelveticaBold),
        };
        const e: Estado = {
          pdf,
          fuentes,
          hoja,
          page: pdf.addPage([ANCHO, ALTO]),
          y: ALTO - MARGEN,
        };
        await encabezado(e);
        secciones(e);
        pies(e);
        return ok(await pdf.save());
      } catch {
        return err({ code: 'RENDER_FAILED' });
      }
    },
  };
}
