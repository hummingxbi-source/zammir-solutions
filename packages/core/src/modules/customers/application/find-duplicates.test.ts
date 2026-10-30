import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import { err } from '../../../shared-kernel/result';
import { clienteDePrueba } from '../contracts/customer-repository.contract';
import { findPossibleDuplicates } from './find-duplicates';
import { inMemoryCustomers } from './in-memory-customers';

async function conAna() {
  const customers = inMemoryCustomers();
  const ana = clienteDePrueba(asId<'Customer'>('c-ana'), '5512345678', { name: 'Ana' });
  await customers.create(ana);
  return { customers, ana };
}

describe('findPossibleDuplicates', () => {
  it.each([
    '5512345678',
    '55 1234 5678',
    '55-1234-5678',
    '(55) 1234-5678',
    '+52 55 1234 5678',
    '52 5512345678',
  ])('avisa del cliente existente aunque el teléfono se escriba como %j', async (escrito) => {
    const { customers, ana } = await conAna();
    const r = await findPossibleDuplicates({ customers }, escrito);
    expect(r.ok && r.value.map((x) => x.id)).toEqual([ana.id]);
  });

  it('si el teléfono no está completo o no es válido, no hay nada que avisar', async () => {
    const { customers } = await conAna();
    for (const escrito of ['', '55123', 'abc', '123456789012345']) {
      const r = await findPossibleDuplicates({ customers }, escrito);
      expect(r.ok && r.value).toEqual([]);
    }
  });

  it('un teléfono que nadie tiene no avisa', async () => {
    const { customers } = await conAna();
    const r = await findPossibleDuplicates({ customers }, '5500000000');
    expect(r.ok && r.value).toEqual([]);
  });

  it('al editar a un cliente no se avisa de sí mismo', async () => {
    const { customers, ana } = await conAna();
    const r = await findPossibleDuplicates({ customers }, '5512345678', ana.id);
    expect(r.ok && r.value).toEqual([]);
  });

  it('avisa de todos los que comparten el teléfono', async () => {
    const { customers, ana } = await conAna();
    const otro = clienteDePrueba(asId<'Customer'>('c-otro'), '5512345678', {
      name: 'Ana (esposo)',
    });
    await customers.create(otro);
    const r = await findPossibleDuplicates({ customers }, '55 1234 5678', ana.id);
    expect(r.ok && r.value.map((x) => x.id)).toEqual([otro.id]);
  });

  it('un cliente anonimizado no cuenta como duplicado', async () => {
    const { customers } = await conAna();
    await customers.create(
      clienteDePrueba(asId<'Customer'>('c-anonimo'), '5598765432', {
        anonymizedAt: new Date('2026-10-30T12:00:00.000Z'),
      }),
    );
    const r = await findPossibleDuplicates({ customers }, '5598765432');
    expect(r.ok && r.value).toEqual([]);
  });

  it('si el almacén falla, devuelve ese error', async () => {
    const customers = {
      findByPhone: () => Promise.resolve(err({ code: 'CUSTOMERS_UNAVAILABLE' } as const)),
    };
    const r = await findPossibleDuplicates({ customers }, '5512345678');
    expect(!r.ok && r.error.code).toBe('CUSTOMERS_UNAVAILABLE');
  });
});
