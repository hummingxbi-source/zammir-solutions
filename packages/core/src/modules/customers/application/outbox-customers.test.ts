import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId } from '../../../shared-kernel/id';
import { err, ok } from '../../../shared-kernel/result';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import { buildCustomer, NO_FISCAL_PROFILE, type CustomerDraft } from '../domain/customer';
import {
  outboxCustomers,
  refreshCustomers,
  type CustomerReplicaSource,
  type ReplicatedCustomer,
} from './outbox-customers';

const DISPOSITIVO = '00000000-0000-4000-8000-0000000000d1';
const PERSONA = '00000000-0000-4000-8000-00000000a001';

let contador = 0;
const ids = {
  newId: <E extends string>() => {
    contador += 1;
    return asId<E>(`00000000-0000-4000-8000-${String(contador).padStart(12, '0')}`);
  },
};

function entorno(persona: string | null = PERSONA) {
  const clock = fixedClock(new Date('2026-10-31T15:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock });
  const clientes = outboxCustomers({
    outbox,
    clock,
    idGenerator: ids,
    device: { id: DISPOSITIVO },
    currentUserId: () => persona,
  });
  return { outbox, clientes };
}

const borrador: CustomerDraft = {
  name: 'Obra de prueba',
  phone: '5512345678',
  email: null,
  notes: null,
  fiscal: NO_FISCAL_PROFILE,
  privacyNoticeVersion: 3,
};

function construir(id: string, cambios: Partial<CustomerDraft> = {}) {
  const c = buildCustomer(asId<'Customer'>(id), { ...borrador, ...cambios });
  if (!c.ok) {
    throw new Error('cliente de prueba inválido');
  }
  return c.value;
}

const ID1 = '00000000-0000-4000-8000-0000000c0001';

describe('clientes de la tablet (sin internet)', () => {
  it('un alta queda guardada en la tablet y encolada como UpsertCustomer en el mismo paso', async () => {
    const { outbox, clientes } = entorno();
    const r = await clientes.create(construir(ID1));
    expect(r.ok).toBe(true);
    const lista = await clientes.list();
    expect(lista.ok && lista.value.map((c) => c.name)).toEqual(['Obra de prueba']);
    const cola = await outbox.list();
    expect(cola).toHaveLength(1);
    expect(cola[0]?.envelope.type).toBe('UpsertCustomer');
    expect(cola[0]?.envelope.userId).toBe(PERSONA);
    expect(cola[0]?.status).toBe('PENDING');
  });

  it('sin persona activa no guarda ni encola nada', async () => {
    const { outbox, clientes } = entorno(null);
    expect(await clientes.create(construir(ID1))).toEqual(err({ code: 'NOT_AUTHORIZED' }));
    expect(await outbox.list()).toHaveLength(0);
    const lista = await clientes.list();
    expect(lista.ok && lista.value).toHaveLength(0);
  });

  it('corregir a un cliente encola otra operación y conserva su identificador', async () => {
    const { outbox, clientes } = entorno();
    await clientes.create(construir(ID1));
    const r = await clientes.update(construir(ID1, { name: 'Nombre corregido' }));
    expect(r.ok).toBe(true);
    const leido = await clientes.get(asId<'Customer'>(ID1));
    expect(leido.ok && leido.value.name).toBe('Nombre corregido');
    expect(await outbox.list()).toHaveLength(2);
  });

  it('corregir a uno que no existe en la tablet es NOT_FOUND y no encola', async () => {
    const { outbox, clientes } = entorno();
    expect(await clientes.update(construir(ID1))).toEqual(err({ code: 'NOT_FOUND' }));
    expect(await outbox.list()).toHaveLength(0);
  });

  it('busca por teléfono sobre lo guardado en la tablet', async () => {
    const { clientes } = entorno();
    await clientes.create(construir(ID1));
    await clientes.create(construir('00000000-0000-4000-8000-0000000c0002', { name: 'Otro' }));
    const r = await clientes.findByPhone('5512345678');
    expect(r.ok && r.value).toHaveLength(2);
  });

  it('anonimizar no se ofrece desde la tablet', async () => {
    const { clientes } = entorno();
    await clientes.create(construir(ID1));
    expect(await clientes.anonymize(asId<'Customer'>(ID1))).toEqual(
      err({ code: 'CUSTOMERS_UNAVAILABLE' }),
    );
  });
});

function fuente(todos: readonly ReplicatedCustomer[]): CustomerReplicaSource {
  return {
    changedAfter: (seq, limit) =>
      Promise.resolve(ok(todos.filter((c) => c.changeSeq > seq).slice(0, limit))),
  };
}

function replicado(id: string, changeSeq: number, name = 'Del servidor'): ReplicatedCustomer {
  return {
    id,
    name,
    phone: '5598765432',
    email: null,
    notes: null,
    privacyNoticeVersion: 1,
    anonymizedAt: null,
    changeSeq,
  };
}

describe('réplica de clientes', () => {
  it('baja los clientes nuevos y la siguiente vez solo pide lo que cambió después', async () => {
    const { outbox, clientes } = entorno();
    const todos = [replicado(ID1, 1), replicado('00000000-0000-4000-8000-0000000c0002', 2)];
    const r = await refreshCustomers({ source: fuente(todos), outbox });
    expect(r).toEqual(ok({ received: 2 }));
    const lista = await clientes.list();
    expect(lista.ok && lista.value).toHaveLength(2);
    expect(await refreshCustomers({ source: fuente(todos), outbox })).toEqual(ok({ received: 0 }));
  });

  it('un cambio que aún no salió de la tablet no se sobrescribe con la versión del servidor', async () => {
    const { outbox, clientes } = entorno();
    await clientes.create(construir(ID1, { name: 'Capturado en la tablet' }));
    await refreshCustomers({ source: fuente([replicado(ID1, 5, 'Viejo del servidor')]), outbox });
    const leido = await clientes.get(asId<'Customer'>(ID1));
    expect(leido.ok && leido.value.name).toBe('Capturado en la tablet');
  });

  it('un cliente que ya salió se actualiza con lo que dice el servidor', async () => {
    const { outbox, clientes } = entorno();
    await clientes.create(construir(ID1, { name: 'Capturado en la tablet' }));
    const op = (await outbox.list())[0];
    await outbox.markApplied(op?.envelope.opId ?? '', { ok: true, status: 'APPLIED' });
    await refreshCustomers({
      source: fuente([replicado(ID1, 5, 'Corregido en otra tablet')]),
      outbox,
    });
    const leido = await clientes.get(asId<'Customer'>(ID1));
    expect(leido.ok && leido.value.name).toBe('Corregido en otra tablet');
  });

  it('si el servidor no responde, lo guardado se queda y el error se informa', async () => {
    const { outbox, clientes } = entorno();
    await clientes.create(construir(ID1));
    const r = await refreshCustomers({
      source: { changedAfter: () => Promise.resolve(err({ code: 'CUSTOMERS_UNAVAILABLE' })) },
      outbox,
    });
    expect(r).toEqual(err({ code: 'CUSTOMERS_UNAVAILABLE' }));
    const lista = await clientes.list();
    expect(lista.ok && lista.value).toHaveLength(1);
  });

  it('no baja datos fiscales: el cliente local siempre los tiene vacíos', async () => {
    const { outbox, clientes } = entorno();
    await refreshCustomers({ source: fuente([replicado(ID1, 1)]), outbox });
    const leido = await clientes.get(asId<'Customer'>(ID1));
    expect(leido.ok && leido.value.fiscal).toEqual(NO_FISCAL_PROFILE);
  });
});
