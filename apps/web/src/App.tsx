import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import type { DeviceRepository, ManageCustomersDeps } from '@zammir/core';

import { Clientes } from './modules/customers/ui/Clientes';
import { Dispositivos } from './modules/devices/ui/Dispositivos';
import { Usuarios, type UsuariosProps } from './modules/identity/ui/Usuarios';
import { ProtegidaAdmin } from './modules/identity/ui/ProtegidaAdmin';
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
  /** Vigencia sugerida del código de registro; sin ella la persona escribe los minutos. */
  readonly cargarVigenciaDeCodigo?: (() => Promise<number | null>) | undefined;
}

const SIN_INTERRUPTORES: ReadonlySet<Interruptor> = new Set();

export function App({
  interruptores = SIN_INTERRUPTORES,
  dispositivos = null,
  usuarios = null,
  clientes = null,
  cargarVigenciaDeCodigo,
}: AppProps): ReactElement {
  const secciones = [
    ...seccionesVisibles('principal', interruptores),
    ...seccionesVisibles('secundaria', interruptores),
  ];

  return (
    <Layout interruptores={interruptores}>
      <Routes>
        <Route index element={<PanelDeInicio interruptores={interruptores} />} />
        {secciones.map((seccion) => (
          <Route
            key={seccion.id}
            path={seccion.ruta}
            element={
              seccion.soloAdministrador === true ? (
                <ProtegidaAdmin>
                  {seccion.id === 'usuarios' && (dispositivos !== null || usuarios !== null) ? (
                    <section>
                      <h1>{seccion.texto}</h1>
                      {usuarios !== null ? <Usuarios {...usuarios} /> : null}
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
        <Route path="*" element={<PanelDeInicio interruptores={interruptores} />} />
      </Routes>
    </Layout>
  );
}
