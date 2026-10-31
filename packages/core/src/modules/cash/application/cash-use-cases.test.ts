import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId } from '../../../shared-kernel/id';
import { money } from '../../../shared-kernel/money/money';
import { seededRandom } from '../../../shared-kernel/random';
import { createPriceRegistry, defaultRules } from '../../catalog/domain/pricing/registry';
import {
  cancelCounterSale,
  chargeCounterSale,
  type CounterDeps,
} from '../../counter/application/counter-use-cases';
import { outboxCounterSaleStore } from '../../counter/application/counter-sale-store';
import { addToTicket, EMPTY_TICKET } from '../../counter/domain/ticket';
import type { Authorization } from '../../identity/application/authorize-with-admin-pin';
import {
  outboxPaymentStore,
  outboxWorkOrderStore,
} from '../../orders/application/work-order-store';
import {
  convertQuoteToWorkOrder,
  registerWorkOrderPayment,
  type OrderDeps,
} from '../../orders/application/work-order-use-cases';
import { outboxQuoteStore } from '../../quotes/application/quote-store';
import type { QuoteActor } from '../../quotes/application/quote-use-cases';
import type { Quote } from '../../quotes/domain/quote';
import type { QuoteProduct } from '../../quotes/domain/quote-line';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import { parseOperation } from '../../sync/domain/operation';
import { outboxCashShiftStore } from './cash-shift-store';
import {
  closeCashShift,
  dayReport,
  openCashShift,
  pendingBeforeClose,
  reopenCashShift,
  shiftSummary,
  visibleShifts,
  type CashDeps,
} from './cash-use-cases';

const ADMIN_ID = asId<'User'>('00000000-0000-4000-8000-00000000a0ad');
const ana: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
  role: 'STAFF',
};
const beto: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a002'),
  role: 'STAFF',
};
const admin: QuoteActor = { userId: ADMIN_ID, role: 'ADMIN' };
const conPin: Authorization = {
  adminId: ADMIN_ID,
  authorizedAt: new Date('2026-10-31T18:00:00.000Z'),
};

