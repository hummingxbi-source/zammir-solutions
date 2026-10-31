// Mutación de las piezas que no pueden fallar (dinero, IVA, precios y folios; ≥ 90 %).
// Mientras esas piezas no existan (llegan en el Sprint 1) no hay nada que mutar y Stryker
// terminaría con error por "cero mutantes". En cuanto exista una carpeta crítica, corre siempre.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const CARPETAS_CRITICAS = [
  'packages/core/src/shared-kernel/money',
  'packages/core/src/shared-kernel/tax',
  'packages/core/src/shared-kernel/folio',
  'packages/core/src/modules/catalog/domain/pricing',
  'packages/core/src/modules/quotes/domain',
];

const existentes = CARPETAS_CRITICAS.filter((carpeta) => existsSync(carpeta));

if (existentes.length === 0) {
  process.stdout.write(
    'Todavía no existen piezas críticas (dinero, IVA, precios, folios): no hay nada que mutar.\n',
  );
  process.exit(0);
}

const resultado = spawnSync('pnpm', ['exec', 'stryker', 'run', 'stryker.critico.config.mjs'], {
  stdio: 'inherit',
  shell: true,
});
process.exit(resultado.status ?? 1);
