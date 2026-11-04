import type { ReactElement, ReactNode } from 'react';

export interface ColumnaDeTabla<T> {
  readonly clave: string;
  readonly rotulo: string;
  readonly celda: (fila: T) => ReactNode;
  /** Cifras e importes: alineadas a la derecha. */
  readonly numerica?: boolean;
}

export interface TablaProps<T> {
  /** Qué contiene la tabla, para los lectores de pantalla. */
  readonly descripcion: string;
  /** La primera columna hace de encabezado de cada fila. */
  readonly columnas: readonly ColumnaDeTabla<T>[];
  readonly filas: readonly T[];
  readonly claveDeFila: (fila: T) => string;
  /** Resalta la fila (por ejemplo, una cuenta atrasada); el aviso va también en texto dentro de la celda. */
  readonly resaltada?: (fila: T) => boolean;
}

/** Tabla de datos que en el celular se apila: cada fila es una tarjeta y cada celda lleva su rótulo, así
 *  la página no se desplaza de lado [RNF-31]. */
export function Tabla<T>({
  descripcion,
  columnas,
  filas,
  claveDeFila,
  resaltada,
}: TablaProps<T>): ReactElement {
  return (
    <table className="tabla tabla--apilada" aria-label={descripcion}>
      <thead>
        <tr>
          {columnas.map((c) => (
            <th
              key={c.clave}
              scope="col"
              className={c.numerica === true ? 'tabla__num' : undefined}
            >
              {c.rotulo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr
            key={claveDeFila(fila)}
            className={resaltada?.(fila) === true ? 'fila--atrasada' : undefined}
          >
            {columnas.map((c, indice) =>
              indice === 0 ? (
                <th key={c.clave} scope="row">
                  {c.celda(fila)}
                </th>
              ) : (
                <td
                  key={c.clave}
                  data-label={c.rotulo}
                  className={c.numerica === true ? 'tabla__num' : undefined}
                >
                  {c.celda(fila)}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
