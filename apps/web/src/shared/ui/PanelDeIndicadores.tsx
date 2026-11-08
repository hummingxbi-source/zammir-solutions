import type { ReactElement, ReactNode } from 'react';

import { Sparkline, type TonoDeGrafica } from './Graficas';
import type { TonoDeIndicador } from './Indicador';

export interface ItemDePanel {
  readonly clave: string;
  /** Qué mide, en mayúsculas y monoespaciada. */
  readonly rotulo: string;
  /** La cifra, ya formateada. */
  readonly valor: string;
  readonly tono?: TonoDeIndicador;
  /** Cambio contra el periodo anterior, o cualquier etiqueta corta (por ejemplo una flecha de comparación). */
  readonly variacion?: ReactNode;
  /** Línea de apoyo bajo la cifra. */
  readonly detalle?: ReactNode;
  /** Tendencia de apoyo: se dibuja pequeña, sin ejes. */
  readonly tendencia?: readonly number[];
  readonly tonoDeTendencia?: TonoDeGrafica;
  /** Algo a la derecha del rótulo (por ejemplo, el botón de ayuda). */
  readonly ayuda?: ReactNode;
}

export interface PanelDeIndicadoresProps {
  readonly descripcion: string;
  readonly items: readonly ItemDePanel[];
}

/** Franja de cifras clave en **una sola superficie**, separadas por una línea fina: se lee de un vistazo, sin
 *  una tarjeta por dato. En pantallas angostas se apilan. */
export function PanelDeIndicadores({ descripcion, items }: PanelDeIndicadoresProps): ReactElement {
  return (
    <section className="panel-kpi" aria-label={descripcion}>
      {items.map((item) => (
        <dl
          key={item.clave}
          role="group"
          aria-label={item.rotulo}
          className={`panel-kpi__item panel-kpi__item--${item.tono ?? 'neutro'}`}
        >
          <div className="panel-kpi__cabecera">
            <dt className="rotulo panel-kpi__rotulo">{item.rotulo}</dt>
            {item.ayuda}
          </div>
          <dd className="cifra panel-kpi__valor">{item.valor}</dd>
          {item.variacion === undefined ? null : (
            <dd className="panel-kpi__variacion">{item.variacion}</dd>
          )}
          {item.tendencia === undefined ? null : (
            <dd className="panel-kpi__tendencia">
              <Sparkline puntos={item.tendencia} tono={item.tonoDeTendencia ?? 'acento'} />
            </dd>
          )}
          {item.detalle === undefined ? null : (
            <dd className="panel-kpi__detalle">{item.detalle}</dd>
          )}
        </dl>
      ))}
    </section>
  );
}
