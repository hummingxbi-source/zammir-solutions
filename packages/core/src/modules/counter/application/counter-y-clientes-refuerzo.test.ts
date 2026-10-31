import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId } from '../../../shared-kernel/id';
import { money } from '../../../shared-kernel/money/money';
import { seededRandom } from '../../../shared-kernel/random';
import { err, ok } from '../../../shared-kernel/result';
import { createPriceRegistry, defaultRules } from '../../catalog/domain/pricing/registry';
import {
  CUSTOMER_REPLICA_PAGE_SIZE,
  outboxCustomers,
  refreshCustomers,
  type CustomerReplicaSource,
  type ReplicatedCustomer,
} from '../../customers/application/outbox-customers';
import { buildCustomer, NO_FISCAL_PROFILE } from '../../customers/domain/customer';
import { outboxPaymentStore } from '../../orders/application/work-order-store';
import type { QuoteActor } from '../../quotes/application/quote-use-cases';
import type { QuoteProduct } from '../../quotes/domain/quote-line';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import { addToTicket, EMPTY_TICKET } from '../domain/ticket';
import type { CounterSale } from '../domain/counter-sale';
import { outboxCounterSaleStore } from './counter-sale-store';
import { activeSales, chargeCounterSale, type CounterDeps } from './counter-use-cases';

// Refuerzo de pruebas del mostrador y de los clientes de la tablet: qué viaja exactamente en cada
// operación y cómo se protegen los cambios locales cuando llegan datos del servidor.

const CLIENTE = asId<'Customer'>('00000000-0000-4000-8000-00000000c001');
const cajero: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
  role: 'STAFF',
};

let contador = 0;
const ids = {
  newId: <E extends string>() => {
    contador += 1;
    return asId<E>(`00000000-0000-4000-8000-${String(contador + 5000).padStart(12, '0')}`);
  },
};

const registro = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) {
    throw new Error('registro');
  }
  return r.value;
})();
const precio = (c: number) => {
  const r = money(c);
  if (!r.ok) {
    throw new Error('dinero');
  }
  return r.value;
};
const chapa: QuoteProduct = {
  id: asId<'Product'>('00000000-0000-4000-8000-0000000000e1'),
  name: 'Chapa de baño',
  chargeUnit: 'PIECE',
  listPrice: precio(11_600),
  isTaxExempt: false,
  ruleId: 'PIECE',
  ruleParams: {},
};

