import type { ReactElement, ReactNode } from 'react';

export type TipoAviso = 'error' | 'exito';

export interface AvisoProps {
  readonly tipo: TipoAviso;
  readonly children: ReactNode;
  /** Siempre que sea un error: qué debe hacer la persona para resolverlo. */
  readonly queHacer?: string;
}

/** Mensaje al usuario con lenguaje del oficio. Los errores dicen qué hacer [RF-UX-08]. */
export function Aviso({ tipo, children, queHacer }: AvisoProps): ReactElement {
  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`aviso aviso--${tipo} anima-entrada`}
    >
      <div>{children}</div>
      {queHacer !== undefined ? <p className="aviso__que-hacer">{queHacer}</p> : null}
    </div>
  );
}
