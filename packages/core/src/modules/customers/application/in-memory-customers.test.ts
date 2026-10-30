import { asId, sequentialIdGenerator } from '../../../shared-kernel/id';
import { customerRepositoryContract } from '../contracts/customer-repository.contract';
import { inMemoryCustomers } from './in-memory-customers';

customerRepositoryContract('memoria', () => {
  const ids = sequentialIdGenerator('c');
  let telefonos = 0;
  return {
    customers: inMemoryCustomers(),
    nuevoId: () => asId<'Customer'>(ids.newId<'Customer'>()),
    telefonoNuevo: () => {
      telefonos += 1;
      return String(5_500_000_000 + telefonos);
    },
  };
});
