import type { ReactElement, ReactNode } from 'react';

import { Icono, type NombreDeIcono } from './Icono';

export interface EstadoVacioProps {
  readonly titulo: string;
  /** Qué hacer para llenar este lugar: nunca datos de relleno [RN-23, RF-UX-07]. */
  readonly descripcion: string;
  readonly icono?: NombreDeIcono;
  /** Acción principal (un botón o enlace). */
  readonly children?: ReactNode;
}

/** Lugar sin contenido todavía: dice qué es, por qué está vacío y qué hacer. */
export function EstadoVacio({
  titulo,
  descripcion,
  icono = 'vacio',
  children,
}: EstadoVacioProps): ReactElement {
  return (
    <div className="estado-vacio">
      <span className="estado-vacio__icono">
        <Icono nombre={icono} tamano={32} />
      </span>
      <p className="estado-vacio__titulo">{titulo}</p>
      <p className="estado-vacio__descripcion">{descripcion}</p>
      {children !== undefined ? <div className="estado-vacio__accion">{children}</div> : null}
    </div>
  );
}
