// Pruebas de mutación sobre packages/core [docs/calidad/TESTING.md §1].
// Umbrales de 00-principios §4.2: el resto del dominio ≥ 80 %. Dinero, IVA, redondeo, reglas de
// precio y folios exigen ≥ 90 %: se corren con `pnpm test:mutacion:critico` (umbral propio).
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // pnpm no deja ver los complementos de Stryker sin declararlos.
  plugins: ['@stryker-mutator/vitest-runner', '@stryker-mutator/typescript-checker'],
  testRunner: 'vitest',
  checkers: ['typescript'],
  tsconfigFile: 'packages/core/tsconfig.json',
  mutate: [
    'packages/core/src/**/*.ts',
    '!packages/core/src/**/*.test.ts',
    '!packages/core/src/**/*.fixtures.ts',
    '!packages/core/src/**/contracts/**',
    '!packages/core/src/index.ts',
  ],
  vitest: { configFile: 'vitest.config.ts' },
  reporters: ['clear-text', 'progress'],
  coverageAnalysis: 'perTest',
  thresholds: { high: 90, low: 80, break: 80 },
  ignorePatterns: ['coverage', 'dist', '.stryker-tmp', '/reports'],
};
