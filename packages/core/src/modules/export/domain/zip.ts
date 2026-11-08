import { encodeUtf8 } from './utf8';

export interface ZipEntry {
  /** Ruta dentro del ZIP, con `/` como separador (por ejemplo `csv/clientes.csv`). */
  readonly name: string;
  readonly data: Uint8Array;
}

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

/** Suma de verificación CRC-32 (la que usa el formato ZIP). */
export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of datos) {
    c = (TABLA_CRC[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function fechaDos(fecha: Date): { time: number; date: number } {
  const anio = Math.max(1980, fecha.getUTCFullYear());
  return {
    time: (fecha.getUTCHours() << 11) | (fecha.getUTCMinutes() << 5) | (fecha.getUTCSeconds() >> 1),
    date: ((anio - 1980) << 9) | ((fecha.getUTCMonth() + 1) << 5) | fecha.getUTCDate(),
  };
}

const MAX_ENTRADAS = 0xffff;
const MAX_BYTES = 0xffffffff;

/** Arma un archivo ZIP sin comprimir ("store"), que abre cualquier programa. Sin dependencias: lo que se exporta
 *  son CSV, JSON y PDF, que ya van en un solo archivo y no necesitan compresión. Los nombres van en UTF-8. */
export function createZip(entries: readonly ZipEntry[], now: Date): Uint8Array {
  if (entries.length > MAX_ENTRADAS) {
    throw new RangeError('Demasiados archivos para un ZIP');
  }
  const nombres = new Set<string>();
  const { time, date } = fechaDos(now);

  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const entrada of entries) {
    if (nombres.has(entrada.name)) {
      throw new Error(`Archivo repetido en el ZIP: ${entrada.name}`);
    }
    nombres.add(entrada.name);
    const nombre = encodeUtf8(entrada.name);
    const crc = crc32(entrada.data);
    const tamano = entrada.data.length;
    if (tamano > MAX_BYTES || desplazamiento > MAX_BYTES) {
      throw new RangeError('El ZIP es demasiado grande');
    }

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // versión mínima
    local.setUint16(6, 0x0800, true); // nombres en UTF-8
    local.setUint16(8, 0, true); // sin compresión
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, tamano, true);
    local.setUint32(22, tamano, true);
    local.setUint16(26, nombre.length, true);
    local.setUint16(28, 0, true);
    locales.push(new Uint8Array(local.buffer), nombre, entrada.data);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true); // versión con que se hizo
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, time, true);
    central.setUint16(14, date, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, tamano, true);
    central.setUint32(24, tamano, true);
    central.setUint16(28, nombre.length, true);
    central.setUint32(42, desplazamiento, true);
    centrales.push(new Uint8Array(central.buffer), nombre);

    desplazamiento += 30 + nombre.length + tamano;
  }

  const tamanoCentral = centrales.reduce((suma, parte) => suma + parte.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, entries.length, true);
  fin.setUint16(10, entries.length, true);
  fin.setUint32(12, tamanoCentral, true);
  fin.setUint32(16, desplazamiento, true);

  const partes = [...locales, ...centrales, new Uint8Array(fin.buffer)];
  const total = partes.reduce((suma, parte) => suma + parte.length, 0);
  const salida = new Uint8Array(total);
  let posicion = 0;
  for (const parte of partes) {
    salida.set(parte, posicion);
    posicion += parte.length;
  }
  return salida;
}
