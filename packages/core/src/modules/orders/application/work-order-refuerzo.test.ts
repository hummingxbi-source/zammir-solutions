import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId } from '../../../shared-kernel/id';
import { seededRandom } from '../../../shared-kernel/random';
import { outboxQuoteStore } from '../../quotes/application/quote-store';
import type { QuoteActor } from '../../quotes/application/quote-use-cases';
import type { Quote, QuoteLine } from '../../quotes/domain/quote';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import {
  advanceWorkOrder,
  cancelWorkOrder,
  convertQuoteToWorkOrder,
  createManualWorkOrder,
  deliverWorkOrder,
  registerWorkOrderPayment,
  updateWorkOrder,
  workOrderBalance,
  type OrderDeps,
} from './work-order-use-cases';
import { outboxPaymentStore, outboxWorkOrderStore } from './work-order-store';

// Refuerzo de pruebas: cada regla de los casos de uso de órdenes se comprueba por separado (permisos,
// formatos, qué viaja en cada operación y qué no), para que un cambio por descuido no pase inadvertido.

const CLIENTE = asId<'Customer'>('00000000-0000-4000-8000-00000000c001');
const ADMIN_ID = asId<'User'>('00000000-0000-4000-8000-00000000a0ad');
const cajero: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
  role: 'STAFF',
};
const admin: QuoteActor = { userId: ADMIN_ID, role: 'ADMIN' };
const sinPersona: QuoteActor = { userId: cajero.userId, role: null };

let contador = 0;
const ids = {
  newId: <E extends string>() => {
    contador += 1;
    return asId<E>(`00000000-0000-4000-8000-${String(contador + 9000).padStart(12, '0')}`);
  },
};

function linea(totalCents = 11_600): QuoteLine {
  const base = Math.round(totalCents / 1.16);
  return {
    id: ids.newId<'Line'>(),
    productId: null,
    name: 'Vidrio claro 6 mm',
    chargeUnit: 'SQUARE_METER',
    unitPriceCents: totalCents,
    catalogPriceCents: totalCents,
    ruleId: 'AREA',
    ruleParams: {},
    widthMm: 1000,
    heightMm: 1000,
    quantity: 1,
    displayUnit: 'cm',
    baseCents: base,
    taxCents: totalCents - base,
    lineTotalCents: totalCents,
    isTaxExempt: false,
    detail: '1 m²',
  };
}

function cotizacion(estado: Quote['status'], cambios: Partial<Quote> = {}): Quote {
  return {
    id: ids.newId<'Quote'>(),
    status: estado,
    customerId: CLIENTE,
    siteAddress: null,
    lines: [linea()],
    userId: cajero.userId,
    tempFolio: 'T1-0001',
    folio: 'COT-2026-0001',
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
    ...cambios,
  };
}

