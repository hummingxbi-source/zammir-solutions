import type { ReactElement } from 'react';
import { Link, Route, Routes } from 'react-router';

import { EncabezadoDePagina } from '../shared/ui/EncabezadoDePagina';
import { MuestraDelCotizador } from './MuestraDelCotizador';
import { MuestraDelMostrador } from './MuestraDelMostrador';

/** Índice de muestras SOLO para desarrollo (`/muestras`): pantallas armadas con datos de ejemplo en memoria,
 *  para revisar cómo se ven sin registrar una tablet. No existe en la versión que se instala. */
export function Muestras(): ReactElement {
  return (
    <Routes>
      <Route path="mostrador" element={<MuestraDelMostrador />} />
      <Route path="cotizador" element={<MuestraDelCotizador />} />
      <Route
        index
        element={
          <section>
            <EncabezadoDePagina
              titulo="Muestras"
              descripcion="Pantallas con datos de ejemplo, solo en desarrollo."
            />
            <ul>
              <li>
                <Link to="mostrador">Mostrador</Link>
              </li>
              <li>
                <Link to="cotizador">Cotizador</Link>
              </li>
            </ul>
          </section>
        }
      />
    </Routes>
  );
}
