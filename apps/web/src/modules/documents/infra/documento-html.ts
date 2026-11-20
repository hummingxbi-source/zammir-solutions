import type { QuoteDocument } from '@zammir/core';

export interface OpcionesDeHtml {
  /** Reimpresión: la hoja sale marcada. */
  readonly copia: boolean;
  /** El rótulo de la marca, por ejemplo `COPIA`. */
  readonly rotuloDeCopia: string;
}

export function esc(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function aBase64(bytes: Uint8Array): string {
  let texto = '';
  const trozo = 0x8000;
  for (let i = 0; i < bytes.length; i += trozo) {
    texto += String.fromCharCode(...bytes.subarray(i, i + trozo));
  }
  return btoa(texto);
}

function telefono(diez: string): string {
  return `${diez.slice(0, 2)} ${diez.slice(2, 6)} ${diez.slice(6)}`;
}

/** El QR como dibujo vectorial: un cuadro por módulo oscuro, con el margen blanco que pide el lector. */
function qrSvg(matriz: readonly (readonly boolean[])[]): string {
  const margen = 4;
  const lado = matriz.length + 2 * margen;
  const cuadros = matriz
    .flatMap((fila, i) =>
      fila.map((oscuro, j) =>
        oscuro ? `M${String(j + margen)} ${String(i + margen)}h1v1h-1z` : '',
      ),
    )
    .join('');
  return `<svg class="qr" viewBox="0 0 ${String(lado)} ${String(lado)}" shape-rendering="crispEdges" aria-hidden="true"><rect width="${String(lado)}" height="${String(lado)}" fill="#fff"/><path d="${cuadros}" fill="#000"/></svg>`;
}

export const ESTILOS = `
@page { size: letter; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #000; font: 10pt/1.35 Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1, h2, h3, p { margin: 0; }
.encabezado { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 10px; border-bottom: 1.5pt solid #0f5c57; }
.negocio { display: flex; gap: 12px; align-items: flex-start; }
.logo { width: 64px; height: auto; }
.negocio h1 { font-size: 16pt; }
.gris { color: #595959; font-size: 9pt; }
.titulo { text-align: right; }
.titulo h2 { color: #0f5c57; font-size: 14pt; text-transform: uppercase; }
.titulo strong { font-size: 11pt; }
.marca { display: inline-block; margin-top: 4px; padding: 1px 8px; border: 1.5pt solid #bf1a1a; color: #bf1a1a; font-weight: 700; letter-spacing: 1px; }
.datos { margin: 12px 0; display: grid; gap: 3px; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
th { background: #ebf2f0; border-top: 1pt solid #0f5c57; color: #595959; font-size: 8pt; text-align: left; padding: 5px 4px; }
td { padding: 6px 4px; border-bottom: 0.5pt solid #bfbfbf; vertical-align: top; }
tr { break-inside: avoid; }
.num { text-align: right; white-space: nowrap; }
td small { display: block; color: #595959; font-size: 8pt; }
.totales { margin: 8px 0 12px auto; width: 55%; }
.totales div { display: flex; justify-content: space-between; padding: 2px 0; }
.totales .fuerte { font-size: 12pt; font-weight: 700; }
.bloque { margin-top: 12px; break-inside: avoid; }
.bloque h3 { font-size: 10pt; margin-bottom: 4px; }
.bloque p { font-size: 9pt; }
.firma { margin-top: 36px; width: 220px; border-top: 1pt solid #000; padding-top: 3px; color: #595959; font-size: 9pt; }
.codigo-qr { display: flex; gap: 12px; align-items: center; margin-top: 14px; break-inside: avoid; }
.qr { width: 100px; height: 100px; }
.aviso { margin-top: 14px; color: #595959; font-size: 7.5pt; }
`;

/** El documento como página lista para imprimir en hoja carta [ADR-0040]. Dice lo mismo que el PDF, porque
 *  sale del mismo modelo ya calculado: nada se recalcula aquí. El texto se escapa siempre. */
export function documentoAHtml(doc: QuoteDocument, opciones: OpcionesDeHtml): string {
  const l = doc.labels;
  const r = doc.receipt;
  const logo =
    doc.business.logo === undefined
      ? ''
      : `<img class="logo" alt="" src="data:image/${doc.business.logo.format === 'png' ? 'png' : 'jpeg'};base64,${aBase64(doc.business.logo.bytes)}">`;

  const filas = doc.lines
    .map(
      (linea) =>
        `<tr><td>${String(linea.position)}</td><td><strong>${esc(linea.name)}</strong><small>${esc(linea.detail)}</small></td><td class="num">${esc(linea.quantity)}</td><td class="num">${esc(linea.unitPrice)}</td><td class="num"><strong>${esc(linea.amount)}</strong></td></tr>`,
    )
    .join('');

  const saldo =
    r === undefined
      ? ''
      : `<div class="bloque"><h3>${esc(r.labels.payments)} (${esc(r.status)})</h3>${r.paymentLines.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
<div class="totales">${r.depositRequired === null ? '' : `<div><span>${esc(r.labels.depositRequired)}</span><span>${esc(r.depositRequired)}</span></div>`}<div><span>${esc(r.labels.paid)}</span><span>${esc(r.paid)}</span></div><div class="fuerte"><span>${esc(r.labels.balance)}</span><span>${esc(r.balance)}</span></div></div>`;

  const garantia =
    r === undefined || r.warrantyLines.length === 0
      ? ''
      : `<div class="bloque"><h3>${esc(r.labels.warranty)}</h3>${r.warrantyLines.map((g) => `<p>${esc(g)}</p>`).join('')}</div>`;

  const condiciones =
    doc.conditions.length === 0
      ? ''
      : `<div class="bloque"><h3>${esc(l.conditions)}</h3>${doc.conditions.map((c, i) => `<p>${String(i + 1)}. ${esc(c)}</p>`).join('')}</div>`;

  const terminos =
    doc.terms === null || doc.terms === undefined
      ? ''
      : `<div class="bloque"><h3>${esc(doc.terms.title)}</h3>${doc.terms.lines.map((t) => `<p>${esc(t)}</p>`).join('')}</div>`;

  const qr =
    r?.qr === null || r?.qr === undefined
      ? ''
      : `<div class="codigo-qr">${qrSvg(r.qr.matrix)}<div><strong>${esc(r.labels.selfInvoicing)}</strong><p>${esc(r.labels.verificationCode)}: ${esc(r.qr.code)}</p>${r.qr.legend.map((t) => `<p class="gris">${esc(t)}</p>`).join('')}</div></div>`;

  const cuerpo = `
<header class="encabezado">
  <div class="negocio">${logo}<div><h1>${esc(doc.business.name)}</h1>${doc.business.address === null ? '' : `<p class="gris">${esc(doc.business.address)}</p>`}${doc.business.phone === null ? '' : `<p class="gris">${esc(doc.business.phone)}</p>`}</div></div>
  <div class="titulo"><h2>${esc(l.title)}</h2><strong>${esc(doc.folioLabel)}</strong>${doc.publicCode === null ? '' : `<p class="gris">${esc(l.publicCode)} ${esc(doc.publicCode)}</p>`}${doc.isDraft ? `<p><strong>${esc(l.draft)}</strong></p>` : ''}${opciones.copia ? `<span class="marca">${esc(opciones.rotuloDeCopia)}</span>` : ''}</div>
</header>
<section class="datos">
  <p>${esc(l.date)}: ${esc(doc.issuedDate)}${doc.validUntilDate === '' ? '' : ` · ${esc(l.validUntil)}: ${esc(doc.validUntilDate)}`}</p>
  <p><strong>${esc(l.customer)}: ${esc(doc.customer.name)}</strong></p>
  ${doc.customer.phone === '' ? '' : `<p>${esc(l.phone)}: ${esc(telefono(doc.customer.phone))}</p>`}
  ${r?.attendedBy === null || r?.attendedBy === undefined ? '' : `<p>${esc(r.attendedBy)}</p>`}
  ${doc.siteAddress === null ? '' : `<p>${esc(l.site)}: ${esc(doc.siteAddress)}</p>`}
</section>
<table>
  <thead><tr><th>#</th><th>${esc(l.concept)}</th><th class="num">${esc(l.quantity)}</th><th class="num">${esc(l.unitPrice)}</th><th class="num">${esc(l.amount)}</th></tr></thead>
  <tbody>${filas}</tbody>
</table>
<div class="totales"><div><span>${esc(l.subtotal)}</span><span>${esc(doc.subtotal)}</span></div><div><span>${esc(l.tax)}</span><span>${esc(doc.tax)}</span></div><div class="fuerte"><span>${esc(l.total)}</span><span>${esc(doc.total)}</span></div></div>
${saldo}${garantia}${condiciones}${terminos}
<div class="firma">${esc(l.signature)}</div>
${qr}
<p class="aviso">${esc(doc.privacyNotice)}</p>`;

  return `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>${esc(`${l.title} ${doc.folioLabel}`)}</title><style>${ESTILOS}</style></head><body>${cuerpo}</body></html>`;
}
