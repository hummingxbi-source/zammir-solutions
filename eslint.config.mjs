import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/dist/**', '**/coverage/**', '**/node_modules/**', 'docs/**']),

  // Archivos de configuración (JavaScript): sin información de tipos.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },

  // Todo el código TypeScript: estricto, sin `any` ni `!`, y con cero advertencias.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
    },
  },

  // El dominio es puro: no toca el navegador, la red ni la hora ni el azar del sistema.
  // La hora y los identificadores llegan por Clock e IdGenerator [00-principios §3.4].
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'El dominio no puede usar el navegador.' },
        { name: 'document', message: 'El dominio no puede usar el navegador.' },
        { name: 'localStorage', message: 'El dominio no puede guardar datos por su cuenta.' },
        { name: 'fetch', message: 'El dominio no puede usar la red.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Usa el puerto Clock.' },
        { object: 'Math', property: 'random', message: 'Usa el puerto IdGenerator.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Usa el puerto Clock en lugar de new Date().',
        },
      ],
    },
  },

  // Pruebas: prohibido saltarlas o aislarlas para que la integración continua pase.
  {
    files: ['**/*.{test,spec}.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'it', property: 'skip', message: 'Prohibido saltar pruebas.' },
        { object: 'it', property: 'only', message: 'Prohibido aislar pruebas.' },
        { object: 'test', property: 'skip', message: 'Prohibido saltar pruebas.' },
        { object: 'test', property: 'only', message: 'Prohibido aislar pruebas.' },
        { object: 'describe', property: 'skip', message: 'Prohibido saltar pruebas.' },
        { object: 'describe', property: 'only', message: 'Prohibido aislar pruebas.' },
      ],
    },
  },
);
