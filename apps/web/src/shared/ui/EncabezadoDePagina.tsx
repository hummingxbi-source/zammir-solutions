import type { ReactElement, ReactNode } from 'react';

export interface EncabezadoDePaginaProps {
  readonly titulo: string;
  readonly descripcion?: string;
  /** Rótulo pequeño arriba del título (por ejemplo, el folio o la sección). */
  readonly rotulo?: string;
  /** Botones a la derecha del título. */
  readonly acciones?: ReactNode;
}

/** Encabezado de cada pantalla: el único `h1` de la página, con descripción y acciones [ADR-0028]. */
export function EncabezadoDePagina({
  titulo,
  descripcion,
  rotulo,
  acciones,
}: EncabezadoDePaginaProps): ReactElement {
  return (
    <header className="pagina-encabezado">
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
