/** Dónde va el globo del recorrido respecto al elemento que se explica [RF-UX-04]. Es una función pura para
 *  poder probarla sin navegador. */

export interface Caja {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface Medidas {
  readonly width: number;
  readonly height: number;
}

export type LadoDeGlobo = 'abajo' | 'arriba' | 'derecha' | 'izquierda';
export type Lado = LadoDeGlobo | 'centro' | 'hoja';

export interface Colocacion {
  readonly lado: Lado;
  readonly top: number;
  readonly left: number;
}

/** Margen entre el elemento, el globo y la orilla de la pantalla. */
export const SEPARACION = 16;

/** Por debajo de este ancho el globo va como hoja fija al pie de la pantalla. */
export const ANCHO_DE_HOJA = 640;

const ORDEN: readonly LadoDeGlobo[] = ['abajo', 'arriba', 'derecha', 'izquierda'];

const limitar = (valor: number, minimo: number, maximo: number): number =>
  Math.min(Math.max(valor, minimo), Math.max(minimo, maximo));

/** Busca un lado con espacio, empezando por el preferido (los elementos de la barra lateral prefieren la
 *  derecha), y centra el globo sobre el elemento sin salirse de la pantalla. Sin elemento, o si no cabe en
 *  ningún lado, va al centro. En pantallas angostas, siempre como hoja al pie. */
export function colocarGlobo(
  objetivo: Caja | null,
  globo: Medidas,
  pantalla: Medidas,
  preferido: LadoDeGlobo = 'abajo',
): Colocacion {
  if (pantalla.width < ANCHO_DE_HOJA) {
    return { lado: 'hoja', top: Math.max(0, pantalla.height - globo.height), left: 0 };
  }
  const centro: Colocacion = {
    lado: 'centro',
    top: limitar((pantalla.height - globo.height) / 2, SEPARACION, pantalla.height),
    left: limitar((pantalla.width - globo.width) / 2, SEPARACION, pantalla.width),
  };
  if (objetivo === null) {
    return centro;
  }

  const maxLeft = pantalla.width - globo.width - SEPARACION;
  const maxTop = pantalla.height - globo.height - SEPARACION;
  const centradoX = limitar(
    objetivo.left + objetivo.width / 2 - globo.width / 2,
    SEPARACION,
    maxLeft,
  );
  const centradoY = limitar(
    objetivo.top + objetivo.height / 2 - globo.height / 2,
    SEPARACION,
    maxTop,
  );

  const intentos: Record<LadoDeGlobo, () => Colocacion | null> = {
    abajo: () => {
      const top = objetivo.top + objetivo.height + SEPARACION;
      return top + globo.height + SEPARACION <= pantalla.height
        ? { lado: 'abajo', top, left: centradoX }
        : null;
    },
    arriba: () => {
      const top = objetivo.top - SEPARACION - globo.height;
      return top >= SEPARACION ? { lado: 'arriba', top, left: centradoX } : null;
    },
    derecha: () => {
      const left = objetivo.left + objetivo.width + SEPARACION;
      return left + globo.width + SEPARACION <= pantalla.width
        ? { lado: 'derecha', top: centradoY, left }
        : null;
    },
    izquierda: () => {
      const left = objetivo.left - SEPARACION - globo.width;
      return left >= SEPARACION ? { lado: 'izquierda', top: centradoY, left } : null;
    },
  };

  for (const lado of [preferido, ...ORDEN.filter((l) => l !== preferido)]) {
    const colocacion = intentos[lado]();
    if (colocacion !== null) {
      return colocacion;
    }
  }

  // El elemento es tan grande que no cabe el globo en ningún lado: se pega a la orilla de la pantalla (abajo o
  // arriba) donde tape menos del elemento.
  const pegadoAbajo = maxTop;
  const pegadoArriba = SEPARACION;
  const tapa = (top: number): number =>
    Math.max(
      0,
      Math.min(top + globo.height, objetivo.top + objetivo.height) - Math.max(top, objetivo.top),
    );
  return tapa(pegadoAbajo) <= tapa(pegadoArriba)
    ? { lado: 'abajo', top: Math.max(SEPARACION, pegadoAbajo), left: centradoX }
    : { lado: 'arriba', top: pegadoArriba, left: centradoX };
}

/** ¿Se ve el elemento? Uno oculto o de tamaño cero no sirve para enfocarlo. */
export function esVisible(caja: Caja): boolean {
  return caja.width > 0 && caja.height > 0;
}
