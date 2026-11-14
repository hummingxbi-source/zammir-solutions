import type { ReactElement } from 'react';

/** Las iniciales de un nombre ("Ana Pérez" → "AP"), para la insignia redonda de cada persona. */
export function inicialesDe(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  const primera = palabras[0]?.[0] ?? '?';
  const segunda = palabras.length > 1 ? (palabras[1]?.[0] ?? '') : '';
  return `${primera}${segunda}`.toLocaleUpperCase('es-MX');
}

/** Insignia redonda con las iniciales de una persona. Es decorativa: el nombre siempre va al lado. */
export function Inicial({ nombre }: { readonly nombre: string }): ReactElement {
  return (
    <span className="inicial" aria-hidden="true">
      {inicialesDe(nombre)}
    </span>
  );
}
