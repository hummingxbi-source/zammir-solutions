import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { createErrorReporter } from '@zammir/core';

import { App } from './App';
import { Muestras } from './dev/Muestras';
import { createComposition } from './composition';
import { ProveedorSesionAdmin } from './modules/identity/ui/SesionAdmin';
import { envioDeErrores, instalarCapturaDeErrores } from './shared/infra/envio-de-errores';
import { LimiteDeErrores } from './shared/ui/LimiteDeErrores';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/source-serif-4/latin-400.css';
import '@fontsource/source-serif-4/latin-600.css';
import './shared/ui/tokens.css';
import './shared/ui/estilos.css';
import './shared/ui/componentes.css';
import './shared/ui/graficas.css';

// Guarda la aplicación en la tablet para abrirla sin internet [RNF-01].
registerSW({ immediate: true });

// Errores sin datos personales: se limpian en el navegador y otra vez en el servidor [RNF-34, S4-28].
const reportero = createErrorReporter({
  source: 'CLIENT',
  appVersion: import.meta.env.VITE_APP_VERSION ?? 'desarrollo',
  send: envioDeErrores({
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  }),
});
instalarCapturaDeErrores(reportero, window);

const composition = createComposition({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
});

// Pone al día el catálogo guardado en la tablet al abrir y cada vez que vuelve la conexión.
function ponerAlDia(): void {
  void composition.envio?.engine.trigger();
  void composition.envio?.actualizarClientes();
  void composition.envio?.actualizarDocumentos();
  void composition.envio?.subirFotos();
  void composition.catalogoLocal?.actualizar();
  void composition.entradaConPin?.actualizar();
}
ponerAlDia();
window.addEventListener('online', ponerAlDia);

const root = document.getElementById('root');
if (root === null) {
  throw new Error('No existe el elemento #root en index.html');
}

createRoot(root).render(
  <StrictMode>
    <LimiteDeErrores
      alError={(error) => {
        void reportero.report(error, window.location.pathname);
      }}
    >
      <ProveedorSesionAdmin
        auth={composition.adminAuth}
        clock={composition.clock}
        cargarLimiteInactividad={composition.cargarLimiteInactividad}
      >
        <BrowserRouter>
          <App
            dispositivos={composition.dispositivos}
            clientes={composition.clientes}
            legal={composition.legal}
            contactoPublico={composition.contactoPublico}
            facturas={composition.facturas}
            exportacion={composition.exportacionDeDatos}
            compartirFacturas={composition.compartirFacturas}
            portal={composition.portal}
            condiciones={composition.condiciones}
            conectarTablet={composition.conectarTablet}
            entradaConPin={composition.entradaConPin}
            prepararCotizador={composition.prepararCotizador}
            prepararOrdenes={composition.prepararOrdenes}
            prepararCuentas={composition.prepararCuentas}
            prepararReportes={composition.prepararReportes}
            muestras={import.meta.env.DEV ? <Muestras /> : null}
            historialDeCliente={composition.historialDeCliente}
            prepararMostrador={composition.prepararMostrador}
            sincronizacion={composition.envio?.visible}
            catalogo={composition.catalogo}
            bitacora={
              composition.bitacora === null
                ? null
                : { reader: composition.bitacora, cargarNombres: composition.cargarNombres }
            }
            usuarios={
              composition.usuarios === null
                ? null
                : {
                    deps: composition.usuarios,
                    cargarPolitica: composition.cargarPoliticaDeUsuarios,
                  }
            }
            cargarVigenciaDeCodigo={composition.cargarVigenciaDeCodigo}
          />
        </BrowserRouter>
      </ProveedorSesionAdmin>
    </LimiteDeErrores>
  </StrictMode>,
);
