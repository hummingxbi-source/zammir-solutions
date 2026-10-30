import type { CustomerId } from '../../../shared-kernel/id';
import { err, ok } from '../../../shared-kernel/result';
import type { Customer } from '../domain/customer';
import type { CustomerRepository } from './ports';

/** Adaptador en memoria del puerto CustomerRepository, para pruebas. */
export function inMemoryCustomers(): CustomerRepository {
  const clientes = new Map<CustomerId, Customer>();

  return {
    create(cliente) {
      clientes.set(cliente.id, cliente);
      return Promise.resolve(ok(cliente));
    },

    update(cliente) {
      if (!clientes.has(cliente.id)) {
        return Promise.resolve(err({ code: 'NOT_FOUND' }));
      }
      clientes.set(cliente.id, cliente);
      return Promise.resolve(ok(cliente));
    },

    get(id) {
      const cliente = clientes.get(id);
      return Promise.resolve(cliente === undefined ? err({ code: 'NOT_FOUND' }) : ok(cliente));
    },

    list: () => Promise.resolve(ok([...clientes.values()])),

    findByPhone: (telefono) =>
      Promise.resolve(ok([...clientes.values()].filter((c) => c.phone === telefono))),
  };
}
