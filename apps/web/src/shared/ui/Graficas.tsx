import { useId } from 'react';
import type { ReactElement } from 'react';

import { textos } from '../i18n/textos';
import { escalaAmable, porcionesDeDona, textoDePorcion, trazoDeLinea } from './graficas-util';

export type TonoDeGrafica =
  'acento' | 'laton' | 'exito' | 'aviso' | 'peligro' | 'aluminio' | 'vidrio' | 'oliva';

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
  /** Cómo se escriben las marcas del eje (más cortas que el valor, por ejemplo "$2.5k"). */
  readonly formatearEje?: (valor: number) => string;
}

const ANCHO = 600;
const ALTO = 200;

/** Tendencia en área con eje de valores y cuadrícula suave. El dibujo es solo apoyo: el valor más alto, las
 *  fechas y una tabla equivalente van en texto para los lectores de pantalla. Sin librerías [ADR-0028]. */
export function GraficaDeLinea({
  descripcion,
  puntos,
  formatear,
  formatearEje,
}: GraficaDeLineaProps): ReactElement {
  const idGradiente = `linea-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const maximo = Math.max(0, ...puntos.map((p) => p.valor));
  const escala = escalaAmable(maximo);
  const trazo = trazoDeLinea(
    puntos.map((p) => p.valor),
    escala.tope,
    ANCHO,
    ALTO,
  );
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];
  const medio = puntos[Math.floor((puntos.length - 1) / 2)];
  const escribirEje = formatearEje ?? formatear;

  return (
    <figure className="linea">
      <figcaption className="solo-lectores">{descripcion}</figcaption>
      <p className="solo-lectores">
        {textos.componentes.maximo} {formatear(maximo)}
      </p>
      <div className="linea__cuerpo" aria-hidden="true">
        <ol className="linea__eje">
          {[...escala.marcas].reverse().map((m) => (
            <li key={m}>{escribirEje(m)}</li>
          ))}
        </ol>
        <div className="linea__lienzo">
          <svg
            className="linea__dibujo"
            viewBox={`0 0 ${String(ANCHO)} ${String(ALTO)}`}
            preserveAspectRatio="none"
            focusable="false"
          >
            <defs>
              <linearGradient id={idGradiente} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" className="linea__degradado-arriba" />
                <stop offset="100%" className="linea__degradado-abajo" />
              </linearGradient>
            </defs>
            {escala.marcas.map((m) => (
              <line
                key={m}
                className={m === 0 ? 'linea__base' : 'linea__guia'}
                x1="0"
                x2={ANCHO}
                y1={ALTO - (m / escala.tope) * ALTO}
                y2={ALTO - (m / escala.tope) * ALTO}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {trazo.area === '' ? null : <path d={trazo.area} fill={`url(#${idGradiente})`} />}
            <path d={trazo.linea} className="linea__trazo" vectorEffect="non-scaling-stroke" />
          </svg>
          {trazo.ultimo === null ? null : (
            <span
              className="linea__punto"
              style={{
                insetInlineStart: `${String((trazo.ultimo.x / ANCHO) * 100)}%`,
                insetBlockStart: `${String((trazo.ultimo.y / ALTO) * 100)}%`,
              }}
            />
          )}
        </div>
      </div>
      {primero !== undefined && ultimo !== undefined ? (
        <p className="linea__extremos rotulo" aria-hidden="true">
          <span>{primero.etiqueta}</span>
          {puntos.length > 2 && medio !== undefined ? <span>{medio.etiqueta}</span> : null}
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

export interface DatoDeDona {
  readonly etiqueta: string;
  readonly valor: number;
  readonly tono?: TonoDeGrafica;
  /** Línea de apoyo bajo la etiqueta (por ejemplo, cuántos trabajos son). */
  readonly nota?: string;
}

export interface DonaProps {
  readonly descripcion: string;
  readonly datos: readonly DatoDeDona[];
  readonly formatear: (valor: number) => string;
  /** Lo que va en el hueco: una cifra y qué es. */
  readonly centro?: { readonly valor: string; readonly rotulo: string };
}

const TONO_POR_ORDEN: readonly TonoDeGrafica[] = [
  'acento',
  'laton',
  'exito',
  'aluminio',
  'aviso',
  'vidrio',
  'oliva',
  'peligro',
];

/** Dona con la leyenda en texto al lado: cada renglón dice su valor y su porcentaje, así que el dibujo es solo
 *  apoyo. Los porcentajes suman exactamente 100 % (puntos base enteros). */
export function Dona({ descripcion, datos, formatear, centro }: DonaProps): ReactElement {
  const porciones = porcionesDeDona(datos);
  const tonoDe = (i: number): TonoDeGrafica =>
    datos[i]?.tono ?? TONO_POR_ORDEN[i % TONO_POR_ORDEN.length] ?? 'acento';
  const hayDatos = porciones.length > 0;
  return (
    <figure className="dona">
      <div className="dona__dibujo">
        <svg viewBox="0 0 42 42" aria-hidden="true" focusable="false">
          <circle className="dona__pista" cx="21" cy="21" r="15.9155" />
          {porciones.map((p, i) => {
            if (p.bps === 0) {
              return null;
            }
            const largo = p.bps / 100;
            const hueco = porciones.filter((x) => x.bps > 0).length > 1 ? 0.7 : 0;
            return (
              <circle
                key={p.dato.etiqueta}
                className={`dona__arco dona__arco--${tonoDe(i)}`}
                cx="21"
                cy="21"
                r="15.9155"
                pathLength="100"
                strokeDasharray={`${String(Math.max(0, largo - hueco))} ${String(100 - Math.max(0, largo - hueco))}`}
                strokeDashoffset={String(-(p.inicioBps / 100))}
                transform="rotate(-90 21 21)"
              />
            );
          })}
        </svg>
        {centro === undefined ? null : (
          <p className="dona__centro">
            <span className="cifra dona__centro-valor">{centro.valor}</span>
            <span className="rotulo dona__centro-rotulo">{centro.rotulo}</span>
          </p>
        )}
      </div>
      <figcaption className="solo-lectores">{descripcion}</figcaption>
      <ul className="dona__leyenda" aria-label={descripcion}>
        {datos.map((d, i) => (
          <li key={d.etiqueta} className="dona__item">
            <span className={`dona__marca dona__arco--${tonoDe(i)}`} aria-hidden="true" />
            <span className="dona__etiqueta">
              {d.etiqueta}
              {d.nota !== undefined ? <small className="dona__nota">{d.nota}</small> : null}
            </span>
            <span className="dona__valor">
              {formatear(d.valor)}
              {hayDatos ? (
                <small className="dona__porcentaje">{textoDePorcion(porciones[i]?.bps ?? 0)}</small>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export interface SparklineProps {
  readonly puntos: readonly number[];
  readonly tono?: TonoDeGrafica;
}

/** Mini-tendencia sin ejes para acompañar una cifra. Es solo adorno: no dice nada que la cifra no diga. */
export function Sparkline({ puntos, tono = 'acento' }: SparklineProps): ReactElement | null {
  if (puntos.length < 2) {
    return null;
  }
  const maximo = Math.max(...puntos, 0);
  const trazo = trazoDeLinea(puntos, maximo, 100, 28);
  return (
    <svg
      className={`sparkline sparkline--${tono}`}
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d={trazo.area} className="sparkline__area" />
      <path d={trazo.linea} className="sparkline__trazo" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export interface DatoDeColumna {
  readonly etiqueta: string;
  readonly valor: number;
  readonly tono?: TonoDeGrafica;
}

export interface GraficaDeColumnasProps {
  readonly descripcion: string;
  readonly datos: readonly DatoDeColumna[];
  readonly formatear: (valor: number) => string;
}

/** Columnas verticales con el valor escrito arriba de cada una. La que más vale va en el acento y las demás
 *  en aluminio, salvo que el dato traiga su propio tono. */
export function GraficaDeColumnas({
  descripcion,
  datos,
  formatear,
}: GraficaDeColumnasProps): ReactElement {
  const maximo = Math.max(0, ...datos.map((d) => d.valor));
  const lider = datos.findIndex((d) => d.valor === maximo && maximo > 0);
  return (
    <ul
      className="columnas"
      aria-label={descripcion}
      style={{
        gridTemplateColumns: `repeat(${String(Math.max(1, datos.length))}, minmax(0, 1fr))`,
      }}
    >
      {datos.map((d, i) => {
        const alto = maximo === 0 ? 0 : Math.max(0, Math.min(100, (d.valor / maximo) * 100));
        return (
          <li key={d.etiqueta} className="columnas__col">
            <span className="columnas__valor">{formatear(d.valor)}</span>
            <span className="columnas__pista" aria-hidden="true">
              <span
                className={`columnas__barra barras__barra--${d.tono ?? (i === lider ? 'acento' : 'aluminio')}`}
                style={{ blockSize: `${String(alto)}%` }}
              />
            </span>
            <span className="columnas__etiqueta">{d.etiqueta}</span>
          </li>
        );
      })}
    </ul>
  );
}
