import { describe, expect, it } from 'vitest';

import { saleUnitFor } from './sale-unit';

describe('unidad de venta con su cantidad [RF-M1-11]', () => {
  it('con 1 queda en singular', () => {
    expect(saleUnitFor(1, 'rollo')).toBe('rollo');
    expect(saleUnitFor(1, 'par')).toBe('par');
  });

  it('terminada en vocal suma "s"', () => {
    expect(saleUnitFor(2, 'rollo')).toBe('rollos');
    expect(saleUnitFor(3, 'hora')).toBe('horas');
    expect(saleUnitFor(2, 'juego')).toBe('juegos');
    expect(saleUnitFor(2, 'sofá')).toBe('sofás');
    expect(saleUnitFor(0, 'kilo')).toBe('kilos');
  });

  it('terminada en n, l, r, d, j o y suma "es" y pierde el acento escrito', () => {
    expect(saleUnitFor(2, 'par')).toBe('pares');
    expect(saleUnitFor(4, 'galón')).toBe('galones');
    expect(saleUnitFor(2, 'riel')).toBe('rieles');
    expect(saleUnitFor(2, 'unidad')).toBe('unidades');
    expect(saleUnitFor(2, 'reloj')).toBe('relojes');
    expect(saleUnitFor(2, 'rey')).toBe('reyes');
    expect(saleUnitFor(2, 'CAMIÓN')).toBe('CAMIONes');
  });

  it('z cambia a "ces"; s y x no cambian; otra consonante suma "s"', () => {
    expect(saleUnitFor(2, 'luz')).toBe('luces');
    expect(saleUnitFor(2, 'lunes')).toBe('lunes');
    expect(saleUnitFor(2, 'tórax')).toBe('tórax');
    expect(saleUnitFor(2, 'kit')).toBe('kits');
  });

  it('una abreviatura no cambia', () => {
    expect(saleUnitFor(2, 'kg')).toBe('kg');
    expect(saleUnitFor(2, 'pza.')).toBe('pza.');
    expect(saleUnitFor(2, 'm2')).toBe('m2');
  });

  it('con varias palabras solo cambia la primera', () => {
    expect(saleUnitFor(3, 'tramo de 6 m')).toBe('tramos de 6 m');
    expect(saleUnitFor(1, 'tramo de 6 m')).toBe('tramo de 6 m');
  });
});
