import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';

import { ProtegidaAdmin } from './modules/identity/ui/ProtegidaAdmin';
import { Layout } from './shell/Layout';
import { PanelDeInicio, SeccionVacia } from './shell/Paginas';
import { seccionesVisibles, type Interruptor } from './shell/secciones';

export interface AppProps {
  /** Interruptores encendidos. Por defecto P1 y P2 están apagados. */
  readonly interruptores?: ReadonlySet<Interruptor>;
}

const SIN_INTERRUPTORES: ReadonlySet<Interruptor> = new Set();

export function App({ interruptores = SIN_INTERRUPTORES }: AppProps): ReactElement {
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
                  <SeccionVacia titulo={seccion.texto} />
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
