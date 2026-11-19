import type { SummarySheet } from '@zammir/core';

import { aBase64, ESTILOS, esc } from './documento-html';

const ESTILOS_DE_HOJA = `
.renglones { margin-bottom: 12px; }
.seccion { margin: 14px 0 4px; padding: 5px 6px; background: #ebf2f0; color: #0f5c57; font-weight: 700; font-size: 10pt; break-after: avoid; }
.renglon { display: flex; justify-content: space-between; gap: 16px; padding: 5px 6px; border-bottom: 0.5pt solid #bfbfbf; break-inside: avoid; }
.renglon.fuerte { font-size: 12pt; font-weight: 700; }
.contexto p { margin: 2px 0; }
`;

/** La hoja de resumen como página lista para imprimir en hoja carta [ADR-0040]. Sale de la misma hoja ya
 *  calculada que el PDF: nada se recalcula aquí. El texto se escapa siempre. */
export function hojaAHtml(hoja: SummarySheet): string {
  const logo =
    hoja.business.logo === undefined
      ? ''
      : `<img class="logo" alt="" src="data:image/${hoja.business.logo.format === 'png' ? 'png' : 'jpeg'};base64,${aBase64(hoja.business.logo.bytes)}">`;

  const secciones = hoja.sections
    .map(
      (s) =>
        `${s.title === null ? '' : `<div class="seccion">${esc(s.title)}</div>`}<div class="renglones">${s.rows
          .map(
            (r) =>
              `<div class="renglon${r.strong === true ? ' fuerte' : ''}"><span>${esc(r.label)}</span><span>${esc(r.value)}</span></div>`,
          )
          .join('')}</div>`,
    )
    .join('');

  const cuerpo = `
<header class="encabezado">
  <div class="negocio">${logo}<div><h1>${esc(hoja.business.name)}</h1>${hoja.business.address === null ? '' : `<p class="gris">${esc(hoja.business.address)}</p>`}${hoja.business.phone === null ? '' : `<p class="gris">${esc(hoja.business.phone)}</p>`}</div></div>
  <div class="titulo"><h2>${esc(hoja.title)}</h2>${hoja.subtitle === null ? '' : `<strong>${esc(hoja.subtitle)}</strong>`}</div>
</header>
<section class="datos contexto">${hoja.meta.map((m) => `<p>${esc(m)}</p>`).join('')}</section>
${secciones}
${hoja.note === null ? '' : `<p class="aviso" style="font-size:9pt">${esc(hoja.note)}</p>`}`;

  return `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>${esc(hoja.title)}</title><style>${ESTILOS}${ESTILOS_DE_HOJA}</style></head><body>${cuerpo}</body></html>`;
}
