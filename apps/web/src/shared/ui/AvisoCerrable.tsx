import { useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { textos } from '../i18n/textos';
import { Icono } from './Icono';

export interface AvisoCerrableProps {
  /** Identifica el aviso para recordar que ya se cerró en esta sesión. */
  readonly id: string;
  readonly tono?: 'info' | 'aviso';
  readonly children: ReactNode;
  /** Acción sugerida, como enlace-botón al final del texto (por ejemplo "Ir al Catálogo →"). */
  readonly accion?: { readonly texto: string; readonly alTocar: () => void };
}

const CLAVE = (id: string): string => `zammir_aviso_${id}`;

function yaCerrado(id: string): boolean {
  try {
    return window.sessionStorage.getItem(CLAVE(id)) === 'true';
  } catch {
    return false;
  }
}

/** Aviso contextual que se puede cerrar, para cuando una sección depende de otra [RF-UX-05]. Una vez
 *  cerrado no vuelve a aparecer en la sesión. Sin almacenamiento disponible simplemente reaparece. */
export function AvisoCerrable({
  id,
  tono = 'info',
  children,
  accion,
}: AvisoCerrableProps): ReactElement | null {
  const [cerrado, setCerrado] = useState(() => yaCerrado(id));
  if (cerrado) {
    return null;
  }
  return (
    <div className={`aviso-cerrable aviso-cerrable--${tono} anima-entrada`} role="status">
      <span className="aviso-cerrable__icono">
        <Icono nombre={tono === 'aviso' ? 'advertencia' : 'informacion'} />
      </span>
      <p className="aviso-cerrable__texto">
        {children}
        {accion !== undefined ? (
          <>
            {' '}
            <button type="button" className="aviso-cerrable__accion" onClick={accion.alTocar}>
              {accion.texto}
            </button>
          </>
        ) : null}
      </p>
      <button
        type="button"
        className="aviso-cerrable__cerrar"
        aria-label={textos.componentes.cerrarAviso}
        onClick={() => {
          try {
            window.sessionStorage.setItem(CLAVE(id), 'true');
          } catch {
            // Sin almacenamiento: se cierra solo hasta recargar.
          }
          setCerrado(true);
        }}
      >
        <Icono nombre="cerrar" tamano={18} />
      </button>
    </div>
  );
}
