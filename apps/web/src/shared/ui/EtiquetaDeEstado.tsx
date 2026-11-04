import type { ReactElement } from 'react';

export type TonoDeEstado =
  | 'espera'
  | 'proceso'
  | 'listo'
  | 'entregado'
  | 'cancelado'
  | 'neutro'
  | 'exito'
  | 'aviso'
  | 'peligro';

export interface EtiquetaDeEstadoProps {
  readonly tono: TonoDeEstado;
  /** Siempre lleva texto: el color solo acompaña, nunca es el único aviso [ADR-0028]. */
  readonly texto: string;
}

/** Etiqueta de estatus en forma de píldora: punto de color más texto en mayúsculas. */
export function EtiquetaDeEstado({ tono, texto }: EtiquetaDeEstadoProps): ReactElement {
  return (
    <span className={`etiqueta-estado etiqueta-estado--${tono}`}>
      <span className="etiqueta-estado__punto" aria-hidden="true" />
      {texto}
    </span>
  );
}
