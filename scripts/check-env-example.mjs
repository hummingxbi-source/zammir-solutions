// Verifica que .env.example documente todas las variables que usa el código y que
// no traiga ningún valor real (historia S0-05, criterio de ADR-0010).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CARPETAS = ['apps', 'packages', 'supabase'];
const IGNORAR = new Set(['node_modules', 'dist', 'coverage', '.temp', '.branches']);
const EXTENSIONES = /\.(ts|tsx|js|mjs|cjs)$/;

function archivos(dir) {
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    if (IGNORAR.has(nombre)) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (EXTENSIONES.test(nombre)) salida.push(ruta);
  }
  return salida;
}

const usadas = new Set();
const patrones = [
  /import\.meta\.env\.([A-Z][A-Z0-9_]+)/g,
  /process\.env\.([A-Z][A-Z0-9_]+)/g,
  /Deno\.env\.get\(\s*['"]([A-Z][A-Z0-9_]+)['"]\s*\)/g,
];
for (const carpeta of CARPETAS) {
  let existe = true;
  try {
    statSync(join(RAIZ, carpeta));
  } catch {
    existe = false;
  }
  if (!existe) continue;
  for (const archivo of archivos(join(RAIZ, carpeta))) {
    const texto = readFileSync(archivo, 'utf8');
    for (const patron of patrones) {
      for (const m of texto.matchAll(patron)) usadas.add(m[1]);
    }
  }
}
// Variables que define el propio entorno de Vite, no ZAMMIR.
for (const propia of ['MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL']) usadas.delete(propia);

const lineas = readFileSync(join(RAIZ, '.env.example'), 'utf8').split(/\r?\n/);
const documentadas = new Map();
for (const linea of lineas) {
  const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(linea);
  if (m) documentadas.set(m[1], m[2]);
}

const errores = [];
for (const nombre of usadas) {
  if (!documentadas.has(nombre)) errores.push(`Falta en .env.example: ${nombre}`);
}
for (const [nombre, valor] of documentadas) {
  if (valor.trim() !== '') errores.push(`.env.example no debe traer valores: ${nombre}`);
}

if (errores.length > 0) {
  for (const e of errores) process.stderr.write(`${e}\n`);
  process.exit(1);
}
process.stdout.write(
  `.env.example en orden: ${String(documentadas.size)} variables documentadas, ${String(usadas.size)} usadas en el código.\n`,
);
