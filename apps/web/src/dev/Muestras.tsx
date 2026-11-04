import type { ReactElement } from 'react';
import { Link, Route, Routes } from 'react-router';

import { EncabezadoDePagina } from '../shared/ui/EncabezadoDePagina';
import { MuestraDeOrdenes } from './MuestraDeOrdenes';
import { MuestraDeCuentas, MuestraDeReportes } from './MuestraDeReportes';
import { MuestraDelInicio } from './MuestraDelInicio';
import { MuestraDelCatalogo } from './MuestraDelCatalogo';
import { MuestraDelCotizador } from './MuestraDelCotizador';
import { MuestraDelMostrador } from './MuestraDelMostrador';

/** Índice de muestras SOLO para desarrollo (`/muestras`): pantallas armadas con datos de ejemplo en memoria,
 *  para revisar cómo se ven sin registrar una tablet. No existe en la versión que se instala. */
export function Muestras(): ReactElement {
  return (
    <Routes>
      <Route path="mostrador" element={<MuestraDelMostrador />} />
      <Route path="cotizador" element={<MuestraDelCotizador />} />
      <Route path="ordenes" element={<MuestraDeOrdenes />} />
      <Route path="reportes" element={<MuestraDeReportes />} />
      <Route path="cuentas" element={<MuestraDeCuentas />} />
      <Route path="catalogo" element={<MuestraDelCatalogo />} />
      <Route path="inicio" element={<MuestraDelInicio />} />
      <Route path="inicio-cajero" element={<MuestraDelInicio comoCajero />} />
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
              <li>
                <Link to="ordenes">Órdenes</Link>
              </li>
              <li>
                <Link to="reportes">Reportes</Link>
              </li>
              <li>
                <Link to="cuentas">Cuentas por cobrar</Link>
              </li>
              <li>
                <Link to="catalogo">Catálogo</Link>
              </li>
              <li>
                <Link to="inicio">Inicio (administrador)</Link>
              </li>
              <li>
                <Link to="inicio-cajero">Inicio (cajero)</Link>
              </li>
            </ul>
          </section>
        }
      />
    </Routes>
  );
}
