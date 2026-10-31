import { ok, type DocumentRenderer, type QuoteDocument } from '@zammir/core';

const LINEAS_POR_PAGINA = 20;

/** Texto plano que representa al documento; lo usan el renderizador falso y las pruebas. */
export function documentToLines(d: QuoteDocument): string[] {
  const nl = d.labels;
  return [
    ...(d.isDraft ? [nl.draft] : []),
    d.business.name,
    d.business.address ?? '',
    d.business.phone ?? '',
    `${nl.title} ${d.folioLabel}`,
    d.publicCode === null ? '' : `${nl.publicCode} ${d.publicCode}`,
    `${nl.date} ${d.issuedDate} ${nl.validUntil} ${d.validUntilDate}`,
    `${nl.customer} ${d.customer.name} ${nl.phone} ${d.customer.phone}`,
    d.siteAddress === null ? '' : `${nl.site} ${d.siteAddress}`,
    ...d.lines.map(
      (l) => `${String(l.position)} ${l.name} ${l.detail} ${l.quantity} ${l.unitPrice} ${l.amount}`,
    ),
    `${nl.subtotal} ${d.subtotal}`,
    `${nl.tax} ${d.tax}`,
    `${nl.total} ${d.total}`,
    nl.conditions,
    ...d.conditions,
    nl.signature,
    d.privacyNotice,
  ].filter((l) => l !== '');
}

/** Renderizador falso: no hace un PDF de verdad, deja el texto del documento con un encabezado `%PDF`. */
export function fakeDocumentRenderer(): DocumentRenderer {
  return {
    render(documento) {
      const lineas = documentToLines(documento);
      const paginas: string[][] = [];
      for (let i = 0; i < lineas.length; i += LINEAS_POR_PAGINA) {
        paginas.push(lineas.slice(i, i + LINEAS_POR_PAGINA));
      }
      const texto = `%PDF-FAKE\n${paginas.map((p) => p.join('\n')).join('\n\f\n')}`;
      return Promise.resolve(ok(new TextEncoder().encode(texto)));
    },
  };
}
