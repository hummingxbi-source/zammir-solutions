import { normalizeSearchText } from '../../catalog/domain/search';
import type { Customer } from './customer';

const SOLO_DIGITOS = /\d/g;

function digitos(texto: string): string {
  return (texto.match(SOLO_DIGITOS) ?? []).join('');
}

/** Busca clientes ya cargados por nombre (parcial, sin acentos ni mayúsculas), teléfono (parcial, en
 *  cualquier formato) o correo [RF-M5-04]. Varias palabras se combinan con "y". Los nombres que empiezan
 *  con lo escrito salen primero; después, por nombre. Funciona sobre la lista local, también sin internet. */
export function searchCustomers<T extends Pick<Customer, 'name' | 'phone' | 'email'>>(
  clientes: readonly T[],
  texto: string,
): T[] {
  const palabras = normalizeSearchText(texto)
    .split(' ')
    .filter((palabra) => palabra !== '');

  const encontrados = clientes.flatMap((cliente) => {
    const nombre = normalizeSearchText(cliente.name);
    const correo = normalizeSearchText(cliente.email ?? '');
    const coincide = palabras.every((palabra) => {
      // Una palabra hecha de números (aunque traiga guiones o paréntesis) busca también en el teléfono.
      const numeros = /^[\d+()\-.]+$/.test(palabra) ? digitos(palabra) : '';
      return (
        nombre.includes(palabra) ||
        correo.includes(palabra) ||
        (numeros !== '' && cliente.phone.includes(numeros))
      );
    });
    if (!coincide) {
      return [];
    }
    return [
      {
        cliente,
        nombre,
        empieza: palabras.length > 0 && nombre.startsWith(palabras.join(' ')) ? 0 : 1,
      },
    ];
  });

  return encontrados
    .sort((a, b) => a.empieza - b.empieza || a.nombre.localeCompare(b.nombre, 'es'))
    .map((e) => e.cliente);
}
