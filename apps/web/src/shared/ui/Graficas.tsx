import type { ReactElement } from 'react';

import { textos } from '../i18n/textos';

export type TonoDeGrafica = 'acento' | 'laton' | 'exito' | 'aviso' | 'peligro' | 'aluminio';

export interface DatoDeBarra {
  readonly etiqueta: string;
  readonly valor: number;
  readonly tono?: TonoDeGrafica;
  /** Línea de apoyo bajo la etiqueta (por ejemplo, cuántas cuentas hay). */
  readonly nota?: string;
}

export interface GraficaDeBarrasProps {
  /** Qué muestra, para los lectores de pantalla. */
  readonly descripcion: string;
  readonly datos: readonly DatoDeBarra[];
  /** Cómo se escribe cada valor (por ejemplo, como pesos). */
  readonly formatear: (valor: number) => string;
}

/** Barras horizontales hechas con la lista misma: cada renglón dice su etiqueta y su valor **en texto**, y la
 *  barra es solo el dibujo (por eso no hace falta una tabla aparte). Sin librerías ni animaciones [ADR-0028]. */
export function GraficaDeBarras({
  descripcion,
  datos,
  formatear,
}: GraficaDeBarrasProps): ReactElement {
  const maximo = Math.max(0, ...datos.map((d) => d.valor));
  return (
    <ul className="barras" aria-label={descripcion}>
      {datos.map((d) => {
        const ancho = maximo === 0 ? 0 : Math.max(0, Math.min(100, (d.valor / maximo) * 100));
        return (
          <li key={d.etiqueta} className="barras__fila">
            <span className="barras__etiqueta">
              {d.etiqueta}
              {d.nota !== undefined ? <small className="barras__nota">{d.nota}</small> : null}
            </span>
            <span className="barras__pista" aria-hidden="true">
              <span
                className={`barras__barra barras__barra--${d.tono ?? 'acento'}`}
                style={{ inlineSize: `${String(ancho)}%` }}
              />
            </span>
            <span className="barras__valor">{formatear(d.valor)}</span>
          </li>
        );
      })}
    </ul>
  );
}

export interface PuntoDeLinea {
  readonly etiqueta: string;
  readonly valor: number;
}

export interface GraficaDeLineaProps {
  readonly descripcion: string;
  readonly puntos: readonly PuntoDeLinea[];
  readonly formatear: (valor: number) => string;
}

const ANCHO = 600;
const ALTO = 180;
const MARGEN = 8;

/** Línea con relleno suave para una tendencia. El dibujo es solo apoyo: debajo van el valor más alto, las
 *  fechas de los extremos y una tabla equivalente para los lectores de pantalla. */
export function GraficaDeLinea({
  descripcion,
  puntos,
  formatear,
}: GraficaDeLineaProps): ReactElement {
  const maximo = Math.max(0, ...puntos.map((p) => p.valor));
  const x = (i: number): number =>
    puntos.length <= 1 ? ANCHO / 2 : MARGEN + (i * (ANCHO - 2 * MARGEN)) / (puntos.length - 1);
  const y = (valor: number): number =>
    maximo === 0 ? ALTO - MARGEN : ALTO - MARGEN - (valor / maximo) * (ALTO - 2 * MARGEN);
  const trazo = puntos
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`)
    .join(' ');
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  const area =
    puntos.length === 0
      ? ''
      : `${trazo} L${x(puntos.length - 1).toFixed(1)} ${String(ALTO)} L${x(0).toFixed(1)} ${String(ALTO)} Z`;

  return (
    <figure className="linea">
      <figcaption className="solo-lectores">{descripcion}</figcaption>
      <p className="linea__maximo rotulo">
        {textos.componentes.maximo} {formatear(maximo)}
      </p>
      <svg
        className="linea__dibujo"
        viewBox={`0 0 ${String(ANCHO)} ${String(ALTO)}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d={area} className="linea__area" />
        <path d={trazo} className="linea__trazo" vectorEffect="non-scaling-stroke" />
      </svg>
      {primero !== undefined && ultimo !== undefined ? (
        <p className="linea__extremos rotulo">
          <span>{primero.etiqueta}</span>
          <span>{ultimo.etiqueta}</span>
        </p>
      ) : null}
      <table className="solo-lectores">
        <caption>{descripcion}</caption>
        <tbody>
          {puntos.map((p) => (
            <tr key={p.etiqueta}>
              <th scope="row">{p.etiqueta}</th>
              <td>{formatear(p.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
