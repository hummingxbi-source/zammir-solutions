import { useId } from 'react';
import type { ReactElement, ReactNode } from 'react';

export interface TarjetaProps {
  /** Rótulo corto en mayúsculas y monoespaciada, arriba de la tarjeta. */
  readonly rotulo?: string;
  /** Algo a la derecha del rótulo (por ejemplo, el botón de ayuda). */
  readonly acciones?: ReactNode;
  readonly variante?: 'blanca' | 'panel';
  readonly children: ReactNode;
}

/** Tarjeta de contenido: superficie blanca, borde finísimo y sombra suave [ADR-0028]. Con rótulo, la región
 *  se nombra por él para los lectores de pantalla. */
export function Tarjeta({
  rotulo,
  acciones,
  variante = 'blanca',
  children,
}: TarjetaProps): ReactElement {
  const id = useId();
  return (
    <section
      className={variante === 'panel' ? 'tarjeta tarjeta--panel' : 'tarjeta'}
      aria-labelledby={rotulo === undefined ? undefined : id}
    >
      {rotulo !== undefined || acciones !== undefined ? (
        <header className="tarjeta__cabecera">
          {rotulo !== undefined ? (
            <h2 id={id} className="rotulo tarjeta__rotulo">
              {rotulo}
            </h2>
          ) : (
            <span />
          )}
          {acciones}
        </header>
      ) : null}
      {children}
    </section>
  );
}
