import { describe, expect, it } from 'vitest';

import { textos } from './textos';
import { buscarPalabrasProhibidas, recolectarTextos } from './vocabulario';

describe('buscarPalabrasProhibidas', () => {
  it.each([
    ['Ir al checkout', 'Cobrar'],
    ['Agregar al carrito', 'Ticket actual / conceptos'],
    ['Abrir el Punto de Venta', 'Mostrador'],
    ['Entrar al POS', 'Mostrador'],
    ['Panel de inteligencia de negocio', 'Reportes'],
    ['Reporte BI', 'Reportes'],
    ['Un dashboard predictivo', 'Reportes'],
    ['Sincronizando datos', 'Guardado en la tablet / Enviado'],
    ['Modo offline', 'Guardado en la tablet / Enviado'],
    ['Hacer login', 'Entrar'],
    ['Si sigue pasando, avísale a Juanito', 'soporte de HummingX'],
  ])('detecta "%s" y sugiere "%s"', (texto, usar) => {
    const hallazgos = buscarPalabrasProhibidas(texto);
    expect(hallazgos.map((h) => h.usar)).toContain(usar);
  });

  it('no marca el vocabulario del oficio', () => {
    expect(buscarPalabrasProhibidas('Cobrar el anticipo en el mostrador')).toEqual([]);
    expect(buscarPalabrasProhibidas('Guardado en la tablet')).toEqual([]);
    expect(buscarPalabrasProhibidas('Entrar con tu PIN')).toEqual([]);
  });
});

describe('recolectarTextos', () => {
  it('junta los textos de objetos y listas anidados e ignora lo que no es texto', () => {
    const estructura = { a: 'uno', b: { c: ['dos', { d: 'tres' }], e: 42, f: null } };
    expect(recolectarTextos(estructura)).toEqual(['uno', 'dos', 'tres']);
  });
});

describe('textos de la interfaz', () => {
  it('ninguno contiene una palabra prohibida del glosario', () => {
    for (const texto of recolectarTextos(textos)) {
      expect(buscarPalabrasProhibidas(texto), `texto: "${texto}"`).toEqual([]);
    }
  });

  it('la prueba sí falla cuando se agrega una palabra prohibida', () => {
    const conPalabraProhibida = { ...textos, extra: { boton: 'Ir al checkout' } };
    const hallazgos = recolectarTextos(conPalabraProhibida).flatMap((t) =>
      buscarPalabrasProhibidas(t),
    );
    expect(hallazgos.length).toBeGreaterThan(0);
  });
});

/** Junta todo grupo `errores` de los textos: cada entrada debe decir qué pasó y qué hacer [RF-UX-07, RN-23]. */
function gruposDeErrores(valor: unknown, ruta: string): [string, Record<string, unknown>][] {
  if (typeof valor !== 'object' || valor === null) {
    return [];
  }
  const grupos: [string, Record<string, unknown>][] = [];
  for (const [clave, hijo] of Object.entries(valor)) {
    const subruta = `${ruta}.${clave}`;
    if (clave === 'errores' && typeof hijo === 'object' && hijo !== null) {
      grupos.push([subruta, hijo as Record<string, unknown>]);
    }
    grupos.push(...gruposDeErrores(hijo, subruta));
  }
  return grupos;
}

describe('errores de la interfaz', () => {
  /** Una hoja del grupo de errores: una frase, o `{ mensaje, queHacer }`. Si no, es un subgrupo. */
  function verificar(ruta: string, valor: unknown): number {
    if (typeof valor === 'string') {
      // Errores de una fila al importar: una sola frase que ya dice cómo corregir.
      expect(valor.trim(), ruta).not.toBe('');
      return 1;
    }
    const objeto = valor as Record<string, unknown>;
    if ('mensaje' in objeto || 'queHacer' in objeto) {
      for (const campo of ['mensaje', 'queHacer'] as const) {
        const texto = objeto[campo];
        // Algunos llevan datos (por ejemplo, minutos de espera) y son una función que devuelve la frase.
        if (typeof texto === 'function') {
          continue;
        }
        expect(typeof texto, `${ruta}.${campo}`).toBe('string');
        expect(String(texto).trim(), `${ruta}.${campo}`).not.toBe('');
      }
      return 1;
    }
    return Object.entries(objeto).reduce((n, [k, v]) => n + verificar(`${ruta}.${k}`, v), 0);
  }

  it('todos dicen qué pasó y qué hacer', () => {
    const grupos = gruposDeErrores(textos, 'textos');
    expect(grupos.length).toBeGreaterThan(10);
    let revisados = 0;
    for (const [ruta, errores] of grupos) {
      revisados += verificar(ruta, errores);
    }
    expect(revisados).toBeGreaterThan(100);
  });
});
