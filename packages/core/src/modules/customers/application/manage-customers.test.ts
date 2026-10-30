import { describe, expect, it } from 'vitest';

import { asId, sequentialIdGenerator } from '../../../shared-kernel/id';
import {
  clienteDePrueba,
  clientesEnMemoriaDePrueba,
} from '../contracts/customer-repository.contract';
import { NO_FISCAL_PROFILE, type CustomerDraft } from '../domain/customer';
import { createCustomer, updateCustomer } from './manage-customers';

const borrador: CustomerDraft = {
  name: 'Ana López',
  phone: '55 1234 5678',
  email: null,
  notes: null,
  fiscal: NO_FISCAL_PROFILE,
  privacyNoticeVersion: null,
};

function entorno() {
  const { customers } = clientesEnMemoriaDePrueba();
  return { customers, idGenerator: sequentialIdGenerator('c') };
}

describe('createCustomer', () => {
  it.each(['ADMIN', 'STAFF'] as const)('%s da de alta a un cliente', async (role) => {
    const deps = entorno();
    const r = await createCustomer(deps, { role }, borrador);
    expect(r.ok && r.value).toMatchObject({ id: 'c-0001', name: 'Ana López', phone: '5512345678' });
    const lista = await deps.customers.list();
    expect(lista.ok && lista.value).toHaveLength(1);
  });

  it.each(['DEVICE', null] as const)('%s no puede dar de alta clientes', async (role) => {
    const deps = entorno();
    const r = await createCustomer(deps, { role }, borrador);
    expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
    const lista = await deps.customers.list();
    expect(lista.ok && lista.value).toEqual([]);
  });

  it.each([
    ['sin nombre', { name: '' }, 'NAME_REQUIRED'],
    ['sin WhatsApp', { phone: '' }, 'PHONE_INVALID'],
    ['con teléfono de 9 dígitos', { phone: '551234567' }, 'PHONE_INVALID'],
  ] as const)('un cliente %s no se guarda', async (_caso, cambio, codigo) => {
    const deps = entorno();
    const r = await createCustomer(deps, { role: 'STAFF' }, { ...borrador, ...cambio });
    expect(!r.ok && r.error.code).toBe(codigo);
    const lista = await deps.customers.list();
    expect(lista.ok && lista.value).toEqual([]);
  });
});

describe('updateCustomer', () => {
  it('corrige los datos de un cliente validándolos', async () => {
    const deps = entorno();
    const alta = await createCustomer(deps, { role: 'STAFF' }, borrador);
    if (!alta.ok) throw new Error('alta');
    const r = await updateCustomer(deps, { role: 'STAFF' }, alta.value.id, {
      ...borrador,
      name: 'Ana María López',
    });
    expect(r.ok && r.value.name).toBe('Ana María López');
    const malo = await updateCustomer(deps, { role: 'STAFF' }, alta.value.id, {
      ...borrador,
      phone: '123',
    });
    expect(!malo.ok && malo.error.code).toBe('PHONE_INVALID');
  });

  it('un cliente que no existe se reporta', async () => {
    const r = await updateCustomer(entorno(), { role: 'ADMIN' }, asId<'Customer'>('x'), borrador);
    expect(!r.ok && r.error.code).toBe('NOT_FOUND');
  });

  it.each(['DEVICE', null] as const)('%s no puede editar', async (role) => {
    const deps = entorno();
    const alta = await createCustomer(deps, { role: 'ADMIN' }, borrador);
    if (!alta.ok) throw new Error('alta');
    const r = await updateCustomer(deps, { role }, alta.value.id, { ...borrador, name: 'Otro' });
    expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
  });

  it('un cliente anonimizado ya no se edita', async () => {
    const deps = entorno();
    const id = asId<'Customer'>('c-anonimo');
    await deps.customers.create(
      clienteDePrueba(id, '5500000000', { anonymizedAt: new Date('2026-10-30T12:00:00.000Z') }),
    );
    const r = await updateCustomer(deps, { role: 'ADMIN' }, id, borrador);
    expect(!r.ok && r.error.code).toBe('ANONYMIZED');
  });
});
