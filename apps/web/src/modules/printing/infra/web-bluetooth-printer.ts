import {
  encodeEscPos,
  err,
  ok,
  type PrinterError,
  type PrinterStatus,
  type PrintDocument,
  type TicketPrinter,
} from '@zammir/core';

/** Lo que se necesita de una impresora Bluetooth. Los valores salen de la configuración porque el modelo
 *  de impresora todavía no se define (PD-15); estos son los de las térmicas más comunes. */
export interface AjustesDeBluetooth {
  readonly serviceUuid: string;
  readonly characteristicUuid: string;
  /** Bytes por escritura; las térmicas aguantan poco por paquete. */
  readonly chunkSize: number;
}

export const AJUSTES_DE_BLUETOOTH_COMUNES: AjustesDeBluetooth = {
  serviceUuid: '000018f0-0000-1000-8000-00805f9b34fb',
  characteristicUuid: '00002af1-0000-1000-8000-00805f9b34fb',
  chunkSize: 100,
};

/** Lo mínimo que usa de Web Bluetooth, para probarlo sin una impresora. */
export interface CaracteristicaBluetooth {
  writeValueWithoutResponse?(valor: BufferSource): Promise<void>;
  writeValue(valor: BufferSource): Promise<void>;
}
export interface DispositivoBluetooth {
  readonly name?: string | undefined;
  readonly gatt?:
    | {
        connected: boolean;
        connect(): Promise<{
          getPrimaryService(uuid: string): Promise<{
            getCharacteristic(uuid: string): Promise<CaracteristicaBluetooth>;
          }>;
        }>;
      }
    | undefined;
}
export interface EntornoBluetooth {
  requestDevice(opciones: {
    filters?: { services: string[] }[];
    optionalServices?: string[];
    acceptAllDevices?: boolean;
  }): Promise<DispositivoBluetooth>;
}

/** Imprime por Bluetooth con Web Bluetooth (primera opción) [S3-21]. Solo funciona en Chrome de Android y
 *  con una acción del usuario; si no hay Web Bluetooth, el estado es "no configurada" y se usa el respaldo. */
export function webBluetoothPrinter(
  bluetooth: EntornoBluetooth | undefined,
  ajustes: AjustesDeBluetooth = AJUSTES_DE_BLUETOOTH_COMUNES,
): TicketPrinter {
  let dispositivo: DispositivoBluetooth | null = null;
  let caracteristica: CaracteristicaBluetooth | null = null;

  const estado = (): PrinterStatus => {
    if (bluetooth === undefined || dispositivo === null) {
      return { state: 'NOT_CONFIGURED', name: null };
    }
    return {
      state:
        dispositivo.gatt?.connected === true && caracteristica !== null ? 'READY' : 'DISCONNECTED',
      name: dispositivo.name ?? null,
    };
  };

  async function enlazar(): Promise<PrinterError | null> {
    if (dispositivo?.gatt === undefined) {
      return { code: 'PRINTER_NOT_CONFIGURED' };
    }
    try {
      const servidor = await dispositivo.gatt.connect();
      const servicio = await servidor.getPrimaryService(ajustes.serviceUuid);
      caracteristica = await servicio.getCharacteristic(ajustes.characteristicUuid);
      return null;
    } catch {
      caracteristica = null;
      return { code: 'PRINTER_UNAVAILABLE' };
    }
  }

  return {
    label: 'Impresora Bluetooth',
    status: () => Promise.resolve(estado()),
    async connect() {
      if (bluetooth === undefined) {
        return err({ code: 'PRINTER_NOT_CONFIGURED' as const });
      }
      try {
        dispositivo = await bluetooth.requestDevice({
          filters: [{ services: [ajustes.serviceUuid] }],
          optionalServices: [ajustes.serviceUuid],
        });
      } catch (error) {
        // El usuario cerró la lista de dispositivos: no es un fallo.
        if (error instanceof DOMException && error.name === 'NotFoundError') {
          return err({ code: 'PRINT_CANCELLED' as const });
        }
        return err({ code: 'PRINTER_UNAVAILABLE' as const });
      }
      const falla = await enlazar();
      return falla === null ? ok(estado()) : err(falla);
    },
    async print(documento: PrintDocument) {
      if (bluetooth === undefined || dispositivo === null) {
        return err({ code: 'PRINTER_NOT_CONFIGURED' as const });
      }
      if (dispositivo.gatt?.connected !== true || caracteristica === null) {
        const falla = await enlazar();
        if (falla !== null) {
          return err(falla);
        }
      }
      const destino = caracteristica;
      if (destino === null) {
        return err({ code: 'PRINTER_UNAVAILABLE' as const });
      }
      const bytes = encodeEscPos(documento);
      try {
        for (let i = 0; i < bytes.length; i += ajustes.chunkSize) {
          const trozo = bytes.slice(i, i + ajustes.chunkSize);
          if (destino.writeValueWithoutResponse !== undefined) {
            await destino.writeValueWithoutResponse(trozo);
          } else {
            await destino.writeValue(trozo);
          }
        }
        return ok(undefined);
      } catch {
        caracteristica = null;
        return err({ code: 'PRINT_FAILED' as const });
      }
    },
  };
}
