import 'fake-indexeddb/auto';
import {
  addToTicket,
  asId,
  chargeCounterSale,
  closeCashShift,
  createPriceRegistry,
  createSyncEngine,
  defaultRules,
  EMPTY_TICKET,
  exponentialBackoff,
  fixedClock,
  money,
  openCashShift,
  outboxCashShiftStore,
  outboxCounterSaleStore,
  outboxPaymentStore,
  reconcileSales,
  reconcileShifts,
  seededRandom,
  type CashDeps,
  type CounterDeps,
  type QuoteActor,
  type SellableProduct,
  type Timer,
} from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { uuidIdGenerator } from '../uuid-id-generator';
import { dexieOperaciones } from './dexie-operaciones';
import { httpOperationTransport } from './http-operation-transport';
import { harness, nuevoDispositivo } from './servidor-de-pruebas';

// E3 (ventas) y E4 (tres personas cobrando) contra el servidor local real.

const registro = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) {
    throw new Error('registro de precios');
  }
  return r.value;
})();

const m = money(11_600);
if (!m.ok) {
  throw new Error('dinero');
}
const chapa: SellableProduct = {
  id: asId<'Product'>(crypto.randomUUID()),
  code: 'CH',
  name: 'Chapa de baño',
  categoryId: asId<'Category'>('c-1'),
  kind: 'STANDARD',
  chargeUnit: 'PIECE',
  listPrice: m.value,
  isTaxExempt: false,
  ruleId: 'PIECE',
  ruleParams: {},
};

function ticketDeChapas(cantidad: number) {
  const r = addToTicket(
    EMPTY_TICKET,
    chapa,
    {
      id: crypto.randomUUID(),
      widthMm: null,
      heightMm: null,
      quantity: cantidad,
      displayUnit: 'cm',
    },
    { registry: registro, taxRateBps: 1600 },
  );
  if (!r.ok) {
    throw new Error('ticket');
  }
  return r.value;
}

interface Tablet {
  readonly actor: QuoteActor;
  readonly deviceId: string;
  readonly counter: CounterDeps;
  readonly cash: CashDeps;
  readonly engine: ReturnType<typeof createSyncEngine>;
  readonly ventas: ReturnType<typeof outboxCounterSaleStore>;
  readonly outbox: ReturnType<typeof dexieOperaciones>;
  conectar(): void;
}

async function nuevaTablet(year: number, serie: number, conRed: boolean): Promise<Tablet> {
  let hayRed = conRed;
  const sinRedONormal: typeof fetch = (entrada, init) =>
    hayRed ? fetch(entrada, init) : Promise.reject(new TypeError('Failed to fetch'));
  const dispositivo = await nuevoDispositivo(sinRedONormal);
  const usuario = await harness.newUser(true);
  const reloj = fixedClock(new Date(`${String(year)}-06-15T18:00:00.000Z`));
  const outbox = dexieOperaciones({ clock: reloj, nombre: `ventas-${crypto.randomUUID()}` });
  const timer: Timer = { after: () => () => undefined };
  const engine = createSyncEngine({
    outbox,
    transport: httpOperationTransport(dispositivo.receiver),
    backoff: exponentialBackoff({ baseMs: 1000, factor: 2, capMs: 8000, jitter: 0 }),
    random: seededRandom(1),
    timer,
    clock: reloj,
    afterPass: async () => {
      await reconcileSales(outbox);
      await reconcileShifts(outbox);
    },
  });
  const turnos = outboxCashShiftStore(outbox);
  const pagos = outboxPaymentStore(outbox);
  const ventas = outboxCounterSaleStore(outbox);
  const comunes = {
    outbox,
    idGenerator: uuidIdGenerator,
    clock: reloj,
    device: { id: dispositivo.id, series: serie },
  };
  return {
    actor: { userId: asId<'User'>(usuario), role: 'STAFF' },
    deviceId: dispositivo.id,
    counter: {
      sales: ventas,
      payments: pagos,
      shifts: turnos,
      ...comunes,
      random: seededRandom(Math.floor(Math.random() * 2_000_000_000)),
    },
    cash: { shifts: turnos, payments: pagos, sales: ventas, ...comunes },
    engine,
    ventas,
    outbox,
    conectar: () => {
      hayRed = true;
    },
  };
}

