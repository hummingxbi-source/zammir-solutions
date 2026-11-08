// Ensayo de restauración de un respaldo (E9, S5-06, RNF-21): toma una copia de la base LOCAL, la borra y la recrea
// desde cero con las migraciones (un entorno limpio), restaura la copia y comprueba que cada tabla quedó igual.
// Es destructivo para la base local (la deja con lo mismo que tenía, pero pasando por una base vacía), así que
// solo corre contra Supabase LOCAL y pide confirmación explícita:
//
//   pnpm db:start
//   pnpm test:integracion                       (opcional: llena la base con datos de prueba más variados)
//   pnpm ensayo:restauracion --confirmo-borrar-la-base-local
//
// Con datos INVENTADOS, nunca con los de producción. Para producción el procedimiento es el de
// docs/operacion/RESTAURACION.md (el ensayo local demuestra el procedimiento y su verificación).
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { createClient } = createRequire(new URL('../apps/web/package.json', import.meta.url))(
  '@supabase/supabase-js',
);

if (!process.argv.includes('--confirmo-borrar-la-base-local')) {
  console.error(
    'Este ensayo borra y recrea la base de Supabase LOCAL.\nSi eso está bien, corre: pnpm ensayo:restauracion --confirmo-borrar-la-base-local',
  );
  process.exit(2);
}

const CONTENEDOR = 'supabase_db_zammir';
const carpeta = join(tmpdir(), 'zammir-ensayo-de-restauracion');
const archivoLocal = join(carpeta, 'respaldo.dump');
rmSync(carpeta, { recursive: true, force: true });
mkdirSync(carpeta, { recursive: true });

function ejecutar(comando, argumentos, opciones = {}) {
  const r = spawnSync(comando, argumentos, { encoding: 'utf8', shell: false, ...opciones });
  if (r.status !== 0) {
    throw new Error(
      `${comando} ${argumentos.join(' ')}\n${r.stderr ?? ''}${r.stdout ?? ''}`.trim(),
    );
  }
  return r.stdout;
}
const psql = (sql, usuario = 'postgres') =>
  ejecutar(
    'docker',
    ['exec', CONTENEDOR, 'psql', '-U', usuario, '-d', 'postgres', '-At', '-F', '|', '-c', sql],
    {
      env: { ...process.env, MSYS_NO_PATHCONV: '1' },
    },
  ).trim();

// Las llaves salen de `supabase status` y viven solo en este proceso.
function estadoDeSupabase() {
  const salida = ejecutar('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], { shell: true });
  const valores = new Map();
  for (const linea of salida.split(/\r?\n/)) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(linea);
    if (m?.[1] !== undefined && m[2] !== undefined) valores.set(m[1], m[2]);
  }
  return valores;
}

/** Una huella de cada tabla: cuántos renglones tiene y un resumen de todo su contenido. */
function huellas() {
  const tablas = psql(
    "select schemaname || '.' || relname from pg_stat_user_tables where schemaname = 'public' union all select 'auth.users' union all select 'auth.identities' order by 1",
  ).split('\n');
  const resultado = {};
  for (const tabla of tablas) {
    const [conteo, resumen] = psql(
      `select count(*), md5(coalesce(string_agg(t::text, E'\\n' order by t::text), '')) from ${tabla} t`,
    ).split('|');
    resultado[tabla] = { renglones: Number(conteo), huella: resumen };
  }
  return resultado;
}

const cronometro = () => {
  const inicio = Date.now();
  return () => ((Date.now() - inicio) / 1000).toFixed(1);
};
const paso = (texto) => console.log(`\n▶ ${texto}`);

