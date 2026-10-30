import { useId } from 'react';
import type { ComponentPropsWithoutRef, ReactElement } from 'react';

export interface OpcionDeSeleccion {
  readonly valor: string;
  readonly texto: string;
}

export interface SeleccionProps extends Omit<
  ComponentPropsWithoutRef<'select'>,
  'id' | 'className' | 'children'
> {
  readonly etiqueta: string;
  readonly opciones: readonly OpcionDeSeleccion[];
}

/** Lista desplegable con etiqueta ligada, del mismo tamaño táctil que los campos de texto. */
export function Seleccion({ etiqueta, opciones, ...resto }: SeleccionProps): ReactElement {
  const id = useId();
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <select {...resto} id={id} className="campo__entrada">
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </div>
  );
}
