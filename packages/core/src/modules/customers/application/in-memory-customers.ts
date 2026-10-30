import type { Clock } from '../../../shared-kernel/clock';
import type { CustomerId, IdGenerator } from '../../../shared-kernel/id';
import { err, ok } from '../../../shared-kernel/result';
import type { InMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { recordAuditEntry } from '../../audit/application/record-audit-entry';
import { NO_FISCAL_PROFILE, type Customer } from '../domain/customer';
import type { CustomerRepository } from './ports';

export interface InMemoryCustomersDeps {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly auditLog: InMemoryAuditLog;
}

/** Texto que sustituye al nombre de un cliente anonimizado. */
export const ANONYMIZED_NAME = 'Cliente anonimizado';
/** Teléfono que sustituye al de un cliente anonimizado: la tabla exige 10 dígitos y el aviso de duplicados
 *  ignora a los anonimizados. */
export const ANONYMIZED_PHONE = '0000000000';

/** Adaptador en memoria del puerto CustomerRepository, para pruebas. */
export function inMemoryCustomers(deps: InMemoryCustomersDeps): CustomerRepository {
  const clientes = new Map<CustomerId, Customer>();

  return {
    create(cliente) {
      clientes.set(cliente.id, cliente);
      return Promise.resolve(ok(cliente));
    },

    update(cliente) {
      const actual = clientes.get(cliente.id);
      if (actual === undefined) {
        return Promise.resolve(err({ code: 'NOT_FOUND' }));
      }
      if (actual.anonymizedAt !== null) {
        return Promise.resolve(err({ code: 'ANONYMIZED' }));
      }
      clientes.set(cliente.id, cliente);
      return Promise.resolve(ok(cliente));
    },

    async anonymize(id) {
      const actual = clientes.get(id);
      if (actual === undefined) {
        return err({ code: 'NOT_FOUND' });
      }
      if (actual.anonymizedAt !== null) {
        return ok(actual);
      }
      const anonimo: Customer = {
        id,
        name: ANONYMIZED_NAME,
        phone: ANONYMIZED_PHONE,
        email: null,
        notes: null,
        fiscal: NO_FISCAL_PROFILE,
        privacyNoticeVersion: actual.privacyNoticeVersion,
        anonymizedAt: deps.clock.now(),
      };
      clientes.set(id, anonimo);
      // La bitácora no guarda ningún dato personal: solo que se anonimizó.
      await recordAuditEntry(
        { auditLog: deps.auditLog, clock: deps.clock, idGenerator: deps.idGenerator },
        {
          userId: null,
          deviceId: null,
          action: 'CUSTOMER_ANONYMIZED',
          entityType: 'customer',
          entityId: id,
          oldValue: { anonimizado: false },
          newValue: { anonimizado: true },
        },
      );
      return ok(anonimo);
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
