// Compuerta del Sprint 2: las pruebas de sincronización y folios contra el servidor real deben pasar
// 10 veces seguidas, para descartar fallas intermitentes (docs/plan/fase-06). Se detiene en la primera
// que falle. Requiere Supabase local encendido (`pnpm db:start`).
import { spawnSync } from 'node:child_process';

const veces = Number(process.argv[2] ?? 10);
for (let i = 1; i <= veces; i += 1) {
  process.stdout.write(`Ronda ${String(i)} de ${String(veces)}…\n`);
  const r = spawnSync(
    'pnpm',
    ['test:integracion', 'sync.integracion', 'recibir-operacion', 'pg-folio-allocator'],
    { stdio: 'inherit', shell: true },
  );
  if (r.status !== 0) {
    process.stderr.write(`Falló en la ronda ${String(i)}: la concurrencia NO está en verde.\n`);
    process.exit(1);
  }
}
process.stdout.write(`Las ${String(veces)} rondas pasaron: la concurrencia está en verde.\n`);
