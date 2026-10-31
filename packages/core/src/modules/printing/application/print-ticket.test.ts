import { describe, expect, it } from 'vitest';

import { ticketPrinterContract, documentoDeContrato } from '../contracts/ticket-printer.contract';
import { fakeTicketPrinter } from '../infra/fake-ticket-printer';
import { printWithFallback } from './print-ticket';

ticketPrinterContract(
  'adaptador falso',
  () => fakeTicketPrinter(),
  (medio) => {
    (medio as ReturnType<typeof fakeTicketPrinter>).failWith('PRINT_FAILED');
  },
);

describe('imprimir con respaldo', () => {
  it('imprime por el primer medio que responde', async () => {
    const a = fakeTicketPrinter('Bluetooth');
    const b = fakeTicketPrinter('Android');
    const r = await printWithFallback([a, b], documentoDeContrato);
    expect(r).toEqual({ ok: true, value: { via: 'Bluetooth', failed: [] } });
    expect(a.printed).toHaveLength(1);
    expect(b.printed).toHaveLength(0);
  });

  it('si el primero falla, pasa al siguiente y dice cuál falló', async () => {
    const a = fakeTicketPrinter('Bluetooth');
    const b = fakeTicketPrinter('Android');
    a.failWith('PRINTER_UNAVAILABLE');
    const r = await printWithFallback([a, b], documentoDeContrato);
    expect(r).toEqual({ ok: true, value: { via: 'Android', failed: ['Bluetooth'] } });
    expect(b.printed).toHaveLength(1);
  });

  it('si el usuario cancela, no insiste con otro medio', async () => {
    const a = fakeTicketPrinter('Bluetooth');
    const b = fakeTicketPrinter('Android');
    a.failWith('PRINT_CANCELLED');
    const r = await printWithFallback([a, b], documentoDeContrato);
    expect(r).toEqual({ ok: false, error: { code: 'PRINT_CANCELLED' } });
    expect(b.printed).toHaveLength(0);
  });

  it('si todos fallan devuelve el último error; sin medios, que no hay impresora configurada', async () => {
    const a = fakeTicketPrinter('Bluetooth');
    const b = fakeTicketPrinter('Compartir');
    a.failWith('PRINTER_UNAVAILABLE');
    b.failWith('PRINT_FAILED');
    expect(await printWithFallback([a, b], documentoDeContrato)).toEqual({
      ok: false,
      error: { code: 'PRINT_FAILED' },
    });
    expect(await printWithFallback([], documentoDeContrato)).toEqual({
      ok: false,
      error: { code: 'PRINTER_NOT_CONFIGURED' },
    });
  });

  it('el falso desconectado no imprime y al conectarse vuelve a imprimir', async () => {
    const a = fakeTicketPrinter();
    a.setConnected(false);
    expect((await a.print(documentoDeContrato)).ok).toBe(false);
    expect((await a.status()).state).toBe('DISCONNECTED');
    await a.connect();
    expect((await a.print(documentoDeContrato)).ok).toBe(true);
  });
});
