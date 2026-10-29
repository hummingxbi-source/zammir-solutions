/** Palabras que nunca deben llegar a la pantalla [docs/producto/GLOSARIO.md, "Palabras prohibidas"].
 *  Cada una lleva lo que se debe decir en su lugar. */
export interface PalabraProhibida {
  readonly patron: RegExp;
  readonly usar: string;
}

export const PALABRAS_PROHIBIDAS: readonly PalabraProhibida[] = [
  { patron: /\bcheck-?out\b/i, usar: 'Cobrar' },
  { patron: /\bcarrito\b/i, usar: 'Ticket actual / conceptos' },
  { patron: /\bpunto de venta\b/i, usar: 'Mostrador' },
  { patron: /\bPOS\b/, usar: 'Mostrador' },
  { patron: /\binteligencia de negocios?\b/i, usar: 'Reportes' },
  { patron: /\bBI\b/, usar: 'Reportes' },
  { patron: /\bdashboard predictivo\b/i, usar: 'Reportes' },
  { patron: /\bsincroniz\w*/i, usar: 'Guardado en la tablet / Enviado' },
  { patron: /\boffline\b/i, usar: 'Guardado en la tablet / Enviado' },
  { patron: /\blogin\b/i, usar: 'Entrar' },
];

export interface Hallazgo {
  readonly palabra: string;
  readonly usar: string;
}

/** Devuelve las palabras prohibidas que aparecen en un texto de la interfaz. */
export function buscarPalabrasProhibidas(texto: string): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  for (const { patron, usar } of PALABRAS_PROHIBIDAS) {
    const coincidencia = patron.exec(texto);
    if (coincidencia !== null) {
      hallazgos.push({ palabra: coincidencia[0], usar });
    }
  }
  return hallazgos;
}

/** Recorre cualquier estructura de textos (objetos y listas anidados) y junta todos los textos. */
export function recolectarTextos(valor: unknown): string[] {
  if (typeof valor === 'string') {
    return [valor];
  }
  if (Array.isArray(valor)) {
    return valor.flatMap((elemento: unknown) => recolectarTextos(elemento));
  }
  if (typeof valor === 'object' && valor !== null) {
    return Object.values(valor).flatMap((elemento: unknown) => recolectarTextos(elemento));
  }
  return [];
}
