import { describe, expect, it } from 'vitest';

import { asId, sequentialIdGenerator, type CustomerId, type WorkOrderId } from './id';

describe('sequentialIdGenerator', () => {
  it('es determinista: id-0001, id-0002…', () => {
    const generador = sequentialIdGenerator();
    expect(generador.newId<'Customer'>()).toBe('id-0001');
    expect(generador.newId<'Customer'>()).toBe('id-0002');
  });

  it('acepta un prefijo', () => {
    const generador = sequentialIdGenerator('cli');
    expect(generador.newId<'Customer'>()).toBe('cli-0001');
  });

  it('dos generadores nuevos producen la misma secuencia', () => {
    expect(sequentialIdGenerator().newId<'Quote'>()).toBe(sequentialIdGenerator().newId<'Quote'>());
  });
});

describe('identificadores con nombre', () => {
  it('asId conserva el texto', () => {
    expect(asId<'Customer'>('abc')).toBe('abc');
  });

  it('el id de un cliente no se puede usar donde va el de una orden', () => {
    const cliente: CustomerId = asId<'Customer'>('c-1');
    // @ts-expect-error un CustomerId no es un WorkOrderId: esta línea debe fallar al compilar.
    const orden: WorkOrderId = cliente;
    expect(orden).toBe('c-1');
  });
});
