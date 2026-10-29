import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// PWA instalable que abre sin internet [RNF-01, RNF-02, ADR-0003, ADR-0008].
// La aplicación se guarda en la tablet la primera vez que se abre con internet.
export default defineConfig({
  // Las variables VITE_* se leen del .env de la raíz del repositorio (ver .env.example).
  envDir: '../..',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icono-192.png', 'icono-512.png'],
      manifest: {
        id: '/',
        name: 'ZAMMIR',
        short_name: 'ZAMMIR',
        description: 'Cotizador, órdenes de trabajo y mostrador de ZAMMIR',
        lang: 'es-MX',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#1f3a5f',
        background_color: '#f6f1e9',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icono-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        // Cualquier ruta de la aplicación abre la misma página, también sin internet.
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
