import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import { App } from './App';
import { Muestras } from './dev/Muestras';
import { createComposition } from './composition';
import { ProveedorSesionAdmin } from './modules/identity/ui/SesionAdmin';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/fraunces/latin-400.css';
import '@fontsource/fraunces/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/source-serif-4/latin-400.css';
import '@fontsource/source-serif-4/latin-600.css';
import './shared/ui/tokens.css';
import './shared/ui/estilos.css';
import './shared/ui/componentes.css';

// Guarda la aplicación en la tablet para abrirla sin internet [RNF-01].
registerSW({ immediate: true });

const composition = createComposition({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
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
  </StrictMode>,
);
