import type { ReactElement, ReactNode } from 'react';

export type TonoDeIndicador = 'neutro' | 'exito' | 'aviso' | 'peligro';

export interface IndicadorProps {
  /** Qué mide, en mayúsculas y monoespaciada. */
  readonly rotulo: string;
  /** La cifra, ya formateada (por ejemplo "$1,240.00"). */
  readonly valor: string;
  /** Línea de apoyo bajo la cifra. */
  readonly detalle?: ReactNode;
  readonly tono?: TonoDeIndicador;
}

/** Indicador: rótulo, cifra grande en la serifa de títulos y un detalle. La cifra se lee como "rótulo,
 *  valor" por los lectores de pantalla (lista de definición). */
export function Indicador({
  rotulo,
  valor,
  detalle,
  tono = 'neutro',
}: IndicadorProps): ReactElement {
  return (
    <dl className={`indicador indicador--${tono}`}>
      <dt className="rotulo indicador__rotulo">{rotulo}</dt>
      <dd className="cifra indicador__valor">{valor}</dd>
      {detalle !== undefined ? <dd className="indicador__detalle">{detalle}</dd> : null}
    </dl>
  );
}