function entorno(ajustes: Partial<OrderDeps['settings']> = {}) {
  const reloj = fixedClock(new Date('2026-10-31T18:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const deps: OrderDeps = {
    orders: outboxWorkOrderStore(outbox),
    payments: outboxPaymentStore(outbox),
    quotes: outboxQuoteStore(outbox),
    outbox,
    idGenerator: ids,
    clock: reloj,
    random: seededRandom(31),
    device: { id: '00000000-0000-4000-8000-0000000000d1', series: 1 },
    settings: {
      depositPercentBps: 5_000,
      requireDepositToStart: true,
      warrantyMonthsDefault: null,
      ...ajustes,
    },
  };
  return { deps, outbox };
}

async function orden(e: ReturnType<typeof entorno>) {
  const q = cotizacion('ACCEPTED');
  await e.deps.quotes.save(q);
  const r = await convertQuoteToWorkOrder(e.deps, cajero, q.id);
  if (!r.ok) {
    throw new Error('orden');
  }
  return r.value;
}

const transferencia = (c: number) =>
  [{ method: 'TRANSFER', amountCents: c, reference: 'REF' }] as const;

describe('permisos', () => {
  it('quien no ha entrado con su PIN no puede crear, editar, avanzar ni entregar', async () => {
    const e = entorno();
    const o = await orden(e);
    const manual = await createManualWorkOrder(e.deps, sinPersona, {
      customerId: CLIENTE,
      siteAddress: null,
      description: null,
      lines: [linea()],
    });
    expect(!manual.ok && manual.error.code).toBe('NOT_AUTHORIZED');
    const q = cotizacion('ACCEPTED');
    await e.deps.quotes.save(q);
    const convertir = await convertQuoteToWorkOrder(e.deps, sinPersona, q.id);
    expect(!convertir.ok && convertir.error.code).toBe('NOT_AUTHORIZED');
    const editar = await updateWorkOrder(e.deps, sinPersona, o.id, { notes: 'x' });
    expect(!editar.ok && editar.error.code).toBe('NOT_AUTHORIZED');
    const avanzar = await advanceWorkOrder(e.deps, sinPersona, o.id);
    expect(!avanzar.ok && avanzar.error.code).toBe('NOT_AUTHORIZED');
    const entregar = await deliverWorkOrder(e.deps, sinPersona, o.id);
    expect(!entregar.ok && entregar.error.code).toBe('NOT_AUTHORIZED');
  });

  it('una orden que no existe no se edita, avanza, entrega ni cancela', async () => {
    const e = entorno();
    const resultados = [
      await updateWorkOrder(e.deps, cajero, 'no-existe', { notes: 'x' }),
      await advanceWorkOrder(e.deps, cajero, 'no-existe'),
      await deliverWorkOrder(e.deps, admin, 'no-existe', { reason: 'x' }),
      await cancelWorkOrder(e.deps, admin, 'no-existe', 'x'),
    ];
    for (const r of resultados) {
      expect(!r.ok && r.error.code).toBe('NOT_FOUND');
    }
    expect(await workOrderBalance(e.deps, 'no-existe')).toBeNull();
  });
});

describe('creación', () => {
  it('una cotización con el vínculo en blanco sí se puede convertir', async () => {
    const e = entorno();
    const q = cotizacion('ACCEPTED', { convertedWorkOrderId: null });
    await e.deps.quotes.save(q);
    expect((await convertQuoteToWorkOrder(e.deps, cajero, q.id)).ok).toBe(true);
  });

  it('una orden nueva nace sin datos de entrega, de cancelación ni de responsables', async () => {
    const o = await orden(entorno());
    expect(o).toMatchObject({
      deliveredWithBalance: false,
      deliveredAt: null,
      deliveryReason: null,
      deliveryAuthorizedBy: null,
      cancelledAt: null,
      cancelReason: null,
      cancelledFromStatus: null,
      cancelDepositPaidCents: null,
      measuredBy: null,
      builtBy: null,
      installedBy: null,
      estimatedDeliveryDate: null,
      notes: null,
      folio: null,
      reviewReason: null,
    });
  });

  it('la operación de creación lleva la unidad de captura y la regla de cada línea', async () => {
    const e = entorno();
    await orden(e);
    const payload = (await e.outbox.list())[0]?.envelope.payload as {
      lines: { displayUnit?: string; ruleParams: unknown; productId: unknown }[];
    };
    expect(payload.lines[0]?.displayUnit).toBe('cm');
    expect(payload.lines[0]?.ruleParams).toEqual({});
    expect(payload.lines[0]?.productId).toBeNull();
  });

  it('las líneas que bajaron de otra tablet (sin unidad ni regla) viajan sin inventar nada', async () => {
    const e = entorno();
    const l = { ...linea(), displayUnit: null, ruleParams: undefined } as unknown as QuoteLine;
    const r = await createManualWorkOrder(e.deps, cajero, {
      customerId: CLIENTE,
      siteAddress: null,
      description: null,
      lines: [l],
    });
    expect(r.ok).toBe(true);
    const payload = (await e.outbox.list())[0]?.envelope.payload as {
      lines: Record<string, unknown>[];
    };
    expect('displayUnit' in (payload.lines[0] ?? {})).toBe(false);
    expect(payload.lines[0]?.ruleParams).toEqual({});
  });
});

describe('datos de la orden', () => {
  it('una orden cancelada ya no se edita', async () => {
    const e = entorno();
    const o = await orden(e);
    await cancelWorkOrder(e.deps, admin, o.id, 'Duplicada');
    const r = await updateWorkOrder(e.deps, cajero, o.id, { notes: 'x' });
    expect(!r.ok && r.error.code).toBe('INVALID_TRANSITION');
  });

  it.each(['2026-1-05', 'x2026-10-05', '2026-10-05x', '202-10-05', '2026-10-5', '20261005', ''])(
    'la fecha estimada "%s" no es válida',
    async (mala) => {
      const e = entorno();
      const o = await orden(e);
      const r = await updateWorkOrder(e.deps, cajero, o.id, { estimatedDeliveryDate: mala });
      expect(!r.ok && r.error.code).toBe('INVALID_DATE');
    },
  );

  it('una fecha bien escrita se guarda y se puede quitar', async () => {
    const e = entorno();
    const o = await orden(e);
    const puesta = await updateWorkOrder(e.deps, cajero, o.id, {
      estimatedDeliveryDate: '2026-11-20',
    });
    expect(puesta.ok && puesta.value.estimatedDeliveryDate).toBe('2026-11-20');
    const quitada = await updateWorkOrder(e.deps, cajero, o.id, { estimatedDeliveryDate: null });
    expect(quitada.ok && quitada.value.estimatedDeliveryDate).toBeNull();
  });

  it('cada dato se guarda solo, y solo viaja lo que cambió', async () => {
    const e = entorno();
    const o = await orden(e);
    const parches: [Parameters<typeof updateWorkOrder>[3], string][] = [
      [{ measuredBy: cajero.userId }, 'measuredBy'],
      [{ builtBy: cajero.userId }, 'builtBy'],
      [{ installedBy: ADMIN_ID }, 'installedBy'],
      [{ estimatedDeliveryDate: '2026-12-01' }, 'estimatedDeliveryDate'],
      [{ notes: 'Nota' }, 'notes'],
    ];
    for (const [parche, clave] of parches) {
      expect((await updateWorkOrder(e.deps, cajero, o.id, parche)).ok).toBe(true);
      const op = (await e.outbox.list()).at(-1);
      expect(Object.keys((op?.envelope.payload as { patch: object }).patch)).toEqual([clave]);
      expect(op?.envelope.authorizedBy).toBeUndefined();
    }
    const final = await e.deps.orders.get(o.id);
    expect(final).toMatchObject({
      measuredBy: cajero.userId,
      builtBy: cajero.userId,
      installedBy: ADMIN_ID,
      estimatedDeliveryDate: '2026-12-01',
      notes: 'Nota',
      syncStatus: 'SAVED_ON_TABLET',
    });
    const quitar = await updateWorkOrder(e.deps, cajero, o.id, {
      measuredBy: null,
      builtBy: null,
      installedBy: null,
    });
    expect(
      quitar.ok && [quitar.value.measuredBy, quitar.value.builtBy, quitar.value.installedBy],
    ).toEqual([null, null, null]);
  });

  it('las notas se recortan antes de guardarse y de viajar', async () => {
    const e = entorno();
    const o = await orden(e);
    const a = await updateWorkOrder(e.deps, cajero, o.id, { notes: '  hola  ' });
    expect(a.ok && a.value.notes).toBe('hola');
    const op = (await e.outbox.list()).at(-1);
    expect((op?.envelope.payload as { patch: { notes: string } }).patch.notes).toBe('hola');
  });
});

describe('avanzar, entregar y cancelar', () => {
  it('pasar a "listo" no pide anticipo ni autorización, y desde "listo" el botón ya no avanza', async () => {
    const e = entorno();
    const o = await orden(e);
    await e.deps.orders.save({ ...o, status: 'IN_PROCESS' });
    const listo = await advanceWorkOrder(e.deps, cajero, o.id);
    expect(listo.ok && listo.value.status).toBe('READY');
    expect((await e.outbox.list()).at(-1)?.envelope.authorizedBy).toBeUndefined();
    const mas = await advanceWorkOrder(e.deps, cajero, o.id);
    expect(!mas.ok && mas.error.code).toBe('INVALID_TRANSITION');
  });

  it('el motivo de entrega se recorta y uno en blanco con saldo no vale', async () => {
    const e = entorno({ requireDepositToStart: false });
    const o = await orden(e);
    await registerWorkOrderPayment(e.deps, cajero, o.id, transferencia(5_800));
    await advanceWorkOrder(e.deps, cajero, o.id);
    await advanceWorkOrder(e.deps, cajero, o.id);
    const enBlanco = await deliverWorkOrder(e.deps, admin, o.id, { reason: '   ' });
    expect(!enBlanco.ok && enBlanco.error.code).toBe('REASON_REQUIRED');
    const r = await deliverWorkOrder(e.deps, admin, o.id, { reason: '  Paga el viernes  ' });
    expect(r.ok && r.value.deliveryReason).toBe('Paga el viernes');
    const op = (await e.outbox.list()).at(-1);
    expect((op?.envelope.payload as { reason: string }).reason).toBe('Paga el viernes');
  });

  it('una entrega sin saldo no guarda motivo ni autorizador', async () => {
    const e = entorno({ requireDepositToStart: false });
    const o = await orden(e);
    await registerWorkOrderPayment(e.deps, cajero, o.id, transferencia(11_600));
    await advanceWorkOrder(e.deps, cajero, o.id);
    await advanceWorkOrder(e.deps, cajero, o.id);
    const r = await deliverWorkOrder(e.deps, cajero, o.id, { reason: 'no hace falta' });
    expect(r.ok && r.value).toMatchObject({
      deliveredWithBalance: false,
      deliveryReason: null,
      deliveryAuthorizedBy: null,
      status: 'DELIVERED',
    });
    const op = (await e.outbox.list()).at(-1);
    expect(op?.envelope.authorizedBy).toBeUndefined();
    expect((op?.envelope.payload as Record<string, unknown>).reason).toBeUndefined();
  });

  it('cancelar recorta el motivo y deja quién autorizó', async () => {
    const e = entorno();
    const o = await orden(e);
    const r = await cancelWorkOrder(e.deps, admin, o.id, '  Duplicada  ');
    expect(r.ok && r.value.cancelReason).toBe('Duplicada');
    const op = (await e.outbox.list()).at(-1);
    expect(op?.envelope.authorizedBy).toBe(ADMIN_ID);
    expect(op?.envelope.userId).toBe(ADMIN_ID);
  });
});

describe('cobros y saldo', () => {
  it('el saldo se calcula con los pagos', async () => {
    const e = entorno();
    const o = await orden(e);
    expect(await workOrderBalance(e.deps, o.id)).toBe(11_600);
    await registerWorkOrderPayment(e.deps, cajero, o.id, transferencia(2_000));
    expect(await workOrderBalance(e.deps, o.id)).toBe(9_600);
  });

  it('cobrar marca la orden por enviar y el pago lleva su destino, tipo y referencia', async () => {
    const e = entorno();
    const o = await orden(e);
    const r = await registerWorkOrderPayment(e.deps, cajero, o.id, transferencia(1_000));
    expect(r.ok && r.value.payments[0]).toMatchObject({
      targetType: 'WORK_ORDER',
      targetId: o.id,
      method: 'TRANSFER',
      reference: 'REF',
      cashReceivedCents: null,
      changeCents: null,
      cashShiftId: null,
    });
    expect((await e.deps.orders.get(o.id))?.syncStatus).toBe('SAVED_ON_TABLET');
    const op = (await e.outbox.list()).at(-1);
    const fila = (op?.envelope.payload as { rows: Record<string, unknown>[] }).rows[0];
    expect(fila).toMatchObject({ method: 'TRANSFER', amountCents: 1_000, reference: 'REF' });
    expect('cashReceivedCents' in (fila ?? {})).toBe(false);
  });

  it('un cobro en efectivo viaja con lo recibido y sin referencia', async () => {
    const e = entorno();
    const o = await orden(e);
    await registerWorkOrderPayment(e.deps, cajero, o.id, [
      { method: 'CASH', amountCents: 1_000, cashReceivedCents: 1_500 },
    ]);
    const op = (await e.outbox.list()).at(-1);
    const fila = (op?.envelope.payload as { rows: Record<string, unknown>[] }).rows[0];
    expect(fila).toMatchObject({ method: 'CASH', amountCents: 1_000, cashReceivedCents: 1_500 });
    expect('reference' in (fila ?? {})).toBe(false);
  });
});
