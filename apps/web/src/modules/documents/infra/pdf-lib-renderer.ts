import { err, ok, type DocumentRenderer, type QuoteDocument } from '@zammir/core';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

// Tamaño carta en puntos y márgenes.
const ANCHO = 612;
const ALTO = 792;
const MARGEN = 40;
const PIE = 36;
const UTIL = ANCHO - 2 * MARGEN;

const COL_POS = 22;
const COL_CANT = 38;
const COL_UNIT = 78;
const COL_IMPORTE = 84;
const COL_CONCEPTO = UTIL - COL_POS - COL_CANT - COL_UNIT - COL_IMPORTE;

const GRIS = rgb(0.35, 0.35, 0.35);
const NEGRO = rgb(0, 0, 0);
const LINEA = rgb(0.75, 0.75, 0.75);
const ROJO = rgb(0.75, 0.1, 0.1);

interface Fuentes {
  readonly normal: PDFFont;
  readonly negrita: PDFFont;
}

interface Estado {
  readonly pdf: PDFDocument;
  readonly fuentes: Fuentes;
  readonly doc: QuoteDocument;
  page: PDFPage;
  y: number;
}

/** Cambia por `?` lo que la fuente estándar (WinAnsi) no puede dibujar, para que un carácter raro no
 *  tire la generación del documento. Acentos, ñ, ¿, ¡, × y ² sí se dibujan. */
