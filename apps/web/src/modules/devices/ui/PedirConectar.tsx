import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router';

import { Icono } from '../../../shared/ui/Icono';

/** El botón principal de las pantallas que necesitan que la tablet esté conectada: lleva a conectarla. */
export function PedirConectar({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <div className="acceso-acciones acceso-acciones--sola">
      <Link to="/conectar" className="boton">
        <Icono nombre="nube" />
        {children}
      </Link>
    </div>
  );
}
