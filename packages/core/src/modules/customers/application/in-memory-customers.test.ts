import { asId, sequentialIdGenerator } from '../../../shared-kernel/id';
import {
  clientesEnMemoriaDePrueba,
  customerRepositoryContract,
} from '../contracts/customer-repository.contract';

customerRepositoryContract('memoria', () => {
  const ids = sequentialIdGenerator('c');
  const { customers, auditLog } = clientesEnMemoriaDePrueba();
  let telefonos = 0;
  return {
    customers,
    nuevoId: () => asId<'Customer'>(ids.newId<'Customer'>()),
    telefonoNuevo: () => {
      telefonos += 1;
      return String(5_500_000_000 + telefonos);
    },
    bitacoraDe: (id) =>
      Promise.resolve(
        auditLog
          .entries()
          .filter((e) => e.entityId === id)
          .map((e) => ({ action: e.action, oldValue: e.oldValue, newValue: e.newValue })),
      ),
  };
});
