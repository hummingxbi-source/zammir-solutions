import 'fake-indexeddb/auto';
import {
  addQuoteLine,
  addToTicket,
  advanceWorkOrder,
  asId,
  cancelCounterSale,
  chargeCounterSale,
  closeCashShift,
  convertQuoteToWorkOrder,
  createCustomer,
  createPriceRegistry,
  createQuoteDraft,
  createSyncEngine,
  defaultRules,
  deliverWorkOrder,
  EMPTY_TICKET,
  exponentialBackoff,
  fixedClock,
  issueQuote,
  markQuote,
  money,
  NO_FISCAL_PROFILE,
  openCashShift,
  outboxCashShiftStore,
  outboxCounterSaleStore,
  outboxCustomers,
  outboxPaymentStore,
  outboxQuoteStore,
  outboxWorkOrderStore,
  reconcileOrders,
  reconcileQuotes,
  reconcileSales,
  reconcileShifts,
  registerWorkOrderPayment,
  seededRandom,
  balanceCents,
  type CashDeps,
  type CounterDeps,
  type IssueQuoteDeps,
  type OrderDeps,
  type QuoteActor,
  type SellableProduct,
  type Timer,
} from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { uuidIdGenerator } from '../uuid-id-generator';
import { dexieOperaciones } from './dexie-operaciones';
import { httpOperationTransport } from './http-operation-transport';
import { harness, nuevoDispositivo } from './servidor-de-pruebas';

// E1 (de la cotización a la entrega) y E2 (ventas del día y corte) con la tablet SIN conexión, y al volver
// la red todo llega una sola vez y cuadra con el servidor real: orden entregada y pagada al centavo, ventas
// con su folio, venta cancelada fuera del corte y el corte del turno recalculado por el servidor.

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
const chapa: SellableProduct = {
  ...vidrio,
  id: asId<'Product'>(crypto.randomUUID()),
  code: 'CH',
  name: 'Chapa de baño',
  kind: 'STANDARD',
  chargeUnit: 'PIECE',
  listPrice: precio(11_600),
  ruleId: 'PIECE',
};

