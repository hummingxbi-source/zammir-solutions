import {
  err,
  ok,
  toPlainText,
  type PrinterStatus,
  type PrintDocument,
  type TicketPrinter,
} from '@zammir/core';

/** Lo que necesita del navegador: mostrar el texto en una página de impresión y mandarla a imprimir. */
export interface EntornoDeImpresion {
  imprimirTexto(texto: string): Promise<void>;
}

/** Impresión con el diálogo del sistema (la del servicio de impresión de Android) como segunda opción
 *  [S3-22]. Sirve con cualquier impresora que Android ya conozca, incluida una de red o USB. */
export function androidPrintPrinter(entorno: EntornoDeImpresion | undefined): TicketPrinter {
  const estado = (): PrinterStatus =>
    entorno === undefined
      ? { state: 'NOT_CONFIGURED', name: null }
      : { state: 'READY', name: 'Impresión de Android' };
  return {
    label: 'Impresión de Android',
    status: () => Promise.resolve(estado()),
    connect: () =>
      Promise.resolve(
        entorno === undefined ? err({ code: 'PRINTER_NOT_CONFIGURED' as const }) : ok(estado()),
      ),
    async print(documento: PrintDocument) {
      if (entorno === undefined) {
        return err({ code: 'PRINTER_NOT_CONFIGURED' as const });
      }
      try {
        await entorno.imprimirTexto(toPlainText(documento));
        return ok(undefined);
      } catch {
        return err({ code: 'PRINT_FAILED' as const });
      }
    },
  };
}

/** El entorno real: un marco oculto con el ticket en letra de ancho fijo, y `print()` sobre él. */
export function imprimirDesdeElNavegador(ventana: Window): EntornoDeImpresion {
  return {
    imprimirTexto: (texto) =>
      new Promise<void>((resolver, rechazar) => {
        const marco = ventana.document.createElement('iframe');
        marco.setAttribute('aria-hidden', 'true');
        marco.style.cssText = 'position:fixed;width:0;height:0;border:0;';
        ventana.document.body.appendChild(marco);
        const doc = marco.contentDocument;
        const contenido = marco.contentWindow;
        if (doc === null || contenido === null) {
          marco.remove();
          rechazar(new Error('NO_FRAME'));
          return;
        }
        const pre = doc.createElement('pre');
        pre.textContent = texto;
        pre.style.cssText = 'font-family:monospace;font-size:12px;margin:0;white-space:pre-wrap;';
        doc.body.appendChild(pre);
        contenido.addEventListener('afterprint', () => {
          marco.remove();
          resolver();
        });
        contenido.focus();
        contenido.print();
      }),
  };
}
