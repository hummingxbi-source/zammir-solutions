import { describe, expect, it } from 'vitest';

import { encodeUtf8 } from './utf8';
import { crc32, createZip } from './zip';

const bytes = encodeUtf8;

/** Decodifica UTF-8 (solo para leer lo que escribió el ZIP en las pruebas). */
function texto(datos: Uint8Array): string {
  let salida = '';
  for (let i = 0; i < datos.length;) {
    const b = datos[i] ?? 0;
    const largo = b < 0x80 ? 1 : b < 0xe0 ? 2 : b < 0xf0 ? 3 : 4;
    const resto = datos.slice(i + 1, i + largo).reduce((acc, x) => (acc << 6) | (x & 0x3f), 0);
    const inicial = largo === 1 ? b : b & (0xff >> (largo + 1));
    salida += String.fromCodePoint(largo === 1 ? inicial : (inicial << (6 * (largo - 1))) | resto);
    i += largo;
  }
  return salida;
}

/** Lector de ZIP independiente del escritor: recorre el directorio central y devuelve cada archivo. */
function leerZip(
  zip: Uint8Array,
): { name: string; data: Uint8Array; crc: number; flags: number; method: number }[] {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const fin = zip.length - 22;
  expect(v.getUint32(fin, true)).toBe(0x06054b50);
  const cuantos = v.getUint16(fin + 10, true);
  let posicion = v.getUint32(fin + 16, true);
  const salida = [];
  for (let i = 0; i < cuantos; i += 1) {
    expect(v.getUint32(posicion, true)).toBe(0x02014b50);
    const flags = v.getUint16(posicion + 8, true);
    const method = v.getUint16(posicion + 10, true);
    const crc = v.getUint32(posicion + 16, true);
    const tamano = v.getUint32(posicion + 24, true);
    const largoNombre = v.getUint16(posicion + 28, true);
    const local = v.getUint32(posicion + 42, true);
    const name = texto(zip.slice(posicion + 46, posicion + 46 + largoNombre));
    // La cabecera local repite los datos y apunta al contenido.
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    expect(v.getUint32(local + 14, true)).toBe(crc);
    const largoLocal = v.getUint16(local + 26, true);
    const inicio = local + 30 + largoLocal;
    salida.push({ name, data: zip.slice(inicio, inicio + tamano), crc, flags, method });
    posicion += 46 + largoNombre;
  }
  return salida;
}

describe('CRC-32', () => {
  it('coincide con el valor de referencia del estándar', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926);
  });
  it('de nada es cero y cambia con un solo byte', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
    expect(crc32(bytes('a'))).not.toBe(crc32(bytes('b')));
  });
});

describe('ZIP', () => {
  const ahora = new Date('2026-11-08T18:30:00.000Z');

  it('guarda cada archivo con su nombre, su contenido y su suma de verificación', () => {
    const zip = createZip(
      [
        { name: 'LEEME.txt', data: bytes('hola') },
        { name: 'csv/clientes.csv', data: bytes('id,nombre\r\n1,Peña\r\n') },
        { name: 'vacio.txt', data: new Uint8Array(0) },
      ],
      ahora,
    );
    const archivos = leerZip(zip);
    expect(archivos.map((a) => a.name)).toEqual(['LEEME.txt', 'csv/clientes.csv', 'vacio.txt']);
    expect(texto(archivos[0]?.data ?? new Uint8Array())).toBe('hola');
    expect(texto(archivos[1]?.data ?? new Uint8Array())).toBe('id,nombre\r\n1,Peña\r\n');
    expect(archivos[2]?.data.length).toBe(0);
    for (const a of archivos) {
      expect(a.crc).toBe(crc32(a.data));
      expect(a.method).toBe(0);
    }
  });

  it('marca los nombres como UTF-8 (acentos en los nombres de archivo)', () => {
    const [a] = leerZip(createZip([{ name: 'año.txt', data: bytes('x') }], ahora));
    expect(a?.name).toBe('año.txt');
    expect((a?.flags ?? 0) & 0x0800).toBe(0x0800);
  });

  it('un ZIP sin archivos es válido', () => {
    const zip = createZip([], ahora);
    expect(zip.length).toBe(22);
    expect(leerZip(zip)).toEqual([]);
  });

  it('el contenido binario (un PDF) no se altera', () => {
    const binario = new Uint8Array(512).map((_, i) => (i * 7) % 256);
    const [a] = leerZip(createZip([{ name: 'a.pdf', data: binario }], ahora));
    expect(a?.data).toEqual(binario);
  });

  it('un nombre repetido es un error', () => {
    expect(() =>
      createZip(
        [
          { name: 'a.txt', data: bytes('1') },
          { name: 'a.txt', data: bytes('2') },
        ],
        ahora,
      ),
    ).toThrow(/repetido/);
  });

  it('guarda la fecha y hora de la creación (formato DOS)', () => {
    const zip = createZip([{ name: 'a', data: bytes('x') }], ahora);
    const v = new DataView(zip.buffer);
    const hora = v.getUint16(10, true);
    const fecha = v.getUint16(12, true);
    expect(hora >> 11).toBe(18);
    expect((hora >> 5) & 0x3f).toBe(30);
    expect(fecha >> 9).toBe(2026 - 1980);
    expect((fecha >> 5) & 0xf).toBe(11);
    expect(fecha & 0x1f).toBe(8);
  });
});

