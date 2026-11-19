import type { DocumentPrinter, QuoteDocument } from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';

/** Abre la impresión de un documento. Devuelve `null` si se abrió, o el mensaje y qué hacer si no se pudo.
 *  Sin impresora configurada también es un mensaje claro, nunca un error mudo [ADR-0040]. */
export async function imprimirDocumento(
  impresora: DocumentPrinter | undefined,
  documento: QuoteDocument,
  opciones: { readonly copia: boolean } = { copia: false },
): Promise<{ readonly mensaje: string; readonly queHacer: string } | null> {
  if (impresora === undefined) {
    return textos.documento.acciones.errorDeImpresion;
  }
  const r = await impresora.print(documento, opciones);
  return r.ok ? null : textos.documento.acciones.errorDeImpresion;
}
