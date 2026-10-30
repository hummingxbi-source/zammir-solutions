import type { ComponentPropsWithoutRef, ReactElement } from 'react';

export type VarianteBoton = 'primario' | 'secundario' | 'peligro';

export interface BotonProps extends ComponentPropsWithoutRef<'button'> {
  readonly variante?: VarianteBoton;
}

const CLASE_POR_VARIANTE: Record<VarianteBoton, string> = {
  primario: 'boton',
  secundario: 'boton boton--secundario',
  peligro: 'boton boton--peligro',
};

/** Botón grande para uso táctil (al menos 44 px). */
export function Boton({
  variante = 'primario',
  type = 'button',
  ...resto
}: BotonProps): ReactElement {
  return <button {...resto} type={type} className={CLASE_POR_VARIANTE[variante]} />;
}
