import { err, ok, type DocumentPrinter, type SheetPrinter } from '@zammir/core';

import { documentoAHtml } from './documento-html';
import { hojaAHtml } from './hoja-html';

/** Lo que necesita del navegador: mostrar una página en un marco oculto y mandarla a imprimir. */
export interface EntornoDeImpresionDeDocumentos {
  imprimirHtml(html: string): Promise<void>;
}

/** Imprime el documento con la impresión del sistema (en Android, su servicio de impresión, que sirve con
 *  cualquier impresora que el sistema ya conozca, incluida una Wi-Fi) [ADR-0040]. Se imprime una página
 *  HTML y no el PDF: Android no imprime de forma confiable un PDF dentro de un marco. */
export function htmlDocumentPrinter(
  entorno: EntornoDeImpresionDeDocumentos | undefined,
  rotuloDeCopia: string,
): DocumentPrinter {
  return {
    async print(documento, opciones) {
      if (entorno === undefined) {
        return err({ code: 'PRINT_UNAVAILABLE' as const });
      }
      try {
        await entorno.imprimirHtml(
          documentoAHtml(documento, { copia: opciones?.copia === true, rotuloDeCopia }),
        );
        return ok(undefined);
      } catch {
        return err({ code: 'PRINT_FAILED' as const });
      }
    },
  };
}

/** Imprime la hoja de resumen (el corte de caja) con la impresión del sistema [ADR-0040]. */
export function htmlSheetPrinter(
  entorno: EntornoDeImpresionDeDocumentos | undefined,
): SheetPrinter {
  return {
    async print(hoja) {
      if (entorno === undefined) {
        return err({ code: 'PRINT_UNAVAILABLE' as const });
      }
      try {
        await entorno.imprimirHtml(hojaAHtml(hoja));
        return ok(undefined);
      } catch {
        return err({ code: 'PRINT_FAILED' as const });
      }
    },
  };
}

/** Cuánto vive el marco oculto si el navegador nunca avisa que terminó de imprimir. */
const VIDA_DEL_MARCO_MS = 300_000;

/** El entorno real: un marco oculto con la página y `print()` sobre él. Éxito es que se abrió la impresión;
 *  lo que la persona haga en ese diálogo ya no lo sabe el sistema. */
export function imprimirHtmlDesdeElNavegador(ventana: Window): EntornoDeImpresionDeDocumentos {
  return {
    imprimirHtml: (html) =>
      new Promise<void>((resolver, rechazar) => {
        const marco = ventana.document.createElement('iframe');
        marco.setAttribute('aria-hidden', 'true');
        marco.setAttribute('tabindex', '-1');
        marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
        const quitar = (): void => {
          marco.remove();
        };
        marco.addEventListener(
          'load',
          () => {
            const contenido = marco.contentWindow;
            if (contenido === null) {
              quitar();
              rechazar(new Error('NO_FRAME'));
              return;
            }
            contenido.addEventListener('afterprint', quitar);
            ventana.setTimeout(quitar, VIDA_DEL_MARCO_MS);
            try {
              contenido.focus();
              contenido.print();
              resolver();
            } catch (error) {
              quitar();
              rechazar(error instanceof Error ? error : new Error('PRINT_FAILED'));
            }
          },
          { once: true },
        );
        marco.srcdoc = html;
        ventana.document.body.appendChild(marco);
      }),
  };
}
