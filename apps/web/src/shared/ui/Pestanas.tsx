import { useRef } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';

export interface Pestana {
  readonly id: string;
  readonly texto: string;
  /** Id del panel que controla (para `aria-controls`). */
  readonly panelId?: string;
}

export interface PestanasProps {
  readonly etiqueta: string;
  readonly pestanas: readonly Pestana[];
  readonly activa: string;
  readonly onCambiar: (id: string) => void;
}

/** Pestañas accesibles: flechas, inicio y fin mueven la selección y el foco [patrón WAI-ARIA de pestañas]. */
export function Pestanas({ etiqueta, pestanas, activa, onCambiar }: PestanasProps): ReactElement {
  const botones = useRef<Map<string, HTMLButtonElement>>(new Map());

  function mover(evento: KeyboardEvent, indice: number): void {
    const ultimo = pestanas.length - 1;
    let destino: number | null = null;
    if (evento.key === 'ArrowRight') {
      destino = indice === ultimo ? 0 : indice + 1;
    } else if (evento.key === 'ArrowLeft') {
      destino = indice === 0 ? ultimo : indice - 1;
    } else if (evento.key === 'Home') {
      destino = 0;
    } else if (evento.key === 'End') {
      destino = ultimo;
    }
    const siguiente = destino === null ? undefined : pestanas[destino];
    if (siguiente !== undefined) {
      evento.preventDefault();
      onCambiar(siguiente.id);
      botones.current.get(siguiente.id)?.focus();
    }
  }

  return (
    <div className="segmentos" role="tablist" aria-label={etiqueta}>
      {pestanas.map((p, indice) => {
        const seleccionada = p.id === activa;
        return (
          <button
            key={p.id}
            ref={(el) => {
              if (el === null) {
                botones.current.delete(p.id);
              } else {
                botones.current.set(p.id, el);
              }
            }}
            id={`pestana-${p.id}`}
            type="button"
            role="tab"
            className="segmento"
            aria-selected={seleccionada}
            aria-controls={p.panelId}
            tabIndex={seleccionada ? 0 : -1}
            onClick={() => {
              onCambiar(p.id);
            }}
            onKeyDown={(e) => {
              mover(e, indice);
            }}
          >
            {p.texto}
          </button>
        );
      })}
    </div>
  );
}
