import { describe, expect, it } from 'vitest';

import { searchCustomers } from './search';

function c(name: string, phone: string, email: string | null = null) {
  return { name, phone, email };
}

const clientes = [
  c('Ana López', '5512345678', 'ana@ejemplo.invalid'),
  c('Juan Pérez', '5598765432'),
  c('María Ángeles Ruiz', '5511112222', 'maria@ejemplo.invalid'),
  c('Luis Anaya', '7771234567'),
];

function nombres(resultado: readonly { name: string }[]): string[] {
  return resultado.map((r) => r.name);
}

describe('searchCustomers', () => {
  it('encuentra por nombre parcial, sin acentos ni mayúsculas', () => {
    expect(nombres(searchCustomers(clientes, 'lopez'))).toEqual(['Ana López']);
    expect(nombres(searchCustomers(clientes, 'PÉREZ'))).toEqual(['Juan Pérez']);
    expect(nombres(searchCustomers(clientes, 'angel'))).toEqual(['María Ángeles Ruiz']);
  });

  it('un nombre parcial al principio sale antes que uno que lo trae en medio', () => {
    expect(nombres(searchCustomers(clientes, 'ana'))).toEqual(['Ana López', 'Luis Anaya']);
  });

  it('varias palabras se combinan con "y"', () => {
    expect(nombres(searchCustomers(clientes, 'maria ruiz'))).toEqual(['María Ángeles Ruiz']);
    expect(searchCustomers(clientes, 'ana ruiz')).toEqual([]);
  });

  it('encuentra por teléfono parcial, escrito de cualquier forma', () => {
    expect(nombres(searchCustomers(clientes, '98765'))).toEqual(['Juan Pérez']);
    expect(nombres(searchCustomers(clientes, '5512345678'))).toEqual(['Ana López']);
    expect(nombres(searchCustomers(clientes, '55-1234'))).toEqual(['Ana López']);
    expect(nombres(searchCustomers(clientes, '(55)'))).toHaveLength(3);
  });

  it('también por correo', () => {
    expect(nombres(searchCustomers(clientes, 'maria@'))).toEqual(['María Ángeles Ruiz']);
  });

  it('sin texto devuelve todos, ordenados por nombre', () => {
    expect(nombres(searchCustomers(clientes, '   '))).toEqual([
      'Ana López',
      'Juan Pérez',
      'Luis Anaya',
      'María Ángeles Ruiz',
    ]);
  });

  it('lo que no coincide con nadie da una lista vacía y no modifica la original', () => {
    const copia = [...clientes];
    expect(searchCustomers(clientes, 'zzzz')).toEqual([]);
    expect(clientes).toEqual(copia);
  });

  it('un número no se busca en el nombre por accidente ni al revés', () => {
    expect(searchCustomers([c('Cliente 2', '5500000000')], '2')).toHaveLength(1);
    expect(searchCustomers([c('Pedro', '5500000000')], '99')).toEqual([]);
  });
});
