import type { ReactElement } from 'react';
import { Route, Routes, useParams } from 'react-router';
import type {
  ActiveUserSession,
  CustomerHistory,
  CustomerId,
  DeviceRepository,
  ImportCatalogDeps,
  LegalDeps,
  ManageCustomersDeps,
  QuoteConditionsStore,
  RegisterTabletDeps,
  SignInWithPinDeps,
  PortalConsulta,
  PortalDescarga,
  PortalSolicitud,
} from '@zammir/core';

import { Bitacora, type BitacoraProps } from './modules/audit/ui/Bitacora';
import { CatalogoDelAdministrador } from './modules/catalog/ui/Catalogo';
import { Clientes } from './modules/customers/ui/Clientes';
import { ResumenDelInicioEnLaTablet } from './modules/reports/ui/ResumenDelInicioEnLaTablet';
import { ReportesEnLaTablet, type PrepararReportes } from './modules/reports/ui/ReportesEnLaTablet';
import {
  CuentasEnLaTablet,
  type PrepararCuentas,
} from './modules/receivables/ui/CuentasEnLaTablet';
import { CondicionesDeCotizacion } from './modules/quotes/ui/CondicionesDeCotizacion';
import { AvisoDePrivacidad, TerminosDelServicio } from './modules/legal/ui/AvisoDePrivacidad';
import { PortalDeFactura } from './modules/billing/ui/PortalDeFactura';
import { PaginaLegalPublica, type ContactoPublico } from './modules/legal/ui/PaginaLegalPublica';
import { EntrarConPin } from './modules/identity/ui/EntrarConPin';
import { PersonaActiva } from './modules/identity/ui/PersonaActiva';
import { ConectarTablet } from './modules/devices/ui/ConectarTablet';
import {
  CotizadorEnLaTablet,
  type PrepararCotizador,
} from './modules/quotes/ui/CotizadorEnLaTablet';
import {
  MostradorEnLaTablet,
  type PrepararMostrador,
} from './modules/counter/ui/MostradorEnLaTablet';
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
  /** Portal público de autofacturación (`/factura` y `/f/:folio/:codigo`, la dirección del QR) [S4-18]. */
  readonly portal?: {
    readonly consultar: PortalConsulta;
    readonly solicitar: PortalSolicitud;
    readonly descargar: PortalDescarga;
    readonly siteKey?: string | null;
  } | null;
  /** Datos del negocio para el canal de derechos de las páginas públicas del aviso y los términos. */
  readonly contactoPublico?: (() => Promise<ContactoPublico | null>) | null;
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
  /** Mostrador de la tablet: cómo reunir lo que necesita; sin esto la sección queda vacía. */
  readonly prepararMostrador?: PrepararMostrador | null;
  /** Órdenes de trabajo de la tablet: cómo reunir lo que necesita; sin esto la sección queda vacía. */
  readonly prepararOrdenes?: PrepararOrdenes | null;
  /** Cuentas por cobrar de la tablet: cómo reunir lo que necesitan; sin esto la sección queda como antes. */
  readonly prepararCuentas?: PrepararCuentas | null;
  /** Reportes de la tablet: cómo reunir lo que necesitan; sin esto la sección queda como antes. */
  readonly prepararReportes?: PrepararReportes | null;
  /** Solo en desarrollo: página de muestras con datos de ejemplo (`/muestras`). */
  readonly muestras?: ReactElement | null;
  /** Historial de un cliente desde lo guardado en la tablet (ficha en Clientes). */
  readonly historialDeCliente?: ((id: CustomerId) => Promise<CustomerHistory>) | null;
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
  contactoPublico = null,
  portal = null,
  condiciones = null,
  bitacora = null,
  conectarTablet = null,
  entradaConPin = null,
  catalogo = null,
  sincronizacion,
  prepararCotizador = null,
  prepararOrdenes = null,
  prepararCuentas = null,
  prepararReportes = null,
  muestras = null,
  historialDeCliente = null,
  prepararMostrador = null,
  cargarVigenciaDeCodigo,
}: AppProps): ReactElement {
  const secciones = [
    ...seccionesVisibles('principal', interruptores),
    ...seccionesVisibles('secundaria', interruptores),
  ];

  const marco = (
    <Layout
      interruptores={interruptores}
      sincronizacion={sincronizacion}
      session={entradaConPin?.session}
    >
      {entradaConPin !== null ? <PersonaActiva session={entradaConPin.session} /> : null}
      <Routes>
        <Route
          index
          element={
            <PanelDeInicio
              interruptores={interruptores}
              conectar={conectarTablet !== null}
              entrar={entradaConPin !== null}
              resumen={
                prepararReportes !== null && entradaConPin !== null ? (
                  <ResumenDelInicioEnLaTablet
                    preparar={prepararReportes}
                    session={entradaConPin.session}
                  />
                ) : null
              }
            />
          }
        />
        {entradaConPin !== null ? (
          <Route
            path="/entrar"
            element={<EntrarConPin deps={entradaConPin.deps} session={entradaConPin.session} />}
          />
        ) : null}
        {muestras !== null ? <Route path="/muestras/*" element={muestras} /> : null}
        {conectarTablet !== null ? (
          <Route path="/conectar" element={<ConectarTablet deps={conectarTablet} />} />
        ) : null}
        {secciones.map((seccion) => (
          <Route
            key={seccion.id}
            path={seccion.ruta}
            element={
              seccion.id === 'reportes' && prepararReportes !== null && entradaConPin !== null ? (
                <ReportesEnLaTablet preparar={prepararReportes} session={entradaConPin.session} />
              ) : seccion.id === 'cuentas-por-cobrar' &&
                prepararCuentas !== null &&
                entradaConPin !== null ? (
                <CuentasEnLaTablet preparar={prepararCuentas} session={entradaConPin.session} />
              ) : seccion.soloAdministrador === true ? (
                <ProtegidaAdmin>
                  {seccion.id === 'configuracion' && legal !== null ? (
                    <section>
                      <h1>{seccion.texto}</h1>
                      <AvisoDePrivacidad deps={legal} />
                      <TerminosDelServicio deps={legal} />
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
              ) : seccion.id === 'mostrador' &&
                prepararMostrador !== null &&
                entradaConPin !== null ? (
                <MostradorEnLaTablet preparar={prepararMostrador} session={entradaConPin.session} />
              ) : seccion.id === 'ordenes' && prepararOrdenes !== null && entradaConPin !== null ? (
                <OrdenesEnLaTablet preparar={prepararOrdenes} session={entradaConPin.session} />
              ) : seccion.id === 'catalogo' && catalogo !== null ? (
                <ProtegidaAdmin>
                  <CatalogoDelAdministrador deps={catalogo} />
                </ProtegidaAdmin>
              ) : seccion.id === 'clientes' && clientes !== null ? (
                <ProtegidaAdmin>
                  <Clientes
                    deps={clientes}
                    {...(historialDeCliente === null ? {} : { historial: historialDeCliente })}
                  />
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
              resumen={
                prepararReportes !== null && entradaConPin !== null ? (
                  <ResumenDelInicioEnLaTablet
                    preparar={prepararReportes}
                    session={entradaConPin.session}
                  />
                ) : null
              }
            />
          }
        />
      </Routes>
    </Layout>
  );

  const sinContacto = (): Promise<ContactoPublico | null> => Promise.resolve(null);
  return (
    <Routes>
      {portal !== null ? (
        <>
          <Route
            path="/factura"
            element={<PortalDeFactura {...portal} siteKey={portal.siteKey ?? null} />}
          />
          <Route
            path="/f/:folio/:codigo"
            element={<PortalPorQr {...portal} siteKey={portal.siteKey ?? null} />}
          />
        </>
      ) : null}
      {legal !== null ? (
        <>
          <Route
            path="/aviso"
            element={
              <PaginaLegalPublica
                deps={legal}
                tipo="PRIVACY_NOTICE"
                cargarContacto={contactoPublico ?? sinContacto}
              />
            }
          />
          <Route
            path="/terminos"
            element={
              <PaginaLegalPublica
                deps={legal}
                tipo="TERMS"
                cargarContacto={contactoPublico ?? sinContacto}
              />
            }
          />
        </>
      ) : null}
      <Route path="*" element={marco} />
    </Routes>
  );
}

/** Entrada por el QR del ticket: el folio y el código vienen en la dirección y se le ponen a la persona. */
function PortalPorQr({
  consultar,
  solicitar,
  descargar,
  siteKey,
}: {
  readonly consultar: PortalConsulta;
  readonly solicitar: PortalSolicitud;
  readonly descargar: PortalDescarga;
  readonly siteKey: string | null;
}): ReactElement {
  const { folio = '', codigo = '' } = useParams();
  return (
    <PortalDeFactura
      consultar={consultar}
      solicitar={solicitar}
      descargar={descargar}
      siteKey={siteKey}
      inicial={{ folio, code: codigo }}
    />
  );
}
