import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

// Las pruebas de integración necesitan Supabase local: `pnpm test:integracion` las enciende.
const conSupabase = process.env.ZAMMIR_TEST_SUPABASE_URL !== undefined;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          environment: 'node',
          include: ['packages/core/src/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['apps/web/src/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, '**/*.integracion.test.ts'],
          setupFiles: ['apps/web/src/test/setup.ts'],
        },
      },
      ...(conSupabase
        ? [
            {
              test: {
                name: 'integracion',
                environment: 'node',
                include: ['apps/web/src/**/*.integracion.test.ts'],
                testTimeout: 30_000,
              },
            },
          ]
        : []),
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts', 'apps/web/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/index.ts',
        'apps/web/src/main.tsx',
        'apps/web/src/test/**',
      ],
      reporter: ['text-summary', 'lcov'],
      // Umbrales de docs/plan/00-principios-de-ingenieria.md §4.2. Nunca se bajan [CLAUDE.md regla 11].
      thresholds: {
        lines: 85,
        // Dinero, IVA, redondeo, reglas de precio y folios: 100 % de líneas y ramas.
        'packages/core/src/shared-kernel/money/**': { lines: 100, branches: 100, functions: 100 },
        'packages/core/src/shared-kernel/tax/**': { lines: 100, branches: 100, functions: 100 },
        'packages/core/src/modules/catalog/domain/pricing/**': {
          lines: 100,
          branches: 100,
          functions: 100,
        },
        'packages/core/src/shared-kernel/folio/**': { lines: 100, branches: 100, functions: 100 },
      },
    },
  },
});