describe('E3 · diez ventas sin conexión (servidor real)', () => {
  it('salen una sola vez, en orden, con folios consecutivos y el corte cuadra', async () => {
    const year = await harness.newYear();
    const tablet = await nuevaTablet(year, 1, false);
    const turno = await openCashShift(tablet.cash, tablet.actor, { openingFloatCents: 0 });
    expect(turno.ok).toBe(true);
    if (!turno.ok) {
      return;
    }
    const ids: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const r = await chargeCounterSale(tablet.counter, tablet.actor, {
        ticket: ticketDeChapas(1),
        customerId: null,
        rows: [
          i % 2 === 0
            ? { method: 'CASH', amountCents: 11_600, cashReceivedCents: 11_600 }
            : { method: 'TRANSFER', amountCents: 11_600 },
        ],
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        ids.push(r.value.sale.id);
      }
    }
    const corte = await closeCashShift(tablet.cash, tablet.actor, turno.value.id, 5 * 11_600);
    expect(corte.ok).toBe(true);

    await tablet.engine.trigger();
    expect((await harness.countsFor([tablet.deviceId])).operations).toBe(0);
    expect(tablet.engine.status().pending).toBe(12);

    tablet.conectar();
    await tablet.engine.trigger();
    expect(tablet.engine.status()).toMatchObject({ state: 'IDLE', pending: 0 });
    // Reenviar no duplica.
    await tablet.engine.trigger();
    expect((await harness.countsFor([tablet.deviceId])).operations).toBe(12);

    const locales = await tablet.ventas.list();
    const folios = ids.map((id) => locales.find((v) => v.id === id)?.folio);
    expect(folios).toEqual(
      Array.from({ length: 10 }, (_, n) => `V-${String(year)}-${String(n + 1).padStart(4, '0')}`),
    );
    for (const id of ids) {
      expect(await harness.saleState(id)).toMatchObject({ status: 'COMPLETED', paidCents: 11_600 });
    }
    expect(await harness.shiftState(turno.value.id)).toEqual({
      status: 'CLOSED',
      expectedCents: 5 * 11_600,
      differenceCents: 0,
    });
  }, 120_000);
});

describe('E4 · tres personas cobrando a la vez (servidor real)', () => {
  it('cada una con su turno y su corte; folios únicos y la suma cuadra', async () => {
    const year = await harness.newYear();
    const tablets = await Promise.all([
      nuevaTablet(year, 1, true),
      nuevaTablet(year, 2, true),
      nuevaTablet(year, 3, true),
    ]);
    const turnos = await Promise.all(
      tablets.map((t) => openCashShift(t.cash, t.actor, { openingFloatCents: 1_000 })),
    );
    const idsDeTurno = turnos.map((t) => (t.ok ? t.value.id : ''));
    expect(idsDeTurno.every((id) => id !== '')).toBe(true);

    // Cada persona hace 4 ventas en efectivo con tamaños distintos (1, 2, 3 y 4 chapas).
    await Promise.all(
      tablets.map(async (t) => {
        for (const n of [1, 2, 3, 4]) {
          const r = await chargeCounterSale(t.counter, t.actor, {
            ticket: ticketDeChapas(n),
            customerId: null,
            rows: [{ method: 'CASH', amountCents: 11_600 * n, cashReceivedCents: 11_600 * n }],
          });
          expect(r.ok).toBe(true);
        }
      }),
    );
    const cierres = await Promise.all(
      tablets.map((t, i) =>
        closeCashShift(t.cash, t.actor, idsDeTurno[i] ?? '', 1_000 + 11_600 * 10),
      ),
    );
    expect(cierres.every((c) => c.ok)).toBe(true);

    await Promise.all(tablets.map((t) => t.engine.trigger()));
    for (const t of tablets) {
      expect(t.engine.status()).toMatchObject({ state: 'IDLE', pending: 0 });
    }

    // Folios únicos entre las tres tablets, sin huecos: 12 ventas.
    const folios = (await Promise.all(tablets.map((t) => t.ventas.list())))
      .flat()
      .map((v) => v.folio)
      .sort();
    expect(new Set(folios).size).toBe(12);
    expect(folios).toEqual(
      Array.from({ length: 12 }, (_, n) => `V-${String(year)}-${String(n + 1).padStart(4, '0')}`),
    );

    // Cada turno cuadra solo con lo suyo.
    for (const id of idsDeTurno) {
      expect(await harness.shiftState(id)).toEqual({
        status: 'CLOSED',
        expectedCents: 1_000 + 11_600 * 10,
        differenceCents: 0,
      });
    }
  }, 120_000);
});
