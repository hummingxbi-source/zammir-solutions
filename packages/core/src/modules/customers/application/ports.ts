import type { CustomerId } from '../../../shared-kernel/id';
import type { Result } from '../../../shared-kernel/result';
import type { Customer, CustomerError } from '../domain/customer';

/** Puerto: clientes. Nada se borra: los datos personales se anonimizan [RF-M5-05, RN-18].
 *  El teléfono NO es único: dos clientes pueden compartirlo y el sistema solo avisa [RF-M5-04]. */
export interface CustomerRepository {
  create(cliente: Customer): Promise<Result<Customer, CustomerError>>;
  update(cliente: Customer): Promise<Result<Customer, CustomerError>>;
  get(id: CustomerId): Promise<Result<Customer, CustomerError>>;
  list(): Promise<Result<readonly Customer[], CustomerError>>;
  /** Borra los datos personales del cliente y conserva su identificador y sus registros contables y
   *  fiscales [RF-M5-05, RN-18]. Deja su entrada de bitácora (sin datos personales) en el mismo paso.
   *  Anonimizar a uno ya anonimizado no cambia nada. */
  anonymize(id: CustomerId): Promise<Result<Customer, CustomerError>>;
  /** Clientes con ese teléfono (10 dígitos normalizados). */
  findByPhone(telefono: string): Promise<Result<readonly Customer[], CustomerError>>;
}
