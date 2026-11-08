// Revisa el paquete que se entrega al navegador (apps/web/dist) y falla si trae un secreto [S5-07, RNF-08, RNF-19].
// Se corre después de construir: `pnpm build && pnpm check:bundle`. Las llaves públicas (la anónima de Supabase) sí
// pueden estar; la de servicio, las del proveedor de timbrado y las de Turnstile nunca.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = new URL('../apps/web/dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function archivos(carpeta) {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

let lista;
try {
  lista = archivos(dist).filter((r) => /\.(js|mjs|css|html|json|map|txt|webmanifest)$/.test(r));
} catch {
  console.error('No existe apps/web/dist. Construye primero: pnpm build');
  process.exit(1);
}
if (lista.length === 0) {
  console.error('apps/web/dist no tiene archivos que revisar.');
  process.exit(1);
}

const prohibidas = [
  [/SERVICE_ROLE/, 'nombre de la llave de servicio'],
  [/SUPABASE_DB_URL/, 'cadena de conexión a la base'],
  [/PAC_API_KEY|PAC_API_URL/, 'variables del proveedor de timbrado'],
  [/TURNSTILE_SECRET/, 'llave secreta de Turnstile'],
  [/PORTAL_HASH_PEPPER/, 'pimienta de las huellas del portal'],
  [/sb_secret_[A-Za-z0-9_-]{20,}/, 'llave secreta de Supabase'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'llave privada'],
];
const jwt = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]*/g;

const problemas = [];
for (const ruta of lista) {
  const texto = readFileSync(ruta, 'utf8');
  for (const [patron, que] of prohibidas) {
    if (patron.test(texto)) problemas.push(`${relative(dist, ruta)}: ${que}`);
  }
  for (const m of texto.matchAll(jwt)) {
    try {
      const rol = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')).role;
      if (rol !== 'anon')
        problemas.push(`${relative(dist, ruta)}: un token con rol "${String(rol)}"`);
    } catch {
      // No era un token de verdad.
    }
  }
}

if (problemas.length > 0) {
  console.error('El paquete del navegador trae secretos:');
  for (const p of problemas) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`Paquete del navegador revisado: ${String(lista.length)} archivos, sin secretos.`);
