// Corre las pruebas de integración contra Supabase local (debe estar encendido: `pnpm db:start`).
// Las llaves salen de `supabase status` y viven solo en el entorno de este proceso; no se
// escriben en ningún archivo ni se imprimen.
import { spawnSync } from 'node:child_process';

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
if (url === undefined || anon === undefined || servicio === undefined) {
  process.stderr.write('Faltan API_URL, ANON_KEY o SERVICE_ROLE_KEY en el estado de Supabase.\n');
  process.exit(1);
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
    },
  },
);
process.exit(resultado.status ?? 1);
