import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import {
  clienteDePrueba,
  clientesEnMemoriaDePrueba,
} from '../contracts/customer-repository.contract';
import { anonymizeCustomer } from './manage-customers';

async function conCliente() {
  const { customers, auditLog } = clientesEnMemoriaDePrueba();
  const id = asId<'Customer'>('c-1');
  await customers.create(clienteDePrueba(id, '5512345678'));
  return { customers, auditLog, id };
}

describe('anonymizeCustomer', () => {
  it('un administrador anonimiza a un cliente y queda la bitácora', async () => {
    const { customers, auditLog, id } = await conCliente();
    const r = await anonymizeCustomer({ customers }, { role: 'ADMIN' }, id);
    expect(r.ok && r.value.anonymizedAt).not.toBeNull();
    expect(auditLog.entries().map((e) => e.action)).toEqual(['CUSTOMER_ANONYMIZED']);
  });

  it.each(['STAFF', 'DEVICE', null] as const)('%s no puede anonimizar', async (role) => {
    const { customers, auditLog, id } = await conCliente();
    const r = await anonymizeCustomer({ customers }, { role }, id);
    expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
    const sigue = await customers.get(id);
    expect(sigue.ok && sigue.value.anonymizedAt).toBeNull();
    expect(auditLog.entries()).toEqual([]);
  });
});
