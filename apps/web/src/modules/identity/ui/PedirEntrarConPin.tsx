import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router';

import { Icono } from '../../../shared/ui/Icono';

/** El botón principal de las pantallas que necesitan saber quién usa la tablet: lleva a la entrada con PIN. */
export function PedirEntrarConPin({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <div className="acceso-acciones acceso-acciones--sola">
      <Link to="/entrar" className="boton">
        <Icono nombre="usuarios" />
        {children}
      </Link>
    </div>
  );
}
