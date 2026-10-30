import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import type { DeviceRepository } from '@zammir/core';

import { Dispositivos } from './modules/devices/ui/Dispositivos';
import { ProtegidaAdmin } from './modules/identity/ui/ProtegidaAdmin';
import { Layout } from './shell/Layout';
import { PanelDeInicio, SeccionVacia } from './shell/Paginas';
import { seccionesVisibles, type Interruptor } from './shell/secciones';

export interface AppProps {
  /** Interruptores encendidos. Por defecto P1 y P2 están apagados. */
  readonly interruptores?: ReadonlySet<Interruptor>;
  /** Dispositivos registrados; sin esto la sección Usuarios queda vacía. */
  readonly dispositivos?: DeviceRepository | null;
}

const SIN_INTERRUPTORES: ReadonlySet<Interruptor> = new Set();

export function App({
  interruptores = SIN_INTERRUPTORES,
  dispositivos = null,
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
                  {seccion.id === 'usuarios' && dispositivos !== null ? (
                    <section>
                      <h1>{seccion.texto}</h1>
                      <Dispositivos dispositivos={dispositivos} />
                    </section>
                  ) : (
                    <SeccionVacia titulo={seccion.texto} />
                  )}
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
