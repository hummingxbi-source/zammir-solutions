import type { ComponentPropsWithoutRef, ReactElement } from 'react';

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'peligro-suave';

export interface BotonProps extends ComponentPropsWithoutRef<'button'> {
  readonly variante?: VarianteBoton;
}

const CLASE_POR_VARIANTE: Record<VarianteBoton, string> = {
  primario: 'boton',
  secundario: 'boton boton--secundario',
  peligro: 'boton boton--peligro',
  // Una acción destructiva que se repite en cada renglón: contorno rojo, sin el peso de un botón lleno.
  'peligro-suave': 'boton boton--secundario boton--peligro-suave',
};

/** Botón grande para uso táctil (al menos 44 px). */
export function Boton({
  variante = 'primario',
  type = 'button',
  ...resto
}: BotonProps): ReactElement {
  return <button {...resto} type={type} className={CLASE_POR_VARIANTE[variante]} />;
}
