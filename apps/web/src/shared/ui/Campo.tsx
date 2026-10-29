import { useId } from 'react';
import type { ComponentPropsWithoutRef, ReactElement } from 'react';

export interface CampoProps extends Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'className'> {
  readonly etiqueta: string;
  /** Mensaje de error que dice qué hacer, no solo qué falló. */
  readonly error?: string;
}

/** Campo de texto con etiqueta y mensaje de error ligados para lectores de pantalla. */
export function Campo({ etiqueta, error, ...entrada }: CampoProps): ReactElement {
  const id = useId();
  const idError = `${id}-error`;
  const conError = error !== undefined && error !== '';

  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <input
        {...entrada}
        id={id}
        className="campo__entrada"
        aria-invalid={conError}
        aria-describedby={conError ? idError : undefined}
      />
      {conError ? (
        <span id={idError} className="campo__error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export interface CampoNumericoProps extends Omit<CampoProps, 'type' | 'inputMode'> {
  /** Solo números enteros (cantidades, PIN). Si no, admite punto decimal (medidas, montos). */
  readonly entero?: boolean;
}

/** Campo que abre el teclado numérico del dispositivo. */
export function CampoNumerico({ entero = false, ...resto }: CampoNumericoProps): ReactElement {
  return (
    <Campo {...resto} type="text" inputMode={entero ? 'numeric' : 'decimal'} autoComplete="off" />
  );
}
