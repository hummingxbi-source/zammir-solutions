import { useEffect, useId, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { textos } from '../i18n/textos';
import { Icono } from './Icono';

export interface AyudaProps {
  /** De qué trata la ayuda; nombra el botón para los lectores de pantalla. */
  readonly tema: string;
  readonly children: ReactNode;
}

/** Ayuda contextual que se abre con un toque o con el teclado (no depende del cursor, que la tablet no
 *  tiene). Se cierra con Escape, con otro toque fuera o con el mismo botón. */
export function Ayuda({ tema, children }: AyudaProps): ReactElement {
  const [abierta, setAbierta] = useState(false);
  const idTexto = useId();
  const raiz = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!abierta) {
      return;
    }
    const fuera = (e: PointerEvent): void => {
      if (raiz.current !== null && e.target instanceof Node && !raiz.current.contains(e.target)) {
        setAbierta(false);
      }
    };
    const tecla = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setAbierta(false);
      }
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierta]);

  return (
    <span ref={raiz} className="ayuda">
      <button
        type="button"
        className="ayuda__boton"
        aria-expanded={abierta}
        aria-controls={abierta ? idTexto : undefined}
        aria-label={`${textos.componentes.ayudaSobre} ${tema}`}
        onClick={() => {
          setAbierta((a) => !a);
        }}
      >
        <Icono nombre="ayuda" tamano={18} />
      </button>
      {abierta ? (
        <span id={idTexto} role="note" className="ayuda__texto anima-entrada">
          {children}
        </span>
      ) : null}
    </span>
  );
}