describe('E1 y E2 · de la cotización a la entrega y el corte, sin conexión (servidor real)', () => {
  it('todo se hace sin red y al volver llega una sola vez y cuadra al centavo', async () => {
    let hayRed = false;
    const sinRedONormal: typeof fetch = (entrada, init) =>
      hayRed ? fetch(entrada, init) : Promise.reject(new TypeError('Failed to fetch'));
    const dispositivo = await nuevoDispositivo(sinRedONormal);
    const cajeraId = await harness.newUser(true);
    const adminId = await harness.newUser(true, true);
    const year = await harness.newYear();

    const reloj = fixedClock(new Date(`${String(year)}-06-15T18:00:00.000Z`));
    const outbox = dexieOperaciones({ clock: reloj, nombre: `e1e2-${crypto.randomUUID()}` });
    const cajera: QuoteActor = { userId: asId<'User'>(cajeraId), role: 'STAFF' };
    const admin: QuoteActor = { userId: asId<'User'>(adminId), role: 'ADMIN' };

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
        await reconcileOrders(outbox);
        await reconcileSales(outbox);
        await reconcileShifts(outbox);
      },
    });

    const comunes = {
      outbox,
      idGenerator: uuidIdGenerator,
      clock: reloj,
      device: { id: dispositivo.id, series: 1 },
    };
    const random = seededRandom(Math.floor(Math.random() * 2_000_000_000));
    const turnos = outboxCashShiftStore(outbox);
    const pagos = outboxPaymentStore(outbox);
    const ordenes = outboxWorkOrderStore(outbox);
    const ventas = outboxCounterSaleStore(outbox);
    const cotizaciones = outboxQuoteStore(outbox);

    const quoteDeps: IssueQuoteDeps = {
      store: cotizaciones,
      ...comunes,
      registry: registro,
      taxRateBps: 1600,
      random,
      settings: {
        validityDays: 15,
        conditionsText: 'Anticipo del 50%.',
        privacyNoticeVersion: null,
        catalogVersion: 1,
      },
    };
    const orderDeps: OrderDeps = {
      orders: ordenes,
      payments: pagos,
      quotes: cotizaciones,
      shifts: turnos,
      ...comunes,
      random,
      settings: {
        depositPercentBps: 5_000,
        requireDepositToStart: true,
        warrantyMonthsDefault: 12,
      },
    };
    const counterDeps: CounterDeps = {
      sales: ventas,
      payments: pagos,
      shifts: turnos,
      ...comunes,
      random,
    };
    const cashDeps: CashDeps = {
      shifts: turnos,
      payments: pagos,
      sales: ventas,
      ...comunes,
    };

    // ---- Cliente y turno ----
    const alta = await createCustomer(
      {
        customers: outboxCustomers({
          outbox,
          clock: reloj,
          idGenerator: uuidIdGenerator,
          device: { id: dispositivo.id },
          currentUserId: () => cajeraId,
        }),
        idGenerator: uuidIdGenerator,
      },
      { role: 'STAFF' },
      {
        name: 'Obra de la prueba E1',
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

    // Sin turno abierto no se puede cobrar.
    const sinTurno = await chargeCounterSale(counterDeps, cajera, {
      ticket: EMPTY_TICKET,
      customerId: null,
      rows: [],
    });
    expect(sinTurno.ok).toBe(false);

    const turno = await openCashShift(cashDeps, cajera, { openingFloatCents: 10_000 });
    expect(turno.ok).toBe(true);
    if (!turno.ok) {
      return;
    }

    // ---- E1: cotización → aceptada → orden → anticipo → proceso → lista → saldo → entrega ----
    const borrador = await createQuoteDraft(quoteDeps, cajera, { customerId: cliente.id });
    expect(borrador.ok).toBe(true);
    if (!borrador.ok) {
      return;
    }
    await addQuoteLine(quoteDeps, cajera, borrador.value.id, vidrio, {
      widthMm: 1200,
      heightMm: 800,
      quantity: 2,
      displayUnit: 'cm',
    });
    const emitida = await issueQuote(quoteDeps, cajera, borrador.value.id);
    expect(emitida.ok).toBe(true);
    if (!emitida.ok) {
      return;
    }
    expect((await markQuote(quoteDeps, cajera, emitida.value.id, 'ACCEPTED')).ok).toBe(true);

    const orden = await convertQuoteToWorkOrder(orderDeps, cajera, emitida.value.id);
    expect(orden.ok).toBe(true);
    if (!orden.ok) {
      return;
    }
    expect(orden.value.totalCents).toBe(53_760);
    expect(orden.value.depositRequiredCents).toBe(26_880);

    const anticipo = await registerWorkOrderPayment(orderDeps, cajera, orden.value.id, [
      { method: 'CASH', amountCents: 26_880, cashReceivedCents: 30_000 },
    ]);
    expect(anticipo.ok).toBe(true);
    expect((await advanceWorkOrder(orderDeps, cajera, orden.value.id)).ok).toBe(true);
    expect((await advanceWorkOrder(orderDeps, cajera, orden.value.id)).ok).toBe(true);

    // Entregar con saldo sin permiso no se puede; se liquida por transferencia y entonces sí.
    const adeudada = await deliverWorkOrder(orderDeps, cajera, orden.value.id);
    expect(adeudada.ok).toBe(false);
    const saldo = await registerWorkOrderPayment(orderDeps, cajera, orden.value.id, [
      { method: 'TRANSFER', amountCents: 26_880, reference: 'SPEI-1' },
    ]);
    expect(saldo.ok).toBe(true);
    const entregada = await deliverWorkOrder(orderDeps, cajera, orden.value.id);
    expect(entregada.ok).toBe(true);
    expect(balanceCents(53_760, await pagos.list())).toBe(0);

    // ---- E2: dos ventas, una cancelada, y corte ----
    // Cada venta lleva sus propias líneas (con su propio id), como en el mostrador.
    const ticketDeUnaChapa = () => {
      const r = addToTicket(
        EMPTY_TICKET,
        chapa,
        { id: crypto.randomUUID(), widthMm: null, heightMm: null, quantity: 1, displayUnit: 'cm' },
        { registry: registro, taxRateBps: 1600 },
      );
      if (!r.ok) {
        throw new Error('ticket');
      }
      return r.value;
    };
    const ventaEfectivo = await chargeCounterSale(counterDeps, cajera, {
      ticket: ticketDeUnaChapa(),
      customerId: null,
      rows: [{ method: 'CASH', amountCents: 11_600, cashReceivedCents: 11_600 }],
    });
    const ventaCancelada = await chargeCounterSale(counterDeps, cajera, {
      ticket: ticketDeUnaChapa(),
      customerId: null,
      rows: [{ method: 'TRANSFER', amountCents: 11_600 }],
    });
    expect(ventaEfectivo.ok && ventaCancelada.ok).toBe(true);
    if (!ventaEfectivo.ok || !ventaCancelada.ok) {
      return;
    }
    expect(
      (await cancelCounterSale(counterDeps, admin, ventaCancelada.value.sale.id, 'Se equivocó')).ok,
    ).toBe(true);

    // Esperado en el cajón: fondo 100.00 + anticipo 268.80 + venta 116.00 = 484.80 (la transferencia y la
    // venta cancelada no entran). Se cuentan $483.80: faltan $1.00.
    const corte = await closeCashShift(cashDeps, cajera, turno.value.id, 48_380);
    expect(corte.ok).toBe(true);
    if (!corte.ok) {
      return;
    }
    expect(corte.value.summary.expectedCashCents).toBe(48_480);
    expect(corte.value.summary.differenceCents).toBe(-100);
    expect(corte.value.summary.cancelledSalesCents).toBe(11_600);

    // ---- Sin red no sale nada ----
    await engine.trigger();
    expect((await harness.countsFor([dispositivo.id])).operations).toBe(0);
    expect(engine.status().pending).toBeGreaterThan(10);

    // ---- Vuelve la red ----
    hayRed = true;
    await engine.trigger();
    const sinAplicar = (await outbox.list()).filter((o) => o.status !== 'APPLIED');
    expect(
      sinAplicar.map((o) =>
        JSON.stringify({
          t: o.envelope.type,
          status: o.status,
          attempts: o.attempts,
          rest: { ...o, envelope: undefined },
        }),
      ),
    ).toEqual([]);
    expect(engine.status()).toMatchObject({ state: 'IDLE', pending: 0 });
    expect((await outbox.list()).every((o) => o.status === 'APPLIED')).toBe(true);

    // Reenviar no cambia nada.
    const enviadas = (await harness.countsFor([dispositivo.id])).operations;
    await engine.trigger();
    expect((await harness.countsFor([dispositivo.id])).operations).toBe(enviadas);

    // Lo que dice el servidor, leído por un camino independiente.
    expect(await harness.orderState(orden.value.id)).toMatchObject({
      status: 'DELIVERED',
      paidCents: 53_760,
    });
    expect(await harness.saleState(ventaEfectivo.value.sale.id)).toMatchObject({
      status: 'COMPLETED',
      paidCents: 11_600,
    });
    expect((await harness.saleState(ventaCancelada.value.sale.id))?.status).toBe('CANCELLED');
    expect(await harness.shiftState(turno.value.id)).toEqual({
      status: 'CLOSED',
      expectedCents: 48_480,
      differenceCents: -100,
    });

    // La tablet quedó con los folios definitivos, consecutivos.
    const ordenFinal = await ordenes.get(orden.value.id);
    expect(ordenFinal?.folio).toBe(`OT-${String(year)}-0001`);
    expect(ordenFinal?.syncStatus).toBe('SENT');
    const salidas = (await ventas.list()).map((v) => v.folio).sort();
    expect(salidas).toEqual([`V-${String(year)}-0001`, `V-${String(year)}-0002`]);
    expect((await harness.customerName(cliente.id)) ?? '').toBe('Obra de la prueba E1');
  }, 120_000);
});
