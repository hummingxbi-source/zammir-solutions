// Corre las pruebas de integración contra Supabase local (debe estar encendido: `pnpm db:start`).
// Las llaves salen de `supabase status` y viven solo en el entorno de este proceso; no se
// escriben en ningún archivo ni se imprimen.
import { spawn, spawnSync } from 'node:child_process';

const estado = spawnSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
  shell: true,
  encoding: 'utf8',
});
if (estado.status !== 0) {
  process.stderr.write(
    'No se pudo leer el estado de Supabase local. ¿Está encendido (pnpm db:start)?\n',
  );
  process.exit(1);
}

const valores = new Map();
for (const linea of estado.stdout.split(/\r?\n/)) {
  const m = /^([A-Z_]+)="?(.*?)"?$/.exec(linea);
  if (m?.[1] !== undefined && m[2] !== undefined) valores.set(m[1], m[2]);
}

const url = valores.get('API_URL');
const anon = valores.get('ANON_KEY');
const servicio = valores.get('SERVICE_ROLE_KEY');
const dbUrl = valores.get('DB_URL');
if (url === undefined || anon === undefined || servicio === undefined) {
  process.stderr.write('Faltan API_URL, ANON_KEY o SERVICE_ROLE_KEY en el estado de Supabase.\n');
  process.exit(1);
}

// Las funciones de servidor se prueban de verdad: si no están sirviéndose, se encienden aquí
// (con el núcleo recién empaquetado) y se apagan al terminar.
async function responde() {
  try {
    await fetch(`${url}/functions/v1/registrar-dispositivo`, { method: 'OPTIONS' });
    return true;
  } catch {
    return false;
  }
}

let servidor;
if (!(await responde())) {
  const empaquetado = spawnSync('pnpm', ['funciones:empaquetar'], {
    shell: true,
    stdio: 'inherit',
  });
  if (empaquetado.status !== 0) process.exit(1);
  servidor = spawn('pnpm', ['exec', 'supabase', 'functions', 'serve', '--no-verify-jwt'], {
    shell: true,
    stdio: 'ignore',
    detached: process.platform !== 'win32',
  });
  const limite = Date.now() + 120_000;
  while (!(await responde())) {
    if (Date.now() > limite) {
      process.stderr.write('Las funciones de servidor no encendieron a tiempo.\n');
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

function apagar() {
  if (servidor?.pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(servidor.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    process.kill(-servidor.pid);
  }
}

const resultado = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', '--project', 'integracion', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      ZAMMIR_TEST_SUPABASE_URL: url,
      ZAMMIR_TEST_SUPABASE_ANON_KEY: anon,
      ZAMMIR_TEST_SUPABASE_SERVICE_KEY: servicio,
      ZAMMIR_TEST_DB_URL: dbUrl ?? '',
    },
  },
);
apagar();
process.exit(resultado.status ?? 1);
