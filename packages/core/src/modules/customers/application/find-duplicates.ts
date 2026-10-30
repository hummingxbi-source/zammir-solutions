import type { CustomerId } from '../../../shared-kernel/id';
import { normalizePhone } from '../../../shared-kernel/phone';
import { ok, type Result } from '../../../shared-kernel/result';
import type { Customer, CustomerError } from '../domain/customer';
import type { CustomerRepository } from './ports';

/** Clientes que ya tienen este teléfono, escrito como se haya escrito (con espacios, guiones o `+52`)
 *  [RF-M5-04]. Sirve para AVISAR del posible duplicado, no para bloquear: dos personas pueden compartir
 *  teléfono. Si el teléfono todavía no está completo, no hay nada que comparar. `exceptId` deja fuera al
 *  cliente que se está editando; los anonimizados no cuentan. */
export async function findPossibleDuplicates(
  deps: { readonly customers: Pick<CustomerRepository, 'findByPhone'> },
  telefono: string,
  exceptId?: CustomerId,
): Promise<Result<readonly Customer[], CustomerError>> {
  const normalizado = normalizePhone(telefono);
  if (!normalizado.ok) {
    return ok([]);
  }
  const encontrados = await deps.customers.findByPhone(normalizado.value);
  if (!encontrados.ok) {
    return encontrados;
  }
  return ok(encontrados.value.filter((c) => c.id !== exceptId && c.anonymizedAt === null));
}
