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
  /** Clientes con ese teléfono (10 dígitos normalizados). */
  findByPhone(telefono: string): Promise<Result<readonly Customer[], CustomerError>>;
}
