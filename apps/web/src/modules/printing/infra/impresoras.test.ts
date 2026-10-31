import { documentoDeContrato, ticketPrinterContract } from '@zammir/core/testing';
import { encodeEscPos, err, ok, type ShareableFile, type ShareService } from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { androidPrintPrinter } from './android-print-printer';
import { shareTicketPrinter } from './share-ticket-printer';
import {
  webBluetoothPrinter,
  type CaracteristicaBluetooth,
  type DispositivoBluetooth,
  type EntornoBluetooth,
} from './web-bluetooth-printer';

function bluetoothFalso(
  opciones: { falla?: boolean; sinEscrituraRapida?: boolean; cancela?: boolean } = {},
) {
  const escrituras: Uint8Array[] = [];
  const escribir = (v: BufferSource): Promise<void> => {
    if (opciones.falla === true) {
      return Promise.reject(new Error('GATT'));
    }
    escrituras.push(new Uint8Array(v as ArrayBuffer));
    return Promise.resolve();
  };
  const caracteristica: CaracteristicaBluetooth = { writeValue: escribir };
  if (opciones.sinEscrituraRapida !== true) {
    caracteristica.writeValueWithoutResponse = escribir;
  }
  const gatt = {
    connected: false,
    connect: () => {
      gatt.connected = true;
      return Promise.resolve({
        getPrimaryService: () =>
          Promise.resolve({ getCharacteristic: () => Promise.resolve(caracteristica) }),
      });
    },
  };
  const dispositivo: DispositivoBluetooth = { name: 'PT-210', gatt };
  const entorno: EntornoBluetooth = {
    requestDevice: () =>
      opciones.cancela === true
        ? Promise.reject(new DOMException('cerrado', 'NotFoundError'))
        : Promise.resolve(dispositivo),
  };
  return { entorno, escrituras, gatt };
}

{
  const o = { falla: false };
  ticketPrinterContract(
    'Bluetooth (Web Bluetooth falso)',
    async () => {
      o.falla = false;
      const impresora = webBluetoothPrinter(bluetoothFalso(o).entorno);
      await impresora.connect();
      return impresora;
    },
    () => {
      o.falla = true;
    },
  );
}

describe('impresora Bluetooth', () => {
  it('sin Web Bluetooth dice que no está configurada', async () => {
    const i = webBluetoothPrinter(undefined);
    expect((await i.status()).state).toBe('NOT_CONFIGURED');
    expect(await i.connect()).toEqual({ ok: false, error: { code: 'PRINTER_NOT_CONFIGURED' } });
    expect(await i.print(documentoDeContrato)).toEqual({
      ok: false,
      error: { code: 'PRINTER_NOT_CONFIGURED' },
    });
  });

  it('antes de emparejar no está configurada y no imprime', async () => {
    const i = webBluetoothPrinter(bluetoothFalso().entorno);
    expect((await i.status()).state).toBe('NOT_CONFIGURED');
    expect((await i.print(documentoDeContrato)).ok).toBe(false);
  });

  it('manda los bytes ESC/POS en paquetes del tamaño configurado, en orden', async () => {
    const { entorno, escrituras } = bluetoothFalso();
    const i = webBluetoothPrinter(entorno, {
      serviceUuid: 's',
      characteristicUuid: 'c',
      chunkSize: 16,
    });
    await i.connect();
    expect(await i.print(documentoDeContrato)).toEqual({ ok: true, value: undefined });
    const esperado = encodeEscPos(documentoDeContrato);
    expect(escrituras.every((p) => p.length <= 16)).toBe(true);
    expect(escrituras.length).toBe(Math.ceil(esperado.length / 16));
    expect(escrituras.flatMap((p) => Array.from(p))).toEqual(Array.from(esperado));
    expect(await i.status()).toEqual({ state: 'READY', name: 'PT-210' });
  });

  it('si la característica no tiene escritura sin respuesta usa la normal', async () => {
    const { entorno, escrituras } = bluetoothFalso({ sinEscrituraRapida: true });
    const i = webBluetoothPrinter(entorno);
    await i.connect();
    expect((await i.print(documentoDeContrato)).ok).toBe(true);
    expect(escrituras.length).toBeGreaterThan(0);
  });

  it('cerrar la lista de dispositivos es cancelar, no un fallo', async () => {
    const i = webBluetoothPrinter(bluetoothFalso({ cancela: true }).entorno);
    expect(await i.connect()).toEqual({ ok: false, error: { code: 'PRINT_CANCELLED' } });
  });

  it('si la escritura falla responde PRINT_FAILED y el estado queda desconectado', async () => {
    const { entorno, gatt } = bluetoothFalso({ falla: true });
    const i = webBluetoothPrinter(entorno);
    await i.connect();
    expect(await i.print(documentoDeContrato)).toEqual({
      ok: false,
      error: { code: 'PRINT_FAILED' },
    });
    gatt.connected = false;
    expect((await i.status()).state).toBe('DISCONNECTED');
  });

  it('si la impresora no se deja enlazar responde PRINTER_UNAVAILABLE', async () => {
    const { entorno, gatt } = bluetoothFalso();
    const i = webBluetoothPrinter(entorno);
    await i.connect();
    gatt.connected = false;
    gatt.connect = () => Promise.reject(new Error('x'));
    expect(await i.print(documentoDeContrato)).toEqual({
      ok: false,
      error: { code: 'PRINTER_UNAVAILABLE' },
    });
  });
});

