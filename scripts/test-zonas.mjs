// Corre las pruebas en varias zonas horarias, todas distintas a la de México, para
// detectar errores de "día" y "semana" [RN-17, docs/calidad/TESTING.md §3].
import { spawnSync } from 'node:child_process';

const ZONAS = ['UTC', 'Asia/Tokyo', 'Pacific/Auckland'];
const args = process.argv.slice(2);

for (const zona of ZONAS) {
  process.stdout.write(`\n== Zona horaria: ${zona}\n`);
  const r = spawnSync('pnpm', ['exec', 'vitest', 'run', ...args], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, TZ: zona },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
