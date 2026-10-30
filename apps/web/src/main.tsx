import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { App } from './App';
import { createComposition } from './composition';
import { ProveedorSesionAdmin } from './modules/identity/ui/SesionAdmin';
import { registerSW } from 'virtual:pwa-register';
import './shared/ui/estilos.css';

// Guarda la aplicación en la tablet para abrirla sin internet [RNF-01].
registerSW({ immediate: true });

const composition = createComposition({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

const root = document.getElementById('root');
if (root === null) {
  throw new Error('No existe el elemento #root en index.html');
}

createRoot(root).render(
  <StrictMode>
    <ProveedorSesionAdmin
      auth={composition.adminAuth}
      clock={composition.clock}
      cargarLimiteInactividad={composition.cargarLimiteInactividad}
    >
      <BrowserRouter>
        <App
          dispositivos={composition.dispositivos}
          cargarVigenciaDeCodigo={composition.cargarVigenciaDeCodigo}
        />
      </BrowserRouter>
    </ProveedorSesionAdmin>
  </StrictMode>,
);
