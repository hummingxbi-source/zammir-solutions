/** Aritmética de las gráficas, toda con enteros: el dinero va en centavos y nunca en flotantes [RN-05].
 *  Aquí solo se decide qué escala y qué porciones dibujar; formatear el valor es cosa de quien llama. */

const MULTIPLICADORES = [1, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;

export interface EscalaAmable {
  /** El valor del borde de arriba: siempre un número redondo y nunca menor que el máximo. */
  readonly tope: number;
  /** Marcas de la escala, de abajo hacia arriba, empezando en 0 y terminando en el tope. */
  readonly marcas: readonly number[];
}

/** Escala con números redondos (1, 2, 2.5, 3, 4, 5, 6, 8 × una potencia de diez) para que el eje diga "$2,500" y no "$2,320".
 *  Con máximo 0 (o negativo) devuelve una escala mínima para que la gráfica no se rompa. */
export function escalaAmable(maximo: number, divisiones = 4): EscalaAmable {
  const n = Math.max(1, Math.floor(divisiones));
  if (!Number.isFinite(maximo) || maximo <= 0) {
    return { tope: n, marcas: Array.from({ length: n + 1 }, (_, i) => i) };
  }
  const bruto = maximo / n;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  let paso = potencia * 10;
  for (const m of MULTIPLICADORES) {
    const candidato = m * potencia;
    if (candidato * n >= maximo) {
      paso = candidato;
      break;
    }
  }
  paso = Math.max(1, Math.round(paso));
  return { tope: paso * n, marcas: Array.from({ length: n + 1 }, (_, i) => i * paso) };
}

/** Pesos compactos para un eje, desde centavos: 250000 → "$2.5k", 80000 → "$800", 0 → "$0". */
export function pesosCompactos(centavos: number): string {
  const pesos = Math.round(Math.abs(centavos) / 100);
  const signo = centavos < 0 ? '-' : '';
  if (pesos < 1000) {
    return `${signo}$${String(pesos)}`;
  }
  if (pesos < 1_000_000) {
    const decimas = Math.round(pesos / 100);
    const entero = Math.floor(decimas / 10);
    const resto = decimas % 10;
    return `${signo}$${String(entero)}${resto === 0 ? '' : `.${String(resto)}`}k`;
  }
  const decimas = Math.round(pesos / 100_000);
  const entero = Math.floor(decimas / 10);
  const resto = decimas % 10;
  return `${signo}$${String(entero)}${resto === 0 ? '' : `.${String(resto)}`}M`;
}

export interface PorcionDeDona<T> {
  readonly dato: T;
  readonly valor: number;
  /** Porción en puntos base (10 000 = 100 %); las porciones de una dona suman exactamente 10 000. */
  readonly bps: number;
  /** Dónde empieza la porción, en puntos base desde las 12 en punto. */
  readonly inicioBps: number;
}

/** Reparte un total en porciones de puntos base que siempre suman 10 000 (método del mayor resto), para que
 *  los porcentajes de la leyenda no sumen 99.99 ni 100.01. Los valores negativos cuentan como 0. Sin nada que
 *  repartir devuelve lista vacía. */
export function porcionesDeDona<T extends { readonly valor: number }>(
  datos: readonly T[],
): readonly PorcionDeDona<T>[] {
  const valores = datos.map((d) => Math.max(0, d.valor));
  const total = valores.reduce((s, v) => s + v, 0);
  if (total === 0) {
    return [];
  }
  const exactos = valores.map((v) => (v * 10_000) / total);
  const bases = exactos.map((x) => Math.floor(x));
  let faltan = 10_000 - bases.reduce((s, b) => s + b, 0);
  const porResto = exactos
    .map((x, i) => ({ i, resto: x - Math.floor(x) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const { i } of porResto) {
    if (faltan <= 0) {
      break;
    }
    bases[i] = (bases[i] ?? 0) + 1;
    faltan -= 1;
  }
  let acumulado = 0;
  return datos.map((dato, i) => {
    const bps = bases[i] ?? 0;
    const porcion = { dato, valor: valores[i] ?? 0, bps, inicioBps: acumulado };
    acumulado += bps;
    return porcion;
  });
}

/** Porción como texto con un decimal, sin flotantes: 3333 → "33.3 %". */
export function textoDePorcion(bps: number): string {
  const decimas = Math.round(bps / 10);
  return `${String(Math.floor(decimas / 10))}.${String(decimas % 10)} %`;
}

/** Trazo de una línea en un cuadro de `ancho` × `alto`: x repartida parejo, y proporcional al tope de la escala. */
export function trazoDeLinea(
  valores: readonly number[],
  tope: number,
  ancho: number,
  alto: number,
): {
  readonly linea: string;
  readonly area: string;
  readonly ultimo: { x: number; y: number } | null;
} {
  if (valores.length === 0) {
    return { linea: '', area: '', ultimo: null };
  }
  const x = (i: number): number =>
    valores.length === 1 ? ancho / 2 : (i * ancho) / (valores.length - 1);
  const y = (v: number): number => (tope <= 0 ? alto : alto - (Math.max(0, v) / tope) * alto);
  const puntos = valores.map((v, i) => ({ x: x(i), y: y(v) }));
  const linea = puntos
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const ultimo = puntos[puntos.length - 1] ?? null;
  const primero = puntos[0];
  const area =
    ultimo === null || primero === undefined
      ? ''
      : `${linea} L${ultimo.x.toFixed(1)} ${String(alto)} L${primero.x.toFixed(1)} ${String(alto)} Z`;
  return { linea, area, ultimo };
}
