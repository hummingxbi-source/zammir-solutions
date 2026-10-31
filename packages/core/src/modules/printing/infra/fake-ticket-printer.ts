import { err, ok, type Result } from '../../../shared-kernel/result';
import type { PrinterError, PrinterStatus, TicketPrinter } from '../application/ports';
import type { PrintDocument } from '../domain/print-document';

export interface FakeTicketPrinter extends TicketPrinter {
  readonly printed: PrintDocument[];
  /** Hace que la siguiente impresión falle con este código (o `null` para que vuelva a funcionar). */
  failWith(code: PrinterError['code'] | null): void;
  setConnected(valor: boolean): void;
}

export function fakeTicketPrinter(label = 'Impresora de prueba'): FakeTicketPrinter {
  const impresos: PrintDocument[] = [];
  let falla: PrinterError['code'] | null = null;
  let conectada = true;
  const estado = (): PrinterStatus => ({
    state: conectada ? 'READY' : 'DISCONNECTED',
    name: label,
  });
  return {
    label,
    printed: impresos,
    failWith: (codigo) => {
      falla = codigo;
    },
    setConnected: (valor) => {
      conectada = valor;
    },
    status: () => Promise.resolve(estado()),
    connect: () => {
      conectada = true;
      return Promise.resolve(ok(estado()));
    },
    print: (documento): Promise<Result<void, PrinterError>> => {
      if (falla !== null) {
        return Promise.resolve(err({ code: falla }));
      }
      if (!conectada) {
        return Promise.resolve(err({ code: 'PRINTER_UNAVAILABLE' as const }));
      }
      impresos.push(documento);
      return Promise.resolve(ok(undefined));
    },
  };
}
