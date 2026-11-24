import { defineConfig } from '@playwright/test';

const PUERTO = 4173;

// Tamaño de tablet PROVISIONAL hasta definir el modelo (PD-16): 1280 × 800 y 800 × 1280.
export default defineConfig({
  testDir: 'apps/web/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${String(PUERTO)}`,
    // El recorrido guiado arranca solo la primera vez y oscurece la pantalla: si aparece a media prueba, las
    // revisiones de contraste y de foco miden el velo. Se marca como visto; sus pruebas están en recorrido.test.tsx.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://localhost:${String(PUERTO)}`,
          localStorage: [{ name: 'zammir.recorrido-visto', value: '1' }],
        },
      ],
    },
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
  },
  projects: [
    {
      name: 'tablet-horizontal',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'tablet-vertical',
      use: { browserName: 'chromium', viewport: { width: 800, height: 1280 } },
    },
  ],
  webServer: {
    command: `pnpm --filter @zammir/web build && pnpm --filter @zammir/web exec vite preview --port ${String(PUERTO)} --strictPort`,
    url: `http://localhost:${String(PUERTO)}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
