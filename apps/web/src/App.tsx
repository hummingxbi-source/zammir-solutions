import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import type {
  ActiveUserSession,
  DeviceRepository,
  ImportCatalogDeps,
  LegalDeps,
  ManageCustomersDeps,
  QuoteConditionsStore,
  RegisterTabletDeps,
  SignInWithPinDeps,
} from '@zammir/core';

import { Bitacora, type BitacoraProps } from './modules/audit/ui/Bitacora';
import { ImportarCatalogo } from './modules/catalog/ui/ImportarCatalogo';
import { Clientes } from './modules/customers/ui/Clientes';
import { CondicionesDeCotizacion } from './modules/quotes/ui/CondicionesDeCotizacion';
import { AvisoDePrivacidad } from './modules/legal/ui/AvisoDePrivacidad';
import { EntrarConPin } from './modules/identity/ui/EntrarConPin';
import { PersonaActiva } from './modules/identity/ui/PersonaActiva';
import { ConectarTablet } from './modules/devices/ui/ConectarTablet';
import {
  CotizadorEnLaTablet,
  type PrepararCotizador,
} from './modules/quotes/ui/CotizadorEnLaTablet';
import { OrdenesEnLaTablet, type PrepararOrdenes } from './modules/orders/ui/OrdenesEnLaTablet';
import { Dispositivos } from './modules/devices/ui/Dispositivos';
import { Usuarios, type UsuariosProps } from './modules/identity/ui/Usuarios';
import { ProtegidaAdmin } from './modules/identity/ui/ProtegidaAdmin';
import type { SincronizacionVisible } from './shell/IndicadorDeConexion';
import { Layout } from './shell/Layout';
import { PanelDeInicio, SeccionVacia } from './shell/Paginas';
import { seccionesVisibles, type Interruptor } from './shell/secciones';

export interface AppProps {
  /** Interruptores encendidos. Por defecto P1 y P2 están apagados. */
  readonly interruptores?: ReadonlySet<Interruptor>;
  /** Dispositivos registrados; sin esto la sección Usuarios queda vacía. */
  readonly dispositivos?: DeviceRepository | null;
  /** Personas del mostrador (alta, PIN, desactivar); sin esto no aparece esa parte de Usuarios. */
  readonly usuarios?: UsuariosProps | null;
  /** Clientes; por ahora solo con sesión de administrador (la persona con PIN llega con S1-15). */
  readonly clientes?: ManageCustomersDeps | null;
  /** Aviso de privacidad versionado; aparece en Configuración. */
  readonly legal?: LegalDeps | null;
  /** Condiciones que salen en cada cotización; aparecen en Configuración. */
  readonly condiciones?: QuoteConditionsStore | null;
  /** Bitácora consultable; aparece en Usuarios. */
  readonly bitacora?: BitacoraProps | null;
  /** Conexión de esta tablet con un código de registro; abre en `/conectar`. */
  readonly conectarTablet?: RegisterTabletDeps | null;
  /** Entrada con PIN en la tablet y quién está usándola; abre en `/entrar`. */
  readonly entradaConPin?: {
    readonly deps: SignInWithPinDeps;
    readonly session: ActiveUserSession;
  } | null;
  /** Importación del catálogo desde archivo; aparece en Catálogo (solo administradores). */
  readonly catalogo?: ImportCatalogDeps | null;
  /** Cotizador de la tablet: cómo reunir lo que necesita; sin esto la sección queda vacía. */
  readonly prepararCotizador?: PrepararCotizador | null;
  /** Órdenes de trabajo de la tablet: cómo reunir lo que necesita; sin esto la sección queda vacía. */
  readonly prepararOrdenes?: PrepararOrdenes | null;
  /** Estado del envío de lo guardado en la tablet ("N pendientes"). */
  readonly sincronizacion?: SincronizacionVisible | undefined;
  /** Vigencia sugerida del código de registro; sin ella la persona escribe los minutos. */
  readonly cargarVigenciaDeCodigo?: (() => Promise<number | null>) | undefined;
}

