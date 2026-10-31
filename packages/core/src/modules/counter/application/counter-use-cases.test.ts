import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId } from '../../../shared-kernel/id';
import { money } from '../../../shared-kernel/money/money';
import { seededRandom } from '../../../shared-kernel/random';
import type { Authorization } from '../../identity/application/authorize-with-admin-pin';
import { createPriceRegistry, defaultRules } from '../../catalog/domain/pricing/registry';
import { outboxPaymentStore } from '../../orders/application/work-order-store';
import type { QuoteActor } from '../../quotes/application/quote-use-cases';
import type { QuoteProduct } from '../../quotes/domain/quote-line';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import { parseOperation } from '../../sync/domain/operation';
import { addToTicket, EMPTY_TICKET, type Ticket } from '../domain/ticket';
import { outboxCounterSaleStore } from './counter-sale-store';
import {
  activeSales,
  cancelCounterSale,
  chargeCounterSale,
  type CounterDeps,
} from './counter-use-cases';

const ADMIN_ID = asId<'User'>('00000000-0000-4000-8000-00000000a0ad');
const cajero: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
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
    return asId<E>(`00000000-0000-4000-8000-${String(contador).padStart(12, '0')}`);
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

function ticketDe(cantidad = 1): Ticket {
  const r = addToTicket(
    EMPTY_TICKET,
    chapa,
    {
      id: ids.newId<'Line'>(),
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

function entorno() {
  const reloj = fixedClock(new Date('2026-10-31T18:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const deps: CounterDeps = {
    sales: outboxCounterSaleStore(outbox),
    payments: outboxPaymentStore(outbox),
    outbox,
    idGenerator: ids,
    clock: reloj,
    random: seededRandom(21),
    device: { id: '00000000-0000-4000-8000-0000000000d1', series: 1 },
  };
  return { deps, outbox };
}

describe('cobrar una venta de mostrador', () => {
  it('en efectivo calcula el cambio y guarda quién cobró, el dispositivo y la hora en UTC', async () => {
    const { deps } = entorno();
    const r = await chargeCounterSale(deps, cajero, {
      ticket: ticketDe(),
      customerId: null,
      rows: [{ method: 'CASH', amountCents: 11_600, cashReceivedCents: 20_000 }],
    });
    expect(r.ok && r.value.plan.changeCents).toBe(8_400);
    const pago = r.ok ? r.value.payments[0] : undefined;
    expect(pago).toMatchObject({
      kind: 'SALE',
      targetType: 'COUNTER_SALE',
      userId: cajero.userId,
      deviceId: deps.device.id,
      paidAt: '2026-10-31T18:00:00.000Z',
      cashReceivedCents: 20_000,
      changeCents: 8_400,
    });
    expect(r.ok && r.value.sale).toMatchObject({
      userId: cajero.userId,
      deviceId: deps.device.id,
      issuedAt: '2026-10-31T18:00:00.000Z',
      totalCents: 11_600,
      status: 'COMPLETED',
    });
  });

  it('la venta lleva folio provisional (uno por documento) y su operación válida queda en la cola', async () => {
    const { deps, outbox } = entorno();
    const a = await chargeCounterSale(deps, cajero, {
      ticket: ticketDe(),
      customerId: null,
      rows: [{ method: 'TRANSFER', amountCents: 11_600, reference: 'R1' }],
    });
    const b = await chargeCounterSale(deps, cajero, {
      ticket: ticketDe(2),
      customerId: null,
      rows: [{ method: 'TRANSFER', amountCents: 23_200 }],
    });
    expect(a.ok && a.value.sale.tempFolio).toBe('T1-0001');
    expect(b.ok && b.value.sale.tempFolio).toBe('T1-0002');
    expect(a.ok && a.value.sale.folio).toBeNull();
    const cola = await outbox.list();
    expect(cola.map((o) => o.envelope.type)).toEqual(['CreateCounterSale', 'CreateCounterSale']);
    expect(parseOperation(cola[0]?.envelope).ok).toBe(true);
    expect(cola.map((o) => o.envelope.seq)).toEqual([1, 2]);
  });

  it('un cobro mixto son dos filas del mismo grupo y suman el total', async () => {
    const { deps } = entorno();
    const r = await chargeCounterSale(deps, cajero, {
      ticket: ticketDe(),
      customerId: null,
      rows: [
        { method: 'CASH', amountCents: 5_000, cashReceivedCents: 5_000 },
        { method: 'TRANSFER', amountCents: 6_600, reference: 'SPEI' },
      ],
    });
    expect(r.ok && r.value.payments).toHaveLength(2);
    expect(r.ok && new Set(r.value.payments.map((p) => p.groupId)).size).toBe(1);
    expect(r.ok && r.value.payments.reduce((s, p) => s + p.amountCents, 0)).toBe(11_600);
    expect(await deps.payments.list()).toHaveLength(2);
  });

  it('se paga completa: un cobro de menos o de más se rechaza y no guarda nada', async () => {
    const { deps, outbox } = entorno();
    const poco = await chargeCounterSale(deps, cajero, {
      ticket: ticketDe(),
      customerId: null,
      rows: [{ method: 'TRANSFER', amountCents: 5_000 }],
    });
    expect(!poco.ok && poco.error.code).toBe('MUST_COVER_BALANCE');
    const mucho = await chargeCounterSale(deps, cajero, {
      ticket: ticketDe(),
      customerId: null,
      rows: [{ method: 'TRANSFER', amountCents: 20_000 }],
    });
    expect(!mucho.ok && mucho.error.code).toBe('EXCEEDS_BALANCE');
    expect(await outbox.list()).toHaveLength(0);
    expect(await deps.sales.list()).toHaveLength(0);
  });

  it('efectivo recibido menor a lo aplicado se rechaza', async () => {
    const { deps } = entorno();
    const r = await chargeCounterSale(deps, cajero, {
      ticket: ticketDe(),
      customerId: null,
      rows: [{ method: 'CASH', amountCents: 11_600, cashReceivedCents: 10_000 }],
    });
    expect(!r.ok && r.error.code).toBe('CASH_RECEIVED_INVALID');
  });

  it('un ticket vacío o sin persona activa no se cobra', async () => {
    const { deps } = entorno();
    const vacio = await chargeCounterSale(deps, cajero, {
      ticket: EMPTY_TICKET,
      customerId: null,
      rows: [{ method: 'TRANSFER', amountCents: 1 }],
    });
    expect(!vacio.ok && vacio.error.code).toBe('EMPTY_TICKET');
    const nadie = await chargeCounterSale(
      deps,
      { userId: cajero.userId, role: null },
      { ticket: ticketDe(), customerId: null, rows: [{ method: 'TRANSFER', amountCents: 11_600 }] },
    );
    expect(!nadie.ok && nadie.error.code).toBe('NOT_AUTHORIZED');
  });
});

describe('cancelar una venta', () => {
  async function conVenta() {
    const e = entorno();
    const r = await chargeCounterSale(e.deps, cajero, {
      ticket: ticketDe(),
      customerId: null,
      rows: [{ method: 'TRANSFER', amountCents: 11_600 }],
    });
    if (!r.ok) {
      throw new Error('venta');
    }
    return { ...e, id: r.value.sale.id };
  }

  it('un cajero no cancela; un administrador sí, con motivo, y los pagos se conservan', async () => {
    const { deps, id } = await conVenta();
    const cajeroIntenta = await cancelCounterSale(deps, cajero, id, 'Error');
    expect(!cajeroIntenta.ok && cajeroIntenta.error.code).toBe('NOT_AUTHORIZED');
    const sinMotivo = await cancelCounterSale(deps, admin, id, '   ');
    expect(!sinMotivo.ok && sinMotivo.error.code).toBe('REASON_REQUIRED');
    const r = await cancelCounterSale(deps, admin, id, 'Producto equivocado');
    expect(r.ok && r.value).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'Producto equivocado',
      cancelledBy: ADMIN_ID,
    });
    expect(await deps.payments.listByTarget(id)).toHaveLength(1);
  });

  it('un cajero con el PIN de un administrador puede cancelar y viaja quién autorizó', async () => {
    const { deps, outbox, id } = await conVenta();
    const r = await cancelCounterSale(deps, cajero, id, 'Cliente se arrepintió', conPin);
    expect(r.ok && r.value.status).toBe('CANCELLED');
    const op = (await outbox.list()).at(-1);
    expect(op?.envelope.type).toBe('CancelCounterSale');
    expect(op?.envelope.authorizedBy).toBe(ADMIN_ID);
    expect(parseOperation(op?.envelope).ok).toBe(true);
  });

  it('una venta cancelada no se cancela otra vez y sale de las ventas activas', async () => {
    const { deps, id } = await conVenta();
    await cancelCounterSale(deps, admin, id, 'Primera');
    const otra = await cancelCounterSale(deps, admin, id, 'Segunda');
    expect(!otra.ok && otra.error.code).toBe('INVALID_TRANSITION');
    expect(activeSales(await deps.sales.list())).toHaveLength(0);
    const falsa = await cancelCounterSale(deps, admin, 'no-existe', 'x');
    expect(!falsa.ok && falsa.error.code).toBe('NOT_FOUND');
  });
});