/** Cada campo de las cabeceras, uno por uno, de un ZIP de dos archivos. */
describe('ZIP · estructura exacta', () => {
  const ahora = new Date('2026-11-08T18:30:42.000Z');
  const a = { name: 'a.txt', data: bytes('hola') };
  const b = { name: 'carpeta/b.csv', data: bytes('x,y\r\n1,2\r\n') };
  const zip = createZip([a, b], ahora);
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

  const largoLocal = (e: { name: string; data: Uint8Array }): number =>
    30 + e.name.length + e.data.length;
  const inicioB = largoLocal(a);
  const inicioCentral = largoLocal(a) + largoLocal(b);
  const tamanoCentral = 46 + a.name.length + 46 + b.name.length;
  const HORA = (18 << 11) | (30 << 5) | 21;
  const FECHA = ((2026 - 1980) << 9) | (11 << 5) | 8;

  it('cada cabecera local trae versión, banderas, método, hora, suma, tamaños y largos', () => {
    for (const [inicio, e] of [
      [0, a],
      [inicioB, b],
    ] as const) {
      expect(v.getUint32(inicio, true)).toBe(0x04034b50);
      expect(v.getUint16(inicio + 4, true)).toBe(20);
      expect(v.getUint16(inicio + 6, true)).toBe(0x0800);
      expect(v.getUint16(inicio + 8, true)).toBe(0);
      expect(v.getUint16(inicio + 10, true)).toBe(HORA);
      expect(v.getUint16(inicio + 12, true)).toBe(FECHA);
      expect(v.getUint32(inicio + 14, true)).toBe(crc32(e.data));
      expect(v.getUint32(inicio + 18, true)).toBe(e.data.length);
      expect(v.getUint32(inicio + 22, true)).toBe(e.data.length);
      expect(v.getUint16(inicio + 26, true)).toBe(e.name.length);
      expect(v.getUint16(inicio + 28, true)).toBe(0);
    }
  });

  it('el nombre y el contenido van pegados a su cabecera local', () => {
    expect(texto(zip.slice(30, 30 + a.name.length))).toBe('a.txt');
    expect(texto(zip.slice(30 + a.name.length, largoLocal(a)))).toBe('hola');
    expect(texto(zip.slice(inicioB + 30, inicioB + 30 + b.name.length))).toBe('carpeta/b.csv');
  });

  it('cada entrada del directorio central repite los datos y apunta a su cabecera local', () => {
    let pos = inicioCentral;
    for (const [desplazamiento, e] of [
      [0, a],
      [inicioB, b],
    ] as const) {
      expect(v.getUint32(pos, true)).toBe(0x02014b50);
      expect(v.getUint16(pos + 4, true)).toBe(20);
      expect(v.getUint16(pos + 6, true)).toBe(20);
      expect(v.getUint16(pos + 8, true)).toBe(0x0800);
      expect(v.getUint16(pos + 10, true)).toBe(0);
      expect(v.getUint16(pos + 12, true)).toBe(HORA);
      expect(v.getUint16(pos + 14, true)).toBe(FECHA);
      expect(v.getUint32(pos + 16, true)).toBe(crc32(e.data));
      expect(v.getUint32(pos + 20, true)).toBe(e.data.length);
      expect(v.getUint32(pos + 24, true)).toBe(e.data.length);
      expect(v.getUint16(pos + 28, true)).toBe(e.name.length);
      expect(v.getUint16(pos + 30, true)).toBe(0);
      expect(v.getUint16(pos + 32, true)).toBe(0);
      expect(v.getUint16(pos + 34, true)).toBe(0);
      expect(v.getUint16(pos + 36, true)).toBe(0);
      expect(v.getUint32(pos + 38, true)).toBe(0);
      expect(v.getUint32(pos + 42, true)).toBe(desplazamiento);
      expect(texto(zip.slice(pos + 46, pos + 46 + e.name.length))).toBe(e.name);
      pos += 46 + e.name.length;
    }
  });

  it('el cierre dice cuántos archivos hay, dónde empieza el directorio central y cuánto mide', () => {
    const fin = inicioCentral + tamanoCentral;
    expect(zip.length).toBe(fin + 22);
    expect(v.getUint32(fin, true)).toBe(0x06054b50);
    expect(v.getUint16(fin + 4, true)).toBe(0);
    expect(v.getUint16(fin + 6, true)).toBe(0);
    expect(v.getUint16(fin + 8, true)).toBe(2);
    expect(v.getUint16(fin + 10, true)).toBe(2);
    expect(v.getUint32(fin + 12, true)).toBe(tamanoCentral);
    expect(v.getUint32(fin + 16, true)).toBe(inicioCentral);
    expect(v.getUint16(fin + 20, true)).toBe(0);
  });

  it('un año anterior a 1980 se guarda como 1980 (el formato DOS no llega más atrás)', () => {
    const viejo = new DataView(createZip([a], new Date('1970-01-01T00:00:00.000Z')).buffer);
    expect(viejo.getUint16(12, true) >> 9).toBe(0);
  });

  it('el segundo se guarda de dos en dos', () => {
    const impar = new DataView(createZip([a], new Date('2026-11-08T18:30:43.000Z')).buffer);
    expect(impar.getUint16(10, true) & 0x1f).toBe(21);
  });

  it('más de 65,535 archivos no caben en un ZIP', () => {
    const muchos = Array.from({ length: 0x10000 }, (_, i) => ({
      name: String(i),
      data: new Uint8Array(0),
    }));
    expect(() => createZip(muchos, ahora)).toThrow(RangeError);
  });

  it('65,535 archivos sí caben', () => {
    const justos = Array.from({ length: 0xffff }, (_, i) => ({
      name: String(i),
      data: new Uint8Array(0),
    }));
    const grande = createZip(justos, ahora);
    const fin = grande.length - 22;
    expect(new DataView(grande.buffer).getUint16(fin + 10, true)).toBe(0xffff);
  });
});