const SIN_INTERRUPTORES: ReadonlySet<Interruptor> = new Set();

export function App({
  interruptores = SIN_INTERRUPTORES,
  dispositivos = null,
  usuarios = null,
  clientes = null,
  legal = null,
  condiciones = null,
  bitacora = null,
  conectarTablet = null,
  entradaConPin = null,
  catalogo = null,
  sincronizacion,
  prepararCotizador = null,
  prepararOrdenes = null,
  cargarVigenciaDeCodigo,
}: AppProps): ReactElement {
  const secciones = [
    ...seccionesVisibles('principal', interruptores),
    ...seccionesVisibles('secundaria', interruptores),
  ];

  return (
    <Layout interruptores={interruptores} sincronizacion={sincronizacion}>
      {entradaConPin !== null ? <PersonaActiva session={entradaConPin.session} /> : null}
      <Routes>
        <Route
          index
          element={
            <PanelDeInicio
              interruptores={interruptores}
              conectar={conectarTablet !== null}
              entrar={entradaConPin !== null}
            />
          }
        />
        {entradaConPin !== null ? (
          <Route
            path="/entrar"
            element={<EntrarConPin deps={entradaConPin.deps} session={entradaConPin.session} />}
          />
        ) : null}
        {conectarTablet !== null ? (
          <Route path="/conectar" element={<ConectarTablet deps={conectarTablet} />} />
        ) : null}
        {secciones.map((seccion) => (
          <Route
            key={seccion.id}
            path={seccion.ruta}
            element={
              seccion.soloAdministrador === true ? (
                <ProtegidaAdmin>
                  {seccion.id === 'configuracion' && legal !== null ? (
                    <section>
                      <h1>{seccion.texto}</h1>
                      <AvisoDePrivacidad deps={legal} />
                      {condiciones !== null ? (
                        <CondicionesDeCotizacion store={condiciones} />
                      ) : null}
                    </section>
                  ) : seccion.id === 'usuarios' &&
                    (dispositivos !== null || usuarios !== null || bitacora !== null) ? (
                    <section>
                      <h1>{seccion.texto}</h1>
                      {usuarios !== null ? <Usuarios {...usuarios} /> : null}
                      {bitacora !== null ? <Bitacora {...bitacora} /> : null}
                      {dispositivos !== null ? (
                        <Dispositivos
                          dispositivos={dispositivos}
                          cargarVigenciaDeCodigo={cargarVigenciaDeCodigo}
                        />
                      ) : null}
                    </section>
                  ) : (
                    <SeccionVacia titulo={seccion.texto} />
                  )}
                </ProtegidaAdmin>
              ) : seccion.id === 'cotizador' &&
                prepararCotizador !== null &&
                entradaConPin !== null ? (
                <CotizadorEnLaTablet preparar={prepararCotizador} session={entradaConPin.session} />
              ) : seccion.id === 'ordenes' && prepararOrdenes !== null && entradaConPin !== null ? (
                <OrdenesEnLaTablet preparar={prepararOrdenes} session={entradaConPin.session} />
              ) : seccion.id === 'catalogo' && catalogo !== null ? (
                <ProtegidaAdmin>
                  <section>
                    <h1>{seccion.texto}</h1>
                    <ImportarCatalogo deps={catalogo} />
                  </section>
                </ProtegidaAdmin>
              ) : seccion.id === 'clientes' && clientes !== null ? (
                <ProtegidaAdmin>
                  <Clientes deps={clientes} />
                </ProtegidaAdmin>
              ) : (
                <SeccionVacia titulo={seccion.texto} />
              )
            }
          />
        ))}
        <Route
          path="*"
          element={
            <PanelDeInicio
              interruptores={interruptores}
              conectar={conectarTablet !== null}
              entrar={entradaConPin !== null}
            />
          }
        />
      </Routes>
    </Layout>
  );
}
