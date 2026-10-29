// Genera los iconos provisionales de la aplicación instalable (apps/web/public).
// Son un cuadrado azul de la marca con una Z blanca; la identidad real llega con PD-35.
// Uso: node scripts/generar-iconos.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const AZUL = [0x1f, 0x3a, 0x5f];
const BLANCO = [0xff, 0xff, 0xff];

function crc32(buffer) {
  let c;
  let crc = 0xffffffff;
  for (const byte of buffer) {
    c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function fragmento(tipo, datos) {
  const longitud = Buffer.alloc(4);
  longitud.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const suma = Buffer.alloc(4);
  suma.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([longitud, cuerpo, suma]);
}

/** ¿Este punto (0 a 1) cae en el trazo de la Z? */
function enLaZ(x, y, margen) {
  const grosor = 0.12;
  const izq = margen;
  const der = 1 - margen;
  const arriba = margen;
  const abajo = 1 - margen;
  const dentro = x >= izq && x <= der && y >= arriba && y <= abajo;
  if (!dentro) return false;
  const barraSuperior = y <= arriba + grosor;
  const barraInferior = y >= abajo - grosor;
  // Diagonal de arriba a la derecha hacia abajo a la izquierda.
  const t = (y - arriba) / (abajo - arriba);
  const xDiagonal = der - t * (der - izq);
  const diagonal = Math.abs(x - xDiagonal) <= grosor * 0.9;
  return barraSuperior || barraInferior || diagonal;
}

function png(lado, margen) {
  const filas = [];
  for (let y = 0; y < lado; y += 1) {
    const fila = Buffer.alloc(1 + lado * 3);
    for (let x = 0; x < lado; x += 1) {
      const color = enLaZ(x / lado, y / lado, margen) ? BLANCO : AZUL;
      fila.set(color, 1 + x * 3);
    }
    filas.push(fila);
  }
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(lado, 0);
  cabecera.writeUInt32BE(lado, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = 2; // color verdadero (RGB)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    fragmento('IHDR', cabecera),
    fragmento('IDAT', deflateSync(Buffer.concat(filas))),
    fragmento('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('apps/web/public', { recursive: true });
// El icono "maskable" deja más margen: Android recorta los bordes en círculo o gota.
writeFileSync('apps/web/public/icono-192.png', png(192, 0.25));
writeFileSync('apps/web/public/icono-512.png', png(512, 0.25));
writeFileSync('apps/web/public/icono-512-maskable.png', png(512, 0.32));
console.log('Iconos generados en apps/web/public');
