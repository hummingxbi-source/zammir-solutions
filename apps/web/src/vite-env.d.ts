/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Variables de entorno del navegador que usa ZAMMIR (documentadas en .env.example).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
