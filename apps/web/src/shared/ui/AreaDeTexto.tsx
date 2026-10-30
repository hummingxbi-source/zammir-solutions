import { useId } from 'react';
import type { ComponentPropsWithoutRef, ReactElement } from 'react';

export interface AreaDeTextoProps extends Omit<
  ComponentPropsWithoutRef<'textarea'>,
  'id' | 'className'
> {
  readonly etiqueta: string;
}

/** Texto de varias líneas con etiqueta ligada, con el mismo tamaño táctil que los demás campos. */
export function AreaDeTexto({ etiqueta, rows = 8, ...resto }: AreaDeTextoProps): ReactElement {
  const id = useId();
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <textarea {...resto} id={id} rows={rows} className="campo__entrada" />
    </div>
  );
}
