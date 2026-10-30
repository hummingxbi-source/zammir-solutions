import type { CustomerId, IdGenerator } from '../../../shared-kernel/id';
import { err, type Result } from '../../../shared-kernel/result';
import type { Actor } from '../../identity/domain/auth';
import {
  buildCustomer,
  type Customer,
  type CustomerDraft,
  type CustomerError,
} from '../domain/customer';
import type { CustomerRepository } from './ports';

export interface ManageCustomersDeps {
  readonly customers: CustomerRepository;
  readonly idGenerator: IdGenerator;
}

/** Cualquier persona del mostrador (administrador o cajero) captura y corrige clientes; la sesión de la
 *  tablet sin persona, o quien no ha entrado, no. */
function sinPersona(actor: Actor): boolean {
  return actor.role !== 'ADMIN' && actor.role !== 'STAFF';
}

/** Da de alta a un cliente. Solo nombre y WhatsApp son obligatorios [RF-M5-01]. */
export function createCustomer(
  deps: ManageCustomersDeps,
  actor: Actor,
  borrador: CustomerDraft,
): Promise<Result<Customer, CustomerError>> {
  if (sinPersona(actor)) {
    return Promise.resolve(err({ code: 'NOT_AUTHORIZED' }));
  }
  const cliente = buildCustomer(deps.idGenerator.newId<'Customer'>(), borrador);
  return cliente.ok ? deps.customers.create(cliente.value) : Promise.resolve(cliente);
}

/** Corrige los datos de un cliente. Uno anonimizado ya no se edita [RF-M5-05]. */
export async function updateCustomer(
  deps: Pick<ManageCustomersDeps, 'customers'>,
  actor: Actor,
  id: CustomerId,
  borrador: CustomerDraft,
): Promise<Result<Customer, CustomerError>> {
  if (sinPersona(actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const actual = await deps.customers.get(id);
  if (!actual.ok) {
    return actual;
  }
  if (actual.value.anonymizedAt !== null) {
    return err({ code: 'ANONYMIZED' });
  }
  const cliente = buildCustomer(id, borrador);
  return cliente.ok ? deps.customers.update(cliente.value) : cliente;
}
