import { useContext } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { ContextoDeSeccion } from './ContextoDeSeccion';
import { IlustracionDeSeccion, tieneIlustracion } from './IlustracionDeSeccion';

export interface EncabezadoDePaginaProps {
  readonly titulo: string;
  readonly descripcion?: string;
  /** Rótulo pequeño arriba del título (por ejemplo, el folio o la sección). */
  readonly rotulo?: string;
  /** Botones a la derecha del título. */
  readonly acciones?: ReactNode;
  /** Sin la ilustración de la sección: para vistas de detalle y editores, donde el espacio es de la tarea. */
  readonly sinIlustracion?: boolean;
}

/** Encabezado de cada pantalla: el único `h1` de la página, con descripción y acciones. En las secciones del
 *  menú lleva la ilustración de vidrio de esa sección [ADR-0028, ADR-0037]. */
export function EncabezadoDePagina({
  titulo,
  descripcion,
  rotulo,
  acciones,
  sinIlustracion = false,
}: EncabezadoDePaginaProps): ReactElement {
  const seccion = useContext(ContextoDeSeccion);
  const ilustrada = !sinIlustracion && tieneIlustracion(seccion);
  return (
    <header className={`pagina-encabezado${ilustrada ? ' pagina-encabezado--ilustrado' : ''}`}>
      {ilustrada ? (
        <IlustracionDeSeccion seccion={seccion} className="pagina-encabezado__ilustracion" />
      ) : null}
      <div className="pagina-encabezado__texto">
        {rotulo !== undefined ? <p className="rotulo pagina-encabezado__rotulo">{rotulo}</p> : null}
        <h1 className="pagina-encabezado__titulo">{titulo}</h1>
        {descripcion !== undefined ? (
          <p className="pagina-encabezado__descripcion">{descripcion}</p>
        ) : null}
      </div>
      {acciones !== undefined ? (
        <div className="pagina-encabezado__acciones">{acciones}</div>
      ) : null}
    </header>
  );
}
