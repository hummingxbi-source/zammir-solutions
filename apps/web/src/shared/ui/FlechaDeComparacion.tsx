import type { ReactElement } from 'react';

import { Icono } from './Icono';

export type Tendencia = 'UP' | 'DOWN' | 'SAME' | 'NO_BASELINE';

export interface FlechaDeComparacionProps {
  readonly tendencia: Tendencia;
  /** Ya redactado, por ejemplo "Sube 12.50 %" o "Sin ventas en el periodo anterior para comparar". */
  readonly texto: string;
  /** Qué dirección es buena: en ventas, subir; en gastos, bajar. */
  readonly buena?: 'sube' | 'baja';
}

/** Cambio contra el periodo anterior: flecha de color **y** texto, nunca solo color [ADR-0028]. Sin periodo
 *  anterior no hay flecha, solo el texto. */
export function FlechaDeComparacion({
  tendencia,
  texto,
  buena = 'sube',
}: FlechaDeComparacionProps): ReactElement {
  const favorable =
    (tendencia === 'UP' && buena === 'sube') || (tendencia === 'DOWN' && buena === 'baja');
  const desfavorable = (tendencia === 'UP' || tendencia === 'DOWN') && !favorable;
  const tono = favorable ? 'exito' : desfavorable ? 'peligro' : 'neutro';
  return (
    <span className={`comparacion comparacion--${tono}`}>
      {tendencia === 'NO_BASELINE' ? null : (
        <Icono
          nombre={
            tendencia === 'UP' ? 'flechaArriba' : tendencia === 'DOWN' ? 'flechaAbajo' : 'igual'
          }
          tamano={16}
        />
      )}
      {texto}
    </span>
  );
}