describe('impresión de Android', () => {
  {
    const o = { falla: false };
    ticketPrinterContract(
      'Android (diálogo del sistema falso)',
      () => {
        o.falla = false;
        return androidPrintPrinter({
          imprimirTexto: () => (o.falla ? Promise.reject(new Error('x')) : Promise.resolve()),
        });
      },
      () => {
        o.falla = true;
      },
    );
  }

  it('manda el ticket como texto plano y avisa si no pudo', async () => {
    let recibido = '';
    const bien = androidPrintPrinter({
      imprimirTexto: (t) => {
        recibido = t;
        return Promise.resolve();
      },
    });
    await bien.print(documentoDeContrato);
    expect(recibido).toContain('$116.00');
    const mal = androidPrintPrinter({ imprimirTexto: () => Promise.reject(new Error('x')) });
    expect(await mal.print(documentoDeContrato)).toEqual({
      ok: false,
      error: { code: 'PRINT_FAILED' },
    });
    const sin = androidPrintPrinter(undefined);
    expect((await sin.status()).state).toBe('NOT_CONFIGURED');
    expect((await sin.connect()).ok).toBe(false);
    expect((await sin.print(documentoDeContrato)).ok).toBe(false);
  });
});

function compartirFalso(puede: boolean, resultado: 'ok' | 'cancelado' | 'falla') {
  const descargas: ShareableFile[] = [];
  const compartidos: ShareableFile[] = [];
  const share: ShareService = {
    canShareFile: () => puede,
    shareFile: (a) => {
      compartidos.push(a);
      return Promise.resolve(
        resultado === 'ok'
          ? ok(undefined)
          : err({
              code:
                resultado === 'cancelado'
                  ? ('SHARE_CANCELLED' as const)
                  : ('SHARE_UNAVAILABLE' as const),
            }),
      );
    },
    openLink: () => undefined,
    download: (a) => {
      descargas.push(a);
    },
  };
  return { share, descargas, compartidos };
}

describe('compartir el ticket', () => {
  {
    const o = { resultado: 'ok' as 'ok' | 'falla' };
    ticketPrinterContract(
      'compartir (menú del sistema falso)',
      () => {
        o.resultado = 'ok';
        const base = compartirFalso(true, 'ok').share;
        return shareTicketPrinter({
          ...base,
          shareFile: (a, m) =>
            o.resultado === 'ok'
              ? base.shareFile(a, m)
              : Promise.resolve(err({ code: 'SHARE_UNAVAILABLE' as const })),
        });
      },
      () => {
        o.resultado = 'falla';
      },
    );
  }

  it('comparte un archivo de texto con el nombre del ticket', async () => {
    const { share, compartidos } = compartirFalso(true, 'ok');
    await shareTicketPrinter(share).print(documentoDeContrato);
    expect(compartidos[0]?.name).toBe('Contrato.txt');
    expect(compartidos[0]?.mimeType).toBe('text/plain');
    expect(new TextDecoder().decode(compartidos[0]?.bytes)).toContain('$116.00');
  });

  it('si el dispositivo no comparte archivos, lo descarga', async () => {
    const { share, descargas } = compartirFalso(false, 'ok');
    expect((await shareTicketPrinter(share).print(documentoDeContrato)).ok).toBe(true);
    expect(descargas).toHaveLength(1);
  });

  it('cerrar el menú es cancelar; otro error es fallo; sin servicio no está configurada', async () => {
    expect(
      await shareTicketPrinter(compartirFalso(true, 'cancelado').share).print(documentoDeContrato),
    ).toEqual({ ok: false, error: { code: 'PRINT_CANCELLED' } });
    expect(
      await shareTicketPrinter(compartirFalso(true, 'falla').share).print(documentoDeContrato),
    ).toEqual({ ok: false, error: { code: 'PRINT_FAILED' } });
    const sin = shareTicketPrinter(undefined);
    expect((await sin.status()).state).toBe('NOT_CONFIGURED');
    expect((await sin.connect()).ok).toBe(false);
    expect((await sin.print(documentoDeContrato)).ok).toBe(false);
  });
});
