import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';

import { textos } from '../i18n/textos';
import { Icono } from './Icono';

export interface VentanaProps {
  readonly titulo: string;
  readonly onCerrar: () => void;
  readonly children: ReactNode;
  /** Botones al pie (por ejemplo, Cancelar y Guardar). */
  readonly acciones?: ReactNode;
}

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Ventana modal accesible: nombra el diálogo por su título, atrapa el foco, se cierra con Escape o tocando
 *  fuera, y al cerrarse devuelve el foco a lo que lo tenía [RF-UX-08]. */
export function Ventana({ titulo, onCerrar, children, acciones }: VentanaProps): ReactElement {
  const idTitulo = useId();
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previo = document.activeElement;
    const primero = caja.current?.querySelector<HTMLElement>(ENFOCABLES);
    (primero ?? caja.current)?.focus();
    return () => {
      if (previo instanceof HTMLElement) {
        previo.focus();
      }
    };
  }, []);

  function alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      onCerrar();
      return;
    }
    if (evento.key !== 'Tab' || caja.current === null) {
      return;
    }
    const lista = [...caja.current.querySelectorAll<HTMLElement>(ENFOCABLES)];
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    if (primero === undefined || ultimo === undefined) {
      evento.preventDefault();
      return;
    }
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  return (
    <div
      className="ventana__fondo"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onCerrar();
        }
      }}
    >
      <div
        ref={caja}
        className="ventana anima-entrada"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onKeyDown={alTeclear}
      >
        <header className="ventana__cabecera">
          <h2 id={idTitulo} className="ventana__titulo">
            {titulo}
          </h2>
          <button
            type="button"
            className="ventana__cerrar"
            aria-label={textos.componentes.cerrar}
            onClick={onCerrar}
          >
            <Icono nombre="cerrar" />
          </button>
        </header>
        <div className="ventana__cuerpo">{children}</div>
        {acciones !== undefined ? <footer className="ventana__acciones">{acciones}</footer> : null}
      </div>
    </div>
  );
}
