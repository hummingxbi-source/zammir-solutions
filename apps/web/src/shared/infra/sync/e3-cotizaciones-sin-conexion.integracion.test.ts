import 'fake-indexeddb/auto';
import {
  addQuoteLine,
  asId,
  createCustomer,
  createPriceRegistry,
  createQuoteDraft,
  createSyncEngine,
  defaultRules,
  exponentialBackoff,
  fixedClock,
  issueQuote,
  markQuote,
  money,
  NO_FISCAL_PROFILE,
  outboxCustomers,
  outboxQuoteStore,
  quoteTotals,
  reconcileQuotes,
  seededRandom,
  type IssueQuoteDeps,
  type Quote,
  type QuoteActor,
  type SellableProduct,
  type Timer,
} from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { dexieOperaciones } from './dexie-operaciones';
import { httpOperationTransport } from './http-operation-transport';
import { harness, nuevoDispositivo } from './servidor-de-pruebas';
import { uuidIdGenerator } from '../uuid-id-generator';

// E3 (parte de cotizaciones) · Con la tablet sin conexión: se captura un cliente nuevo, se hacen tres
// cotizaciones y se acepta una. Al volver la red todo llega UNA sola vez, con folios consecutivos,
// totales exactos y cada cotización de la tablet con su folio definitivo. Servidor local real.

const registro = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) {
    throw new Error('registro de precios');
  }
  return r.value;
})();

const precio = (centavos: number) => {
  const m = money(centavos);
  if (!m.ok) {
    throw new Error('dinero');
  }
  return m.value;
};

const vidrio: SellableProduct = {
  id: asId<'Product'>(crypto.randomUUID()),
  code: 'VC-6',
  name: 'Vidrio claro 6 mm',
  categoryId: asId<'Category'>('c-1'),
  kind: 'CUSTOM',
  chargeUnit: 'SQUARE_METER',
  listPrice: precio(28_000),
  isTaxExempt: false,
  ruleId: 'AREA',
  ruleParams: {},
};

describe('E3 · cotizar sin conexión y enviar al volver la red (servidor real)', () => {
  it('tres cotizaciones sin red salen una sola vez, en orden, con folios y totales correctos', async () => {
    let hayRed = false;
    const sinRedONormal: typeof fetch = (entrada, init) =>
      hayRed ? fetch(entrada, init) : Promise.reject(new TypeError('Failed to fetch'));
    const dispositivo = await nuevoDispositivo(sinRedONormal);
    const usuario = await harness.newUser(true);
    const year = await harness.newYear();

    const reloj = fixedClock(new Date(`${String(year)}-06-15T18:00:00.000Z`));
    const outbox = dexieOperaciones({ clock: reloj, nombre: `e3-${crypto.randomUUID()}` });
    const actor: QuoteActor = { userId: asId<'User'>(usuario), role: 'STAFF' };

    const timer: Timer = { after: () => () => undefined };
    const engine = createSyncEngine({
      outbox,
      transport: httpOperationTransport(dispositivo.receiver),
      backoff: exponentialBackoff({ baseMs: 1000, factor: 2, capMs: 8000, jitter: 0 }),
      random: seededRandom(1),
      timer,
      clock: reloj,
      afterPass: async () => {
        await reconcileQuotes(outbox);
      },
    });

    // ---- Sin conexión: cliente nuevo y tres cotizaciones ----
    const clientes = {
      customers: outboxCustomers({
        outbox,
        clock: reloj,
        idGenerator: uuidIdGenerator,
        device: { id: dispositivo.id },
        currentUserId: () => usuario,
      }),
      idGenerator: uuidIdGenerator,
    };
    const alta = await createCustomer(
      clientes,
      { role: 'STAFF' },
      {
        name: 'Obra capturada sin red',
        phone: '5512345678',
        email: null,
        notes: null,
        fiscal: NO_FISCAL_PROFILE,
        privacyNoticeVersion: null,
      },
    );
    expect(alta.ok).toBe(true);
    const cliente = alta.ok ? alta.value : null;
    if (cliente === null) {
      return;
    }

    const deps: IssueQuoteDeps = {
      store: outboxQuoteStore(outbox),
      idGenerator: uuidIdGenerator,
      clock: reloj,
      registry: registro,
      taxRateBps: 1600,
      outbox,
      // El servidor real conserva los códigos públicos de otras corridas: cada corrida usa una semilla propia.
      random: seededRandom(Math.floor(Math.random() * 2_000_000_000)),
      device: { id: dispositivo.id, series: 1 },
      settings: {
        validityDays: 15,
        conditionsText: 'Anticipo del 50%.',
        privacyNoticeVersion: null,
        catalogVersion: 1,
      },
    };

    const emitidas: Quote[] = [];
    for (let i = 0; i < 3; i += 1) {
      const borrador = await createQuoteDraft(deps, actor, { customerId: cliente.id });
      expect(borrador.ok).toBe(true);
      if (!borrador.ok) {
        return;
      }
      const conLinea = await addQuoteLine(deps, actor, borrador.value.id, vidrio, {
        widthMm: 1200,
        heightMm: 800,
        quantity: 2,
        displayUnit: 'cm',
      });
      expect(conLinea.ok).toBe(true);
      const emitida = await issueQuote(deps, actor, borrador.value.id);
      expect(emitida.ok).toBe(true);
      if (emitida.ok) {
        emitidas.push(emitida.value);
      }
    }
    const aceptada = await markQuote(deps, actor, emitidas[0]?.id ?? asId<'Quote'>(''), 'ACCEPTED');
    expect(aceptada.ok).toBe(true);

    // Sin red no sale nada y todo sigue guardado en la tablet.
    await engine.trigger();
    expect(engine.status()).toMatchObject({ state: 'WAITING', pending: 5 });
    expect((await harness.countsFor([dispositivo.id])).operations).toBe(0);
    expect(emitidas.every((q) => q.syncStatus === 'SAVED_ON_TABLET')).toBe(true);

    // ---- Vuelve la red ----
    hayRed = true;
    await engine.trigger();
    expect(engine.status()).toMatchObject({ state: 'IDLE', pending: 0 });

    // Cero duplicados: 1 cliente + 3 cotizaciones + 1 aceptación = 5 operaciones, 3 cotizaciones.
    expect(await harness.countsFor([dispositivo.id])).toEqual({ quotes: 3, operations: 5 });
    expect(await harness.customerName(cliente.id)).toBe('Obra capturada sin red');
    expect((await outbox.list()).every((o) => o.status === 'APPLIED')).toBe(true);

    // Reenviar no cambia nada.
    await engine.trigger();
    expect(await harness.countsFor([dispositivo.id])).toEqual({ quotes: 3, operations: 5 });

    // Cada cotización de la tablet tiene su folio definitivo, consecutivo y en el orden en que se emitió.
    const locales = await deps.store.list();
    const enOrden = emitidas.map((e) => locales.find((q) => q.id === e.id));
    expect(enOrden.map((q) => q?.folio)).toEqual(
      [1, 2, 3].map((n) => `COT-${String(year)}-000${String(n)}`),
    );
    expect(enOrden.every((q) => q?.syncStatus === 'SENT')).toBe(true);
    expect(enOrden[0]?.status).toBe('ACCEPTED');

    // Totales exactos al centavo: 1.92 m² × $280.00 = $537.60 (IVA incluido).
    for (const q of enOrden) {
      expect(quoteTotals(q?.lines ?? []).totalCents).toBe(53_760);
    }
  }, 90_000);
});
