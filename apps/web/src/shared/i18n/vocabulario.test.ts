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