// ---------- 0. Una cuenta de administrador de prueba, para comprobar que las cuentas también se restauran ----------
paso('Preparando una cuenta de administrador de prueba');
const valores = estadoDeSupabase();
const servicio = createClient(valores.get('API_URL'), valores.get('SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sufijo = Math.random().toString(16).slice(2, 10);
const canario = { correo: `ensayo-${sufijo}@ejemplo.invalid`, clave: `Clave-${sufijo}-Ensayo1` };
const creada = await servicio.auth.admin.createUser({
  email: canario.correo,
  password: canario.clave,
  email_confirm: true,
  app_metadata: { rol: 'ADMIN' },
});
if (creada.error) throw new Error(`No se pudo crear la cuenta de prueba: ${creada.error.message}`);

// ---------- 1. Estado de origen ----------
paso('Estado de origen: renglones y huella de cada tabla');
const origen = huellas();
const totalOrigen = Object.values(origen).reduce((s, t) => s + t.renglones, 0);
console.log(`  ${String(Object.keys(origen).length)} tablas, ${String(totalOrigen)} renglones`);

// ---------- 2. Respaldo ----------
paso('Tomando el respaldo (pg_dump, formato propio de PostgreSQL)');
let t = cronometro();
ejecutar(
  'docker',
  [
    'exec',
    CONTENEDOR,
    'pg_dump',
    '-U',
    'supabase_admin',
    '-d',
    'postgres',
    '-Fc',
    '--no-owner',
    '--no-privileges',
    '-t',
    'public.*',
    '-t',
    'auth.users',
    '-t',
    'auth.identities',
    '-f',
    '/tmp/respaldo.dump',
  ],
  { env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
);
ejecutar('docker', ['cp', `${CONTENEDOR}:/tmp/respaldo.dump`, archivoLocal]);
const tiempoRespaldo = t();
const tamano = statSync(archivoLocal).size;
console.log(`  Listo en ${tiempoRespaldo} s: ${String(Math.round(tamano / 1024))} KB`);

// ---------- 3. Entorno limpio ----------
paso('Recreando la base desde cero con las migraciones (un entorno limpio)');
t = cronometro();
ejecutar('pnpm', ['exec', 'supabase', 'db', 'reset'], { shell: true });
const tiempoLimpio = t();
const vacia = huellas();
const sobrantes = Object.entries(vacia).filter(
  ([nombre, v]) =>
    v.renglones > 0 &&
    !nombre.startsWith('auth.') &&
    nombre !== 'public.business_settings' &&
    nombre !== 'public.product_categories' &&
    nombre !== 'public.legal_documents',
);
console.log(`  Listo en ${tiempoLimpio} s`);
if (sobrantes.length > 0) {
  console.log(
    `  Con datos de arranque de las migraciones: ${sobrantes.map(([n, v]) => `${n}=${String(v.renglones)}`).join(', ')}`,
  );
}

// ---------- 4. Restauración ----------
paso('Restaurando el respaldo en la base limpia');
t = cronometro();
// Los datos de arranque de las migraciones (categorías, ajustes y documentos legales) vienen también en el respaldo:
// se vacían para no duplicarlos y que la restauración sea exactamente la copia.
// (Los documentos legales no se pueden borrar a propósito: se vacían en modo de réplica, sin disparadores.)
psql(
  'set session_replication_role = replica; truncate public.business_settings, public.product_categories, public.legal_documents restart identity cascade',
  'supabase_admin',
);
ejecutar('docker', ['cp', archivoLocal, `${CONTENEDOR}:/tmp/respaldo.dump`]);
ejecutar(
  'docker',
  [
    'exec',
    CONTENEDOR,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    'postgres',
    '--data-only',
    '--disable-triggers',
    '--no-owner',
    '-n',
    'auth',
    '-t',
    'users',
    '-t',
    'identities',
    '/tmp/respaldo.dump',
  ],
  { env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
);
ejecutar(
  'docker',
  [
    'exec',
    CONTENEDOR,
    'pg_restore',
    '-U',
    'supabase_admin',
    '-d',
    'postgres',
    '--data-only',
    '--disable-triggers',
    '--no-owner',
    '-n',
    'public',
    '/tmp/respaldo.dump',
  ],
  { env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
);
const tiempoRestauracion = t();
console.log(`  Listo en ${tiempoRestauracion} s`);

// ---------- 5. Verificación ----------
paso('Verificando: cada tabla debe quedar idéntica');
const despues = huellas();
const diferencias = [];
for (const nombre of Object.keys(origen)) {
  const a = origen[nombre];
  const b = despues[nombre];
  if (b === undefined || a.renglones !== b.renglones || a.huella !== b.huella) {
    diferencias.push(
      `${nombre}: origen ${String(a.renglones)} renglones, restaurada ${String(b?.renglones ?? 'no existe')}${a.renglones === b?.renglones ? ' (el contenido cambió)' : ''}`,
    );
  }
}

// Las cuentas también volvieron: la de prueba inicia sesión y una función de administrador le responde.
const clienteDePrueba = createClient(valores.get('API_URL'), valores.get('ANON_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sesion = await clienteDePrueba.auth.signInWithPassword({
  email: canario.correo,
  password: canario.clave,
});
let cuentaFunciona = false;
if (!sesion.error) {
  const r = await clienteDePrueba.rpc('admin_invoice_list');
  cuentaFunciona = r.error === null;
}

// Lo que se numera solo sigue su cuenta: un renglón nuevo no choca con los restaurados.
let numeracionFunciona;
try {
  const r = await servicio.rpc('error_log_record', {
    p_source: 'SERVER',
    p_name: 'Ensayo',
    p_message: 'Después de restaurar',
    p_stack: '',
    p_route: '/ensayo',
    p_app_version: 'ensayo',
  });
  numeracionFunciona = r.error === null && r.data === true;
} catch {
  numeracionFunciona = false;
}

// ---------- Resultado ----------
const ok = diferencias.length === 0 && cuentaFunciona && numeracionFunciona;
console.log('\n══════════════ Resultado del ensayo ══════════════');
console.log(
  `| Paso | Tiempo |\n|---|---|\n| Respaldo (${String(Math.round(tamano / 1024))} KB) | ${tiempoRespaldo} s |\n| Base limpia desde las migraciones | ${tiempoLimpio} s |\n| Restauración | ${tiempoRestauracion} s |`,
);
console.log(
  `\nTablas comparadas: ${String(Object.keys(origen).length)} (${String(totalOrigen)} renglones)`,
);
console.log(
  diferencias.length === 0
    ? '✔ Todas las tablas quedaron idénticas (mismo número de renglones y mismo contenido).'
    : `✘ Diferencias:\n  - ${diferencias.join('\n  - ')}`,
);
console.log(
  cuentaFunciona
    ? '✔ La cuenta de administrador restaurada inicia sesión y su función responde.'
    : '✘ La cuenta de administrador restaurada no funciona.',
);
console.log(
  numeracionFunciona
    ? '✔ Lo que se numera solo siguió contando sin chocar.'
    : '✘ La numeración automática falló después de restaurar.',
);
console.log(ok ? '\nENSAYO APROBADO' : '\nENSAYO FALLIDO');
rmSync(carpeta, { recursive: true, force: true });
// Sin `process.exit`: en Windows cortar el proceso con conexiones abiertas lo hace terminar con error.
process.exitCode = ok ? 0 : 1;