let contador = 0;
const ids = {
  newId: <E extends string>() => {
    contador += 1;
    return asId<E>(`00000000-0000-4000-8000-${String(contador + 40000).padStart(12, '0')}`);
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

function entorno(ahora = '2026-10-31T18:00:00.000Z') {
  let instante = new Date(ahora);
  const reloj = { now: () => new Date(instante) };
  const outbox = inMemorySyncOutbox({ clock: fixedClock(new Date('2026-10-31T12:00:00.000Z')) });
  const turnos = outboxCashShiftStore(outbox);
  const dispositivo = { id: '00000000-0000-4000-8000-0000000000d1', series: 1 };
  const comunes = { outbox, idGenerator: ids, clock: reloj, device: dispositivo };
  const cash: CashDeps = {
    ...comunes,
    shifts: turnos,
    payments: outboxPaymentStore(outbox),
    sales: outboxCounterSaleStore(outbox),
  };
  const counter: CounterDeps = {
    ...comunes,
    random: seededRandom(5),
    sales: outboxCounterSaleStore(outbox),
    payments: outboxPaymentStore(outbox),
    shifts: turnos,
  };
  const orders: OrderDeps = {
    ...comunes,
    random: seededRandom(6),
    orders: outboxWorkOrderStore(outbox),
    payments: outboxPaymentStore(outbox),
    quotes: outboxQuoteStore(outbox),
    settings: {
      depositPercentBps: 5_000,
      requireDepositToStart: false,
      warrantyMonthsDefault: null,
    },
    shifts: turnos,
  };
  return { cash, counter, orders, outbox, avanzar: (iso: string) => (instante = new Date(iso)) };
}

function ticket() {
  const t = addToTicket(
    EMPTY_TICKET,
    chapa,
    { id: ids.newId<'Line'>(), widthMm: null, heightMm: null, quantity: 1, displayUnit: 'cm' },
    { registry: registro, taxRateBps: 1600 },
  );
  if (!t.ok) {
    throw new Error('ticket');
  }
  return t.value;
}

const efectivo = (aplicado: number) => [
  { method: 'CASH' as const, amountCents: aplicado, cashReceivedCents: aplicado + 500 },
];

async function abrir(e: ReturnType<typeof entorno>, quien = ana, fondo?: number) {
  const r = await openCashShift(
    e.cash,
    quien,
    fondo === undefined ? {} : { openingFloatCents: fondo },
  );
  if (!r.ok) {
    throw new Error(`no abrió: ${r.error.code}`);
  }
  return r.value;
}

describe('abrir el turno', () => {
  it('queda abierto con su fondo opcional, a nombre de quien lo abrió, y encola OpenCashShift', async () => {
    const e = entorno();
    const t = await abrir(e, ana, 50_000);
    expect(t).toMatchObject({
      status: 'OPEN',
      cashierId: ana.userId,
      openingFloatCents: 50_000,
      openedAt: '2026-10-31T18:00:00.000Z',
      syncStatus: 'SAVED_ON_TABLET',
      closedAt: null,
      countedCashCents: null,
    });
    const op = (await e.outbox.list())[0];
    expect(op?.envelope.type).toBe('OpenCashShift');
    expect(parseOperation(op?.envelope).ok).toBe(true);
    expect((await e.cash.shifts.openFor(ana.userId))?.id).toBe(t.id);
  });

  it('sin fondo abre en cero', async () => {
    const t = await abrir(entorno());
    expect(t.openingFloatCents).toBe(0);
  });

  it('un fondo negativo o con decimales se rechaza', async () => {
    const e = entorno();
    for (const malo of [-1, 1.5, Number.NaN]) {
      const r = await openCashShift(e.cash, ana, { openingFloatCents: malo });
      expect(!r.ok && r.error.code).toBe('AMOUNT_INVALID');
    }
    expect(await e.outbox.list()).toHaveLength(0);
  });

  it('una persona no puede tener dos turnos abiertos, pero cada quien tiene el suyo', async () => {
    const e = entorno();
    await abrir(e, ana);
    const otra = await openCashShift(e.cash, ana);
    expect(!otra.ok && otra.error.code).toBe('SHIFT_ALREADY_OPEN');
    expect((await openCashShift(e.cash, beto)).ok).toBe(true);
  });

  it('quien no ha entrado con su PIN no abre turno', async () => {
    const r = await openCashShift(entorno().cash, { userId: ana.userId, role: null });
    expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
  });
});

describe('todo cobro se liga al turno abierto de quien cobra', () => {
  it('sin turno abierto no se cobra una venta ni el saldo de una orden', async () => {
    const e = entorno();
    const venta = await chargeCounterSale(e.counter, ana, {
      ticket: ticket(),
      customerId: null,
      rows: efectivo(11_600),
    });
    expect(!venta.ok && venta.error.code).toBe('NO_OPEN_SHIFT');
    expect(await e.outbox.list()).toHaveLength(0);
  });

  it('con turno, el pago y la venta llevan su turno y viaja en la operación', async () => {
    const e = entorno();
    const t = await abrir(e);
    const venta = await chargeCounterSale(e.counter, ana, {
      ticket: ticket(),
      customerId: null,
      rows: efectivo(11_600),
    });
    expect(venta.ok && venta.value.sale.cashShiftId).toBe(t.id);
    expect(venta.ok && venta.value.payments[0]?.cashShiftId).toBe(t.id);
    const op = (await e.outbox.list()).at(-1);
    expect((op?.envelope.payload as { cashShiftId: string }).cashShiftId).toBe(t.id);
    expect(parseOperation(op?.envelope).ok).toBe(true);
  });

  it('el cobro de otra persona cae en SU turno, no en el de quien creó la orden', async () => {
    const e = entorno();
    const tAna = await abrir(e, ana);
    const tBeto = await abrir(e, beto);
    const q: Quote = {
      id: ids.newId<'Quote'>(),
      status: 'ACCEPTED',
      customerId: asId<'Customer'>('00000000-0000-4000-8000-00000000c001'),
      siteAddress: null,
      lines: [
        {
          id: ids.newId<'Line'>(),
          productId: null,
          name: 'Vidrio',
          chargeUnit: 'SQUARE_METER',
          unitPriceCents: 11_600,
          catalogPriceCents: 11_600,
          ruleId: 'AREA',
          ruleParams: {},
          widthMm: 1000,
          heightMm: 1000,
          quantity: 1,
          displayUnit: 'cm',
          baseCents: 10_000,
          taxCents: 1_600,
          lineTotalCents: 11_600,
          isTaxExempt: false,
          detail: '1 m²',
        },
      ],
      userId: ana.userId,
      tempFolio: 'T1-0001',
      folio: null,
      publicCode: 'ABCDEFGH',
      issuedAt: '2026-10-31T15:00:00.000Z',
      validUntil: '2026-11-15',
      conditionsText: 'x',
      privacyNoticeVersion: null,
      catalogVersion: null,
      discountAuthorizedBy: null,
      syncStatus: 'SENT',
      reviewReason: null,
      updatedAt: '2026-10-31T15:00:00.000Z',
    };
    await e.orders.quotes.save(q);
    const orden = await convertQuoteToWorkOrder(e.orders, ana, q.id);
    if (!orden.ok) {
      throw new Error('orden');
    }
    const cobro = await registerWorkOrderPayment(e.orders, beto, orden.value.id, efectivo(5_800));
    expect(cobro.ok && cobro.value.payments[0]?.cashShiftId).toBe(tBeto.id);
    expect(cobro.ok && cobro.value.payments[0]?.userId).toBe(beto.userId);
    expect((await shiftSummary(e.cash, tAna)).cashCents).toBe(0);
    expect((await shiftSummary(e.cash, tBeto)).cashCents).toBe(5_800);
  });
});

describe('cerrar el turno y el corte', () => {
  async function conVenta(e: ReturnType<typeof entorno>, fondo = 10_000) {
    const t = await abrir(e, ana, fondo);
    const v = await chargeCounterSale(e.counter, ana, {
      ticket: ticket(),
      customerId: null,
      rows: efectivo(11_600),
    });
    if (!v.ok) {
      throw new Error('venta');
    }
    return { turno: t, venta: v.value.sale };
  }

  it('calcula cobros por método, efectivo esperado y diferencia, y encola CloseCashShift', async () => {
    const e = entorno();
    const { turno } = await conVenta(e);
    const r = await closeCashShift(e.cash, ana, turno.id, 21_500);
    expect(r.ok && r.value.summary).toMatchObject({
      cashCents: 11_600,
      expectedCashCents: 21_600,
      differenceCents: -100,
    });
    expect(r.ok && r.value.shift).toMatchObject({
      status: 'CLOSED',
      countedCashCents: 21_500,
      expectedCashCents: 21_600,
      differenceCents: -100,
      closedAt: '2026-10-31T18:00:00.000Z',
    });
    const op = (await e.outbox.list()).at(-1);
    expect(op?.envelope.type).toBe('CloseCashShift');
    expect(op?.envelope.payload).toMatchObject({
      countedCashCents: 21_500,
      expectedCashCents: 21_600,
    });
    expect(parseOperation(op?.envelope).ok).toBe(true);
  });

  it('avisa cuántas operaciones quedaban sin enviar y las guarda en el corte', async () => {
    const e = entorno();
    const { turno } = await conVenta(e);
    // Abrir el turno y vender dejan 2 operaciones pendientes.
    expect(await pendingBeforeClose(e.cash)).toBe(2);
    const r = await closeCashShift(e.cash, ana, turno.id, 21_600);
    expect(r.ok && r.value.pendingOperations).toBe(2);
    expect(r.ok && r.value.shift.pendingAtClose).toBe(2);
    expect((await e.outbox.list()).at(-1)?.envelope.payload).toMatchObject({ pendingAtClose: 2 });
  });

  it('con todo enviado no queda nada pendiente', async () => {
    const e = entorno();
    const { turno } = await conVenta(e);
    for (const o of await e.outbox.list()) {
      await e.outbox.markApplied(o.envelope.opId, { ok: true, status: 'APPLIED' });
    }
    expect(await pendingBeforeClose(e.cash)).toBe(0);
    const r = await closeCashShift(e.cash, ana, turno.id, 21_600);
    expect(r.ok && r.value.pendingOperations).toBe(0);
  });

  it('una venta cancelada sale del corte', async () => {
    const e = entorno();
    const { turno, venta } = await conVenta(e, 0);
    await cancelCounterSale(e.counter, admin, venta.id, 'Error');
    const r = await closeCashShift(e.cash, ana, turno.id, 0);
    expect(r.ok && r.value.summary).toMatchObject({
      cashCents: 0,
      cancelledSalesCents: 11_600,
      expectedCashCents: 0,
      differenceCents: 0,
    });
  });

  it('un corte cerrado no se edita ni se vuelve a cerrar, y ya no se cobra en él', async () => {
    const e = entorno();
    const { turno } = await conVenta(e);
    await closeCashShift(e.cash, ana, turno.id, 21_600);
    const otra = await closeCashShift(e.cash, ana, turno.id, 1);
    expect(!otra.ok && otra.error.code).toBe('ALREADY_CLOSED');
    const cobro = await chargeCounterSale(e.counter, ana, {
      ticket: ticket(),
      customerId: null,
      rows: efectivo(11_600),
    });
    expect(!cobro.ok && cobro.error.code).toBe('NO_OPEN_SHIFT');
    expect((await e.cash.shifts.get(turno.id))?.countedCashCents).toBe(21_600);
  });

  it('cada quien cierra el suyo; un administrador puede cerrar el de otra persona', async () => {
    const e = entorno();
    const tAna = await abrir(e, ana);
    const ajeno = await closeCashShift(e.cash, beto, tAna.id, 0);
    expect(!ajeno.ok && ajeno.error.code).toBe('NOT_AUTHORIZED');
    const porAdmin = await closeCashShift(e.cash, admin, tAna.id, 0);
    expect(porAdmin.ok).toBe(true);
  });

  it('un monto contado inválido o un turno que no existe se rechazan', async () => {
    const e = entorno();
    const t = await abrir(e);
    for (const malo of [-1, 2.5, Number.NaN]) {
      const r = await closeCashShift(e.cash, ana, t.id, malo);
      expect(!r.ok && r.error.code).toBe('AMOUNT_INVALID');
    }
    const falso = await closeCashShift(e.cash, ana, 'no-existe', 0);
    expect(!falso.ok && falso.error.code).toBe('NOT_FOUND');
  });
});

describe('reabrir el corte', () => {
  async function cerrado(e: ReturnType<typeof entorno>) {
    const t = await abrir(e, ana);
    await closeCashShift(e.cash, ana, t.id, 0);
    return t;
  }

  it('un administrador lo reabre con motivo y queda quién, por qué y cuándo', async () => {
    const e = entorno();
    const t = await cerrado(e);
    const r = await reopenCashShift(e.cash, admin, t.id, '  Faltó un cobro  ');
    expect(r.ok && r.value.status).toBe('OPEN');
    expect(r.ok && r.value.reopenings).toEqual([
      { adminId: ADMIN_ID, reason: 'Faltó un cobro', at: '2026-10-31T18:00:00.000Z' },
    ]);
    const op = (await e.outbox.list()).at(-1);
    expect(op?.envelope.type).toBe('ReopenCashShift');
    expect(op?.envelope.authorizedBy).toBe(ADMIN_ID);
    expect(parseOperation(op?.envelope).ok).toBe(true);
    // Abierto otra vez, la persona vuelve a cobrar en él.
    expect((await e.cash.shifts.openFor(ana.userId))?.id).toBe(t.id);
  });

  it('un cajero no lo reabre; con el PIN de un administrador sí', async () => {
    const e = entorno();
    const t = await cerrado(e);
    const sin = await reopenCashShift(e.cash, ana, t.id, 'x');
    expect(!sin.ok && sin.error.code).toBe('NOT_AUTHORIZED');
    const con = await reopenCashShift(e.cash, ana, t.id, 'x', conPin);
    expect(con.ok && con.value.reopenings[0]?.adminId).toBe(ADMIN_ID);
  });

  it('sin motivo, de uno que no existe o de uno abierto se rechaza', async () => {
    const e = entorno();
    const t = await cerrado(e);
    const sinMotivo = await reopenCashShift(e.cash, admin, t.id, '  ');
    expect(!sinMotivo.ok && sinMotivo.error.code).toBe('REASON_REQUIRED');
    const falso = await reopenCashShift(e.cash, admin, 'no-existe', 'x');
    expect(!falso.ok && falso.error.code).toBe('NOT_FOUND');
    await reopenCashShift(e.cash, admin, t.id, 'x');
    const abierto = await reopenCashShift(e.cash, admin, t.id, 'otra vez');
    expect(!abierto.ok && abierto.error.code).toBe('NOT_CLOSED');
  });
});

describe('quién ve qué y el corte del día', () => {
  it('un cajero solo ve sus turnos; un administrador ve todos', async () => {
    const e = entorno();
    await abrir(e, ana);
    await abrir(e, beto);
    expect((await visibleShifts(e.cash, ana)).map((t) => t.cashierId)).toEqual([ana.userId]);
    expect(await visibleShifts(e.cash, admin)).toHaveLength(2);
  });

  it('el corte del día es solo de administradores y suma los turnos de ese día', async () => {
    const e = entorno();
    const tAna = await abrir(e, ana, 1_000);
    await chargeCounterSale(e.counter, ana, {
      ticket: ticket(),
      customerId: null,
      rows: efectivo(11_600),
    });
    await chargeCounterSale(e.counter, ana, {
      ticket: ticket(),
      customerId: null,
      rows: [{ method: 'TRANSFER', amountCents: 11_600 }],
    });
    await closeCashShift(e.cash, ana, tAna.id, 12_600);
    await abrir(e, beto);
    const denegado = await dayReport(e.cash, ana);
    expect(!denegado.ok && denegado.error.code).toBe('NOT_AUTHORIZED');
    const r = await dayReport(e.cash, admin);
    expect(r.ok && r.value).toMatchObject({
      date: '2026-10-31',
      cashCents: 11_600,
      transferCents: 11_600,
      totalCents: 23_200,
      shiftCount: 2,
    });
    const otroDia = await dayReport(e.cash, admin, '2026-10-30');
    expect(otroDia.ok && otroDia.value.shiftCount).toBe(0);
  });

  it('un turno abierto en la noche pertenece al día en que se abrió aunque se cierre al siguiente', async () => {
    const e = entorno('2026-11-01T04:30:00.000Z');
    const t = await abrir(e, ana);
    e.avanzar('2026-11-01T18:00:00.000Z');
    await closeCashShift(e.cash, ana, t.id, 0);
    const r = await dayReport(e.cash, admin, '2026-10-31');
    expect(r.ok && r.value.shiftCount).toBe(1);
    const siguiente = await dayReport(e.cash, admin, '2026-11-01');
    expect(siguiente.ok && siguiente.value.shiftCount).toBe(0);
  });
});
