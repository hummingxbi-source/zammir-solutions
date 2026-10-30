import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import { normalizeSearchText, searchProducts, type Searchable } from './search';

const vidrio = asId<'Category'>('c-vidrio');
const aluminio = asId<'Category'>('c-aluminio');

function p(name: string, extra: Partial<Searchable> = {}): Searchable {
  return { name, code: null, categoryId: vidrio, kind: 'CUSTOM', ...extra };
}

const catalogo: Searchable[] = [
  p('Vídrio claro 6 mm', { code: 'VC-6' }),
  p('Vidrio TEMPLADO 9 mm', { code: 'VT-9' }),
  p('Espejo biselado', { code: 'ESP-1' }),
  p('Ventana corrediza de aluminio', { categoryId: aluminio, kind: 'STANDARD', code: 'VCA-1' }),
  p('Instalación a domicilio', { kind: 'SERVICE' }),
];

function nombres(resultado: readonly Searchable[]): string[] {
  return resultado.map((r) => r.name);
}

describe('normalizeSearchText', () => {
  it.each([
    ['Vídrio', 'vidrio'],
    ['TEMPLADO', 'templado'],
    ['  Cristal   doble  ', 'cristal doble'],
    ['Instalación', 'instalacion'],
    ['Ñandú', 'nandu'],
    ['MÜLLER', 'muller'],
    ['', ''],
  ])('%j → %j', (entrada, esperado) => {
    expect(normalizeSearchText(entrada)).toBe(esperado);
  });

  it('es idempotente y no deja acentos ni mayúsculas', () => {
    fc.assert(
      fc.property(fc.string(), (texto) => {
        const una = normalizeSearchText(texto);
        expect(normalizeSearchText(una)).toBe(una);
        expect(una).toBe(una.toLowerCase());
        expect(una).not.toMatch(/\p{M}/u);
      }),
    );
  });
});

describe('searchProducts: texto', () => {
  it('"vidrio" encuentra "Vídrio" (sin acento)', () => {
    expect(nombres(searchProducts(catalogo, { text: 'vidrio' }))).toContain('Vídrio claro 6 mm');
  });

  it('"TEMPLADO" encuentra "templado" (sin mayúsculas)', () => {
    expect(nombres(searchProducts(catalogo, { text: 'TEMPLADO' }))).toEqual([
      'Vidrio TEMPLADO 9 mm',
    ]);
  });

  it('con o sin acento en lo que se escribe, encuentra igual', () => {
    expect(nombres(searchProducts(catalogo, { text: 'instalación' }))).toEqual([
      'Instalación a domicilio',
    ]);
    expect(nombres(searchProducts(catalogo, { text: 'instalacion' }))).toEqual([
      'Instalación a domicilio',
    ]);
  });

  it('varias palabras se combinan con "y", en cualquier orden', () => {
    expect(searchProducts(catalogo, { text: 'mm vidrio' })).toHaveLength(2);
    expect(nombres(searchProducts(catalogo, { text: 'vidrio templado' }))).toEqual([
      'Vidrio TEMPLADO 9 mm',
    ]);
    expect(nombres(searchProducts(catalogo, { text: 'templado 9' }))).toEqual([
      'Vidrio TEMPLADO 9 mm',
    ]);
  });

  it('también busca por código', () => {
    expect(nombres(searchProducts(catalogo, { text: 'esp-1' }))).toEqual(['Espejo biselado']);
    expect(nombres(searchProducts(catalogo, { text: 'VC-6' }))).toEqual(['Vídrio claro 6 mm']);
  });

  it('un texto que no coincide con nada da una lista vacía', () => {
    expect(searchProducts(catalogo, { text: 'zzzz' })).toEqual([]);
  });

  it('sin texto (o solo espacios) devuelve todo, ordenado por nombre', () => {
    expect(searchProducts(catalogo, { text: '   ' })).toHaveLength(catalogo.length);
    const ordenados = [...nombres(catalogo)].sort((a, b) => a.localeCompare(b, 'es'));
    expect(nombres(searchProducts(catalogo))).toEqual(ordenados);
  });

  it('los nombres que empiezan con la búsqueda salen primero', () => {
    const lista = [p('Película para vidrio'), p('Vidrio claro'), p('Antividrio')];
    expect(nombres(searchProducts(lista, { text: 'vidrio' }))).toEqual([
      'Vidrio claro',
      'Antividrio',
      'Película para vidrio',
    ]);
  });
});

describe('searchProducts: filtros', () => {
  it('por categoría', () => {
    expect(nombres(searchProducts(catalogo, { categoryId: aluminio }))).toEqual([
      'Ventana corrediza de aluminio',
    ]);
  });

  it('por tipo', () => {
    expect(nombres(searchProducts(catalogo, { kind: 'SERVICE' }))).toEqual([
      'Instalación a domicilio',
    ]);
  });

  it('categoría, tipo y texto juntos devuelven la intersección', () => {
    expect(
      searchProducts(catalogo, { categoryId: vidrio, kind: 'CUSTOM', text: 'vidrio' }),
    ).toHaveLength(2);
    expect(
      searchProducts(catalogo, { categoryId: vidrio, kind: 'STANDARD', text: 'vidrio' }),
    ).toEqual([]);
    expect(
      nombres(
        searchProducts(catalogo, { categoryId: aluminio, kind: 'STANDARD', text: 'ventana' }),
      ),
    ).toEqual(['Ventana corrediza de aluminio']);
  });

  it('no modifica la lista original', () => {
    const copia = [...catalogo];
    searchProducts(catalogo, { text: 'vidrio' });
    expect(catalogo).toEqual(copia);
  });

  it('propiedad: el resultado siempre es un subconjunto de la entrada y cumple los filtros', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 12 }), fc.boolean(), (texto, soloVidrio) => {
        const r = searchProducts(
          catalogo,
          soloVidrio ? { text: texto, categoryId: vidrio } : { text: texto },
        );
        for (const producto of r) {
          expect(catalogo).toContain(producto);
          if (soloVidrio) {
            expect(producto.categoryId).toBe(vidrio);
          }
        }
      }),
    );
  });
});