function entornoMostrador() {
  const reloj = fixedClock(new Date('2026-10-31T18:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const deps: CounterDeps = {
    sales: outboxCounterSaleStore(outbox),
    payments: outboxPaymentStore(outbox),
    outbox,
    idGenerator: ids,
    clock: reloj,
    random: seededRandom(77),
    device: { id: '00000000-0000-4000-8000-0000000000d1', series: 1 },
  };
  const t = addToTicket(
    EMPTY_TICKET,
    chapa,
    { id: ids.newId<'Line'>(), widthMm: null, heightMm: null, quantity: 1, displayUnit: 'cm' },
    { registry: registro, taxRateBps: 1600 },
  );
  if (!t.ok) {
    throw new Error('ticket');
  }
  return { deps, outbox, ticket: t.value };
}

describe('lo que viaja en la operación de una venta', () => {
  it('con cliente lo lleva; sin cliente no inventa uno', async () => {
    const con = entornoMostrador();
    await chargeCounterSale(con.deps, cajero, {
      ticket: con.ticket,
      customerId: CLIENTE,
      rows: [{ method: 'TRANSFER', amountCents: 11_600 }],
    });
    const payloadCon = (await con.outbox.list())[0]?.envelope.payload as Record<string, unknown>;
    expect(payloadCon.customerId).toBe(CLIENTE);
    const sin = entornoMostrador();
    await chargeCounterSale(sin.deps, cajero, {
      ticket: sin.ticket,
      customerId: null,
      rows: [{ method: 'TRANSFER', amountCents: 11_600 }],
    });
    const payloadSin = (await sin.outbox.list())[0]?.envelope.payload as Record<string, unknown>;
    expect('customerId' in payloadSin).toBe(false);
  });

  it('cada forma de pago lleva lo suyo: efectivo con lo recibido, transferencia con su referencia', async () => {
    const e = entornoMostrador();
    await chargeCounterSale(e.deps, cajero, {
      ticket: e.ticket,
      customerId: null,
      rows: [
        { method: 'CASH', amountCents: 5_000, cashReceivedCents: 6_000 },
        { method: 'TRANSFER', amountCents: 6_600, reference: 'SPEI 77' },
      ],
    });
    const filas = (
      (await e.outbox.list())[0]?.envelope.payload as {
        payment: { rows: Record<string, unknown>[] };
      }
    ).payment.rows;
    expect(filas[0]).toMatchObject({
      method: 'CASH',
      amountCents: 5_000,
      cashReceivedCents: 6_000,
    });
    expect('reference' in (filas[0] ?? {})).toBe(false);
    expect(filas[1]).toMatchObject({
      method: 'TRANSFER',
      amountCents: 6_600,
      reference: 'SPEI 77',
    });
    expect('cashReceivedCents' in (filas[1] ?? {})).toBe(false);
  });

  it('una transferencia sin referencia no la inventa', async () => {
    const e = entornoMostrador();
    await chargeCounterSale(e.deps, cajero, {
      ticket: e.ticket,
      customerId: null,
      rows: [{ method: 'TRANSFER', amountCents: 11_600 }],
    });
    const fila = (
      (await e.outbox.list())[0]?.envelope.payload as {
        payment: { rows: Record<string, unknown>[] };
      }
    ).payment.rows[0];
    expect('reference' in (fila ?? {})).toBe(false);
  });

  it('cada línea lleva su regla de precio y su unidad de captura', async () => {
    const e = entornoMostrador();
    await chargeCounterSale(e.deps, cajero, {
      ticket: e.ticket,
      customerId: null,
      rows: [{ method: 'TRANSFER', amountCents: 11_600 }],
    });
    const linea = (
      (await e.outbox.list())[0]?.envelope.payload as { lines: Record<string, unknown>[] }
    ).lines[0];
    expect(linea).toMatchObject({
      ruleId: 'PIECE',
      ruleParams: {},
      displayUnit: 'cm',
      quantity: 1,
    });
  });

  it('las ventas activas son solo las completadas', () => {
    const v = (status: string) => ({ id: status, status }) as unknown as CounterSale;
    expect(
      activeSales([v('COMPLETED'), v('CANCELLED'), v('COMPLETED')]).map((x) => x.status),
    ).toEqual(['COMPLETED', 'COMPLETED']);
    expect(activeSales([])).toEqual([]);
  });
});

function entornoClientes() {
  const reloj = fixedClock(new Date('2026-10-31T18:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const clientes = outboxCustomers({
    outbox,
    clock: reloj,
    idGenerator: ids,
    device: { id: '00000000-0000-4000-8000-0000000000d1' },
    currentUserId: () => cajero.userId,
  });
  return { outbox, clientes };
}

function replicado(n: number, cambios: Partial<ReplicatedCustomer> = {}): ReplicatedCustomer {
  return {
    id: `00000000-0000-4000-8000-${String(n + 20000).padStart(12, '0')}`,
    name: `Cliente ${String(n)}`,
    phone: '5512345678',
    email: null,
    notes: null,
    privacyNoticeVersion: null,
    anonymizedAt: null,
    changeSeq: n,
    ...cambios,
  };
}

const fuente = (todos: ReplicatedCustomer[]): CustomerReplicaSource & { desde: number[] } => {
  const desde: number[] = [];
  return {
    desde,
    changedAfter: (seq, limit) => {
      desde.push(seq);
      return Promise.resolve(ok(todos.filter((c) => c.changeSeq > seq).slice(0, limit)));
    },
  };
};

describe('clientes de la tablet · protección de lo local', () => {
  it('un cliente que no está en la tablet no se encuentra', async () => {
    const { clientes } = entornoClientes();
    expect(await clientes.get(asId<'Customer'>('nadie'))).toEqual(err({ code: 'NOT_FOUND' }));
  });

  it('uno anonimizado en el servidor ya no se corrige desde la tablet', async () => {
    const { outbox, clientes } = entornoClientes();
    const c = replicado(1, { anonymizedAt: '2026-10-30T00:00:00.000Z' });
    await refreshCustomers({ source: fuente([c]), outbox });
    const base = buildCustomer(asId<'Customer'>(c.id), {
      name: 'Nuevo nombre',
      phone: '5512345678',
      email: null,
      notes: null,
      fiscal: NO_FISCAL_PROFILE,
      privacyNoticeVersion: null,
    });
    if (!base.ok) {
      throw new Error('cliente');
    }
    expect(await clientes.update(base.value)).toEqual(err({ code: 'ANONYMIZED' }));
    expect(await outbox.list()).toHaveLength(0);
  });

  it('buscar por teléfono trae solo a quienes lo comparten', async () => {
    const { outbox, clientes } = entornoClientes();
    await refreshCustomers({
      source: fuente([replicado(1), replicado(2, { phone: '5599999999' }), replicado(3)]),
      outbox,
    });
    const r = await clientes.findByPhone('5599999999');
    expect(r.ok && r.value.map((x) => x.name)).toEqual(['Cliente 2']);
    const ninguno = await clientes.findByPhone('0000000000');
    expect(ninguno.ok && ninguno.value).toEqual([]);
  });

  it('un cambio pendiente de OTRO tipo no impide actualizar al cliente', async () => {
    const { outbox, clientes } = entornoClientes();
    const c = replicado(1);
    await refreshCustomers({ source: fuente([c]), outbox });
    await outbox.transaction(async (tx) => {
      await tx.enqueue({
        opId: '00000000-0000-4000-8000-0000000000c1',
        deviceId: '00000000-0000-4000-8000-0000000000d1',
        type: 'UpdateWorkOrder',
        schemaVersion: 1,
        userId: cajero.userId,
        clientCreatedAt: '2026-10-31T19:00:00.000Z',
        payload: { id: c.id, patch: { notes: 'x' } },
      });
    });
    await refreshCustomers({
      source: fuente([replicado(1, { name: 'Del servidor', changeSeq: 9 })]),
      outbox,
    });
    const leido = await clientes.get(asId<'Customer'>(c.id));
    expect(leido.ok && leido.value.name).toBe('Del servidor');
  });

  it('con más clientes que una página sigue pidiendo hasta terminar', async () => {
    const { outbox, clientes } = entornoClientes();
    const total = CUSTOMER_REPLICA_PAGE_SIZE + 3;
    const todos = Array.from({ length: total }, (_, i) => replicado(i + 1));
    const origen = fuente(todos);
    const r = await refreshCustomers({ source: origen, outbox });
    expect(r).toEqual(ok({ received: total }));
    const lista = await clientes.list();
    expect(lista.ok && lista.value).toHaveLength(total);
    expect(origen.desde).toEqual([0, CUSTOMER_REPLICA_PAGE_SIZE]);
  });

  it('una página justo del tamaño pide una más y una vacía no cambia el cursor', async () => {
    const { outbox } = entornoClientes();
    const todos = Array.from({ length: CUSTOMER_REPLICA_PAGE_SIZE }, (_, i) => replicado(i + 1));
    const origen = fuente(todos);
    await refreshCustomers({ source: origen, outbox });
    expect(origen.desde).toEqual([0, CUSTOMER_REPLICA_PAGE_SIZE]);
    const otra = fuente([]);
    await refreshCustomers({ source: otra, outbox });
    expect(otra.desde).toEqual([CUSTOMER_REPLICA_PAGE_SIZE]);
  });

  it('el cursor avanza al número más alto de la página aunque lleguen desordenados', async () => {
    const { outbox } = entornoClientes();
    const desordenados = [replicado(5), replicado(2), replicado(9), replicado(4)];
    const origen: CustomerReplicaSource & { desde: number[] } = {
      desde: [],
      changedAfter: (seq, limit) => {
        origen.desde.push(seq);
        return Promise.resolve(ok(desordenados.filter((c) => c.changeSeq > seq).slice(0, limit)));
      },
    };
    await refreshCustomers({ source: origen, outbox });
    await refreshCustomers({ source: origen, outbox });
    expect(origen.desde).toEqual([0, 9]);
  });
});