function seguro(texto: string, fuente: PDFFont): string {
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
function envolver(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
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

function texto(
  e: Estado,
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

function encabezadoDeTabla(e: Estado): void {
  const l = e.doc.labels;
  const y = e.y;
  e.page.drawLine({
    start: { x: MARGEN, y: y + 12 },
    end: { x: MARGEN + UTIL, y: y + 12 },
    color: LINEA,
  });
  texto(e, '#', MARGEN, y, { size: 8, bold: true, color: GRIS });
  texto(e, l.concept, MARGEN + COL_POS, y, { size: 8, bold: true, color: GRIS });
  texto(e, l.quantity, 0, y, {
    size: 8,
    bold: true,
    color: GRIS,
    alignRight: MARGEN + COL_POS + COL_CONCEPTO + COL_CANT,
  });
  texto(e, l.unitPrice, 0, y, {
    size: 8,
    bold: true,
    color: GRIS,
    alignRight: MARGEN + UTIL - COL_IMPORTE,
  });
  texto(e, l.amount, 0, y, { size: 8, bold: true, color: GRIS, alignRight: MARGEN + UTIL });
  e.page.drawLine({
    start: { x: MARGEN, y: y - 5 },
    end: { x: MARGEN + UTIL, y: y - 5 },
    color: LINEA,
  });
  e.y = y - 18;
}

/** Página nueva; las siguientes a la primera repiten el nombre del negocio, el folio y el encabezado de la tabla. */
function paginaNueva(e: Estado, conTabla: boolean): void {
  e.page = e.pdf.addPage([ANCHO, ALTO]);
  e.y = ALTO - MARGEN;
  texto(e, e.doc.business.name, MARGEN, e.y - 10, { size: 10, bold: true });
  texto(e, `${e.doc.labels.title} ${e.doc.folioLabel}`, 0, e.y - 10, {
    size: 10,
    alignRight: MARGEN + UTIL,
  });
  e.y -= 38;
  if (conTabla) {
    encabezadoDeTabla(e);
  }
}

function asegurarEspacio(e: Estado, alto: number, conTabla: boolean): void {
  if (e.y - alto < MARGEN + PIE) {
    paginaNueva(e, conTabla);
  }
}

async function encabezadoPrincipal(e: Estado): Promise<void> {
  const { doc } = e;
  const l = doc.labels;
  let xTexto = MARGEN;
  if (doc.business.logo !== undefined) {
    const imagen =
      doc.business.logo.format === 'png'
        ? await e.pdf.embedPng(doc.business.logo.bytes)
        : await e.pdf.embedJpg(doc.business.logo.bytes);
    const escala = Math.min(60 / imagen.width, 60 / imagen.height, 1);
    e.page.drawImage(imagen, {
      x: MARGEN,
      y: e.y - imagen.height * escala,
      width: imagen.width * escala,
      height: imagen.height * escala,
    });
    xTexto = MARGEN + imagen.width * escala + 12;
  }
  texto(e, doc.business.name, xTexto, e.y - 12, { size: 16, bold: true });
  let yNegocio = e.y - 28;
  for (const dato of [doc.business.address, doc.business.phone]) {
    if (dato !== null) {
      texto(e, dato, xTexto, yNegocio, { size: 9, color: GRIS });
      yNegocio -= 12;
    }
  }
  texto(e, l.title.toUpperCase(), 0, e.y - 12, { size: 14, bold: true, alignRight: MARGEN + UTIL });
  texto(e, doc.folioLabel, 0, e.y - 28, { size: 11, bold: true, alignRight: MARGEN + UTIL });
  if (doc.publicCode !== null) {
    texto(e, `${l.publicCode} ${doc.publicCode}`, 0, e.y - 41, {
      size: 9,
      color: GRIS,
      alignRight: MARGEN + UTIL,
    });
  }
  if (doc.isDraft) {
    texto(e, l.draft, 0, e.y - 54, {
      size: 11,
      bold: true,
      color: ROJO,
      alignRight: MARGEN + UTIL,
    });
  }
  e.y -= Math.max(70, e.y - yNegocio + 14);
  e.page.drawLine({
    start: { x: MARGEN, y: e.y },
    end: { x: MARGEN + UTIL, y: e.y },
    color: LINEA,
  });
  e.y -= 16;

  // Fechas y cliente.
  texto(e, `${l.date}: ${doc.issuedDate}`, MARGEN, e.y, { size: 10 });
  if (doc.validUntilDate !== '') {
    texto(e, `${l.validUntil}: ${doc.validUntilDate}`, 0, e.y, {
      size: 10,
      alignRight: MARGEN + UTIL,
    });
  }
  e.y -= 16;
  texto(e, `${l.customer}: ${doc.customer.name}`, MARGEN, e.y, { size: 10, bold: true });
  e.y -= 13;
  texto(
    e,
    `${l.phone}: ${doc.customer.phone.slice(0, 2)} ${doc.customer.phone.slice(2, 6)} ${doc.customer.phone.slice(6)}`,
    MARGEN,
    e.y,
    { size: 10 },
  );
  e.y -= 13;
  if (doc.siteAddress !== null) {
    for (const renglon of envolver(`${l.site}: ${doc.siteAddress}`, e.fuentes.normal, 10, UTIL)) {
      texto(e, renglon, MARGEN, e.y, { size: 10 });
      e.y -= 13;
    }
  }
  e.y -= 14;
}

function filas(e: Estado): void {
  const { fuentes } = e;
  for (const linea of e.doc.lines) {
    const nombre = envolver(linea.name, fuentes.negrita, 10, COL_CONCEPTO - 4);
    const detalle = envolver(linea.detail, fuentes.normal, 8, COL_CONCEPTO - 4);
    const alto = Math.max(1, nombre.length) * 12 + detalle.length * 10 + 8;
    asegurarEspacio(e, alto, true);
    let y = e.y;
    texto(e, String(linea.position), MARGEN, y, { size: 10 });
    for (const renglon of nombre) {
      texto(e, renglon, MARGEN + COL_POS, y, { size: 10, bold: true });
      y -= 12;
    }
    for (const renglon of detalle) {
      texto(e, renglon, MARGEN + COL_POS, y, { size: 8, color: GRIS });
      y -= 10;
    }
    texto(e, linea.quantity, 0, e.y, {
      size: 10,
      alignRight: MARGEN + COL_POS + COL_CONCEPTO + COL_CANT,
    });
    texto(e, linea.unitPrice, 0, e.y, { size: 10, alignRight: MARGEN + UTIL - COL_IMPORTE });
    texto(e, linea.amount, 0, e.y, { size: 10, bold: true, alignRight: MARGEN + UTIL });
    e.y -= alto;
    e.page.drawLine({
      start: { x: MARGEN, y: e.y + 4 },
      end: { x: MARGEN + UTIL, y: e.y + 4 },
      color: LINEA,
    });
  }
}

function totales(e: Estado): void {
  const { doc } = e;
  asegurarEspacio(e, 70, false);
  e.y -= 6;
  const etiquetaX = MARGEN + UTIL - COL_IMPORTE - COL_UNIT;
  for (const [etiqueta, valor, negrita] of [
    [doc.labels.subtotal, doc.subtotal, false],
    [doc.labels.tax, doc.tax, false],
    [doc.labels.total, doc.total, true],
  ] as const) {
    texto(e, etiqueta, 0, e.y, {
      size: negrita ? 12 : 10,
      bold: negrita,
      alignRight: etiquetaX + COL_UNIT,
    });
    texto(e, valor, 0, e.y, { size: negrita ? 12 : 10, bold: negrita, alignRight: MARGEN + UTIL });
    e.y -= negrita ? 18 : 14;
  }
  e.y -= 8;
}

function condicionesYFirma(e: Estado): void {
  const { doc, fuentes } = e;
  const renglones = doc.conditions.flatMap((c, i) =>
    envolver(`${String(i + 1)}. ${c}`, fuentes.normal, 9, UTIL),
  );
  asegurarEspacio(e, 24 + renglones.length * 11 + 70, false);
  texto(e, doc.labels.conditions, MARGEN, e.y, { size: 10, bold: true });
  e.y -= 14;
  for (const renglon of renglones) {
    texto(e, renglon, MARGEN, e.y, { size: 9 });
    e.y -= 11;
  }
  e.y -= 38;
  e.page.drawLine({ start: { x: MARGEN, y: e.y }, end: { x: MARGEN + 220, y: e.y }, color: NEGRO });
  texto(e, doc.labels.signature, MARGEN, e.y - 12, { size: 9, color: GRIS });
  e.y -= 30;
}

/** Pagos, anticipo exigido, pagado y saldo del comprobante de trabajo [RF-M3-06]. */
function pagosYSaldo(e: Estado): void {
  const r = e.doc.receipt;
  if (r === undefined) {
    return;
  }
  const renglonesDePago = r.paymentLines.flatMap((p) => envolver(p, e.fuentes.normal, 9, UTIL));
  asegurarEspacio(e, 30 + renglonesDePago.length * 11 + 56, false);
  texto(e, `${r.labels.payments} (${r.status})`, MARGEN, e.y, { size: 10, bold: true });
  e.y -= 14;
  for (const renglon of renglonesDePago) {
    texto(e, renglon, MARGEN, e.y, { size: 9 });
    e.y -= 11;
  }
  e.y -= 6;
  const etiquetaX = MARGEN + UTIL - COL_IMPORTE - COL_UNIT;
  for (const [etiqueta, valor, negrita] of [
    [r.labels.depositRequired, r.depositRequired, false],
    [r.labels.paid, r.paid, false],
    [r.labels.balance, r.balance, true],
  ] as const) {
    texto(e, etiqueta, 0, e.y, {
      size: negrita ? 12 : 10,
      bold: negrita,
      alignRight: etiquetaX + COL_UNIT,
    });
    texto(e, valor, 0, e.y, { size: negrita ? 12 : 10, bold: negrita, alignRight: MARGEN + UTIL });
    e.y -= negrita ? 18 : 14;
  }
  e.y -= 6;
}

/** Garantía escrita: solo los renglones que existen [RN-14]. */
function garantiaEscrita(e: Estado): void {
  const r = e.doc.receipt;
  if (r === undefined || r.warrantyLines.length === 0) {
    return;
  }
  const renglones = r.warrantyLines.flatMap((p) => envolver(p, e.fuentes.normal, 9, UTIL));
  asegurarEspacio(e, 20 + renglones.length * 11, false);
  texto(e, r.labels.warranty, MARGEN, e.y, { size: 10, bold: true });
  e.y -= 14;
  for (const renglon of renglones) {
    texto(e, renglon, MARGEN, e.y, { size: 9 });
    e.y -= 11;
  }
  e.y -= 8;
}

const MODULO = 3;
const SILENCIO = 4;

/** QR de autofacturación dibujado como cuadros vectoriales (nítido al imprimir o ampliar), con el
 *  código de verificación y la leyenda del plazo a un lado [RF-M3-06, RN-26]. */
function codigoQr(e: Estado): void {
  const r = e.doc.receipt;
  if (r === undefined) {
    return;
  }
  const n = r.qr.matrix.length;
  const lado = (n + 2 * SILENCIO) * MODULO;
  const leyenda = r.qr.legend.flatMap((l) => envolver(l, e.fuentes.normal, 9, UTIL - lado - 16));
  asegurarEspacio(e, Math.max(lado, 24 + leyenda.length * 11) + 12, false);
  const arriba = e.y;
  const x0 = MARGEN + SILENCIO * MODULO;
  const y0 = arriba - SILENCIO * MODULO;
  r.qr.matrix.forEach((fila, i) => {
    fila.forEach((oscuro, j) => {
      if (oscuro) {
        e.page.drawRectangle({
          x: x0 + j * MODULO,
          y: y0 - (i + 1) * MODULO,
          width: MODULO,
          height: MODULO,
          color: NEGRO,
        });
      }
    });
  });
  const xTexto = MARGEN + lado + 16;
  let y = arriba - 10;
  texto(e, r.labels.selfInvoicing, xTexto, y, { size: 10, bold: true });
  y -= 14;
  texto(e, `${r.labels.verificationCode}: ${r.qr.code}`, xTexto, y, { size: 10 });
  y -= 14;
  for (const renglon of leyenda) {
    texto(e, renglon, xTexto, y, { size: 9, color: GRIS });
    y -= 11;
  }
  e.y = arriba - Math.max(lado, arriba - y) - 12;
}

function aviso(e: Estado): void {
  const renglones = envolver(e.doc.privacyNotice, e.fuentes.normal, 7, UTIL);
  asegurarEspacio(e, renglones.length * 9 + 4, false);
  for (const renglon of renglones) {
    texto(e, renglon, MARGEN, e.y, { size: 7, color: GRIS });
    e.y -= 9;
  }
}

function pies(e: Estado): void {
  const paginas = e.pdf.getPages();
  paginas.forEach((pagina, i) => {
    const t = e.doc.labels.page
      .replace('{n}', String(i + 1))
      .replace('{total}', String(paginas.length));
    const fuente = e.fuentes.normal;
    const limpio = seguro(t, fuente);
    pagina.drawText(limpio, {
      x: MARGEN + UTIL - fuente.widthOfTextAtSize(limpio, 8),
      y: MARGEN - 10,
      size: 8,
      font: fuente,
      color: GRIS,
    });
  });
}

/** Generador de PDF carta con `pdf-lib`: corre en la tablet, sin internet y sin servidor [RF-M2-05,
 *  RNF-25]. Usa las fuentes estándar del PDF (sin incrustar), que dibujan acentos y ñ. */
export function pdfLibRenderer(): DocumentRenderer {
  return {
    async render(documento) {
      try {
        const pdf = await PDFDocument.create();
        const fuentes: Fuentes = {
          normal: await pdf.embedFont(StandardFonts.Helvetica),
          negrita: await pdf.embedFont(StandardFonts.HelveticaBold),
        };
        const e: Estado = {
          pdf,
          fuentes,
          doc: documento,
          page: pdf.addPage([ANCHO, ALTO]),
          y: ALTO - MARGEN,
        };
        await encabezadoPrincipal(e);
        encabezadoDeTabla(e);
        filas(e);
        totales(e);
        pagosYSaldo(e);
        garantiaEscrita(e);
        condicionesYFirma(e);
        codigoQr(e);
        aviso(e);
        pies(e);
        return ok(await pdf.save());
      } catch {
        return err({ code: 'RENDER_FAILED' });
      }
    },
  };
}
