import { describe, expect, it } from 'vitest';

import type { TicketPrinter } from '../application/ports';
import type { PrintDocument } from '../domain/print-document';

export const documentoDeContrato: PrintDocument = {
  title: 'Contrato',
  width: 32,
  blocks: [
    { kind: 'text', text: 'ZAMMIR', align: 'center', bold: true, large: true },
    { kind: 'rule' },
    { kind: 'pair', left: 'Total', right: '$116.00' },
    { kind: 'qr', text: 'https://pruebas.zammir.invalid/f/V-1/ABC' },
  ],
};

/** Lo que cualquier medio de impresión debe cumplir, sea Bluetooth, Android o compartir. `preparar` deja el
 *  medio listo para imprimir (conectado) y `romper` lo deja sin poder imprimir. */
export function ticketPrinterContract(
  nombre: string,
  preparar: () => Promise<TicketPrinter> | TicketPrinter,
  romper: (medio: TicketPrinter) => Promise<void> | void,
): void {
  describe(`contrato de impresora: ${nombre}`, () => {
    it('tiene nombre para mostrarlo en pantalla', async () => {
      expect((await preparar()).label.length).toBeGreaterThan(0);
    });

    it('imprime un documento sin error cuando está lista', async () => {
      const medio = await preparar();
      const r = await medio.print(documentoDeContrato);
      expect(r.ok).toBe(true);
    });

    it('dice su estado y, ya conectada, está lista', async () => {
      const medio = await preparar();
      const c = await medio.connect();
      expect(c.ok).toBe(true);
      expect((await medio.status()).state).toBe('READY');
    });

    it('si no puede imprimir responde un error con código, sin lanzar excepción', async () => {
      const medio = await preparar();
      await romper(medio);
      const r = await medio.print(documentoDeContrato);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect([
          'PRINTER_NOT_CONFIGURED',
          'PRINTER_UNAVAILABLE',
          'PRINT_CANCELLED',
          'PRINT_FAILED',
        ]).toContain(r.error.code);
      }
    });
  });
}
