/** Unidad de venta de un producto que se cobra por pieza o por servicio: "rollo", "kilo", "juego", "par",
 *  "cartucho", "hora" [RF-M1-11, ADR-0048]. Solo cambia cómo se lee la cantidad ("2 rollos"); el cálculo sigue
 *  siendo cantidad × precio. */

/** Largo máximo de la unidad de venta. */
export const MAX_SALE_UNIT_LENGTH = 20;

/** Sugerencias para que todos escriban igual; se suman las que ya usa el catálogo. */
export const SALE_UNIT_SUGGESTIONS: readonly string[] = [
  'rollo',
  'kilo',
  'juego',
  'par',
  'cartucho',
  'hoja',
  'tramo',
  'visita',
  'hora',
];

const VOCAL = /[aeiouáéíóú]/i;
const VOCAL_FINAL = /[aeiouáéíóú]$/i;

/** Plural de una palabra en español, con las reglas comunes: "rollo" → "rollos", "par" → "pares",
 *  "galón" → "galones", "luz" → "luces", "kit" → "kits". Una abreviatura ("kg", "pza.") no cambia. */
function pluralDePalabra(palabra: string): string {
  if (palabra.endsWith('.') || !VOCAL.test(palabra) || /\d/.test(palabra)) return palabra;
  if (VOCAL_FINAL.test(palabra)) return `${palabra}s`;
  const ultima = palabra.slice(-1).toLowerCase();
  if (ultima === 's' || ultima === 'x') return palabra;
  if (ultima === 'z') return `${palabra.slice(0, -1)}ces`;
  if ('nlrdjy'.includes(ultima)) {
    // La sílaba que crece pierde el acento escrito: "galón" → "galones", "rubí" ya terminó arriba.
    const sinAcento = palabra.replace(
      /([áéíóú])([nlrdjy])$/i,
      (_, v: string, c: string) => `${v.normalize('NFD').slice(0, 1)}${c}`,
    );
    return `${sinAcento}es`;
  }
  return `${palabra}s`;
}

/** La unidad como se lee con la cantidad: en singular con 1 y en plural con lo demás. Si son varias palabras,
 *  solo cambia la primera ("tramo de 6 m" → "tramos de 6 m"). */
export function saleUnitFor(cantidad: number, unidad: string): string {
  if (cantidad === 1) return unidad;
  const [primera = '', ...resto] = unidad.split(' ');
  return [pluralDePalabra(primera), ...resto].join(' ');
}
