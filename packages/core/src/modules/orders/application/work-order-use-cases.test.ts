import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId } from '../../../shared-kernel/id';
import { seededRandom } from '../../../shared-kernel/random';
import type { Authorization } from '../../identity/application/authorize-with-admin-pin';
import { outboxQuoteStore } from '../../quotes/application/quote-store';
import type { QuoteActor } from '../../quotes/application/quote-use-cases';
import type { Quote, QuoteLine } from '../../quotes/domain/quote';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import { parseOperation } from '../../sync/domain/operation';
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
import { outboxPaymentStore, outboxWarrantyReader, outboxWorkOrderStore } from './work-order-store';

const CLIENTE = asId<'Customer'>('00000000-0000-4000-8000-00000000c001');
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

function linea(totalCents: number): QuoteLine {
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

function cotizacion(estado: Quote['status'], totalCents = 11_600): Quote {
  return {
    id: ids.newId<'Quote'>(),
    status: estado,
    customerId: CLIENTE,
    siteAddress: 'Calle 5, Otumba',
    lines: [linea(totalCents)],
    userId: cajero.userId,
    tempFolio: 'T1-0001',
    folio: 'COT-2026-0001',
    publicCode: 'ABCDEFGH',
    issuedAt: '2026-10-31T15:00:00.000Z',
    validUntil: '2026-11-15',
    conditionsText: 'Condición',
    privacyNoticeVersion: null,
    catalogVersion: null,
    discountAuthorizedBy: null,
    syncStatus: 'SENT',
    reviewReason: null,
    updatedAt: '2026-10-31T15:00:00.000Z',
  };
}

function entorno(ajustes: Partial<OrderDeps['settings']> = {}, ahora = '2026-10-31T18:00:00.000Z') {
  const reloj = fixedClock(new Date(ahora));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const deps: OrderDeps = {
    orders: outboxWorkOrderStore(outbox),
    payments: outboxPaymentStore(outbox),
    quotes: outboxQuoteStore(outbox),
    outbox,
    idGenerator: ids,
    clock: reloj,
    random: seededRandom(11),
    device: { id: '00000000-0000-4000-8000-0000000000d1', series: 1 },
    settings: {
      depositPercentBps: 5_000,
      requireDepositToStart: true,
      warrantyMonthsDefault: null,
      ...ajustes,
    },
  };
  return { deps, outbox, warranties: outboxWarrantyReader(outbox) };
}

async function ordenDesdeCotizacion(e: ReturnType<typeof entorno>, total = 11_600) {
  const q = cotizacion('ACCEPTED', total);
  await e.deps.quotes.save(q);
  const r = await convertQuoteToWorkOrder(e.deps, cajero, q.id);
  if (!r.ok) {
    throw new Error('no se pudo crear la orden de prueba');
  }
  return { orden: r.value, quote: q };
}

const transferencia = (centavos: number) =>
  [{ method: 'TRANSFER', amountCents: centavos, reference: 'REF' }] as const;

describe('crear la orden desde una cotización aceptada', () => {
  it('copia cliente, líneas y totales congelados, y deja ligada la cotización', async () => {
    const e = entorno();
    const { orden, quote } = await ordenDesdeCotizacion(e);
    expect(orden.customerId).toBe(CLIENTE);
    expect(orden.lines).toEqual(quote.lines);
    expect(orden.totalCents).toBe(11_600);
    expect(orden.subtotalCents + orden.taxCents).toBe(orden.totalCents);
    expect(orden.status).toBe('WAITING');
    expect(orden.tempFolio).toBe('T1-0001');
    expect(orden.folio).toBeNull();
    expect(orden.syncStatus).toBe('SAVED_ON_TABLET');
    const ligada = await e.deps.quotes.get(quote.id);
    expect(ligada?.convertedWorkOrderId).toBe(orden.id);
  });

  it('la operación CreateWorkOrder queda en la cola y es válida', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    const cola = await e.outbox.list();
    expect(cola).toHaveLength(1);
    expect(cola[0]?.envelope.type).toBe('CreateWorkOrder');
    expect(parseOperation(cola[0]?.envelope).ok).toBe(true);
    expect((cola[0]?.envelope.payload as { id: string }).id).toBe(orden.id);
  });

  it('el anticipo exigido es el porcentaje configurado, redondeado hacia arriba', async () => {
    const par = await ordenDesdeCotizacion(entorno(), 10_000);
    expect(par.orden.depositRequiredCents).toBe(5_000);
    const impar = await ordenDesdeCotizacion(entorno(), 10_001);
    expect(impar.orden.depositRequiredCents).toBe(5_001);
    const treinta = await ordenDesdeCotizacion(entorno({ depositPercentBps: 3_000 }), 10_001);
    expect(treinta.orden.depositRequiredCents).toBe(3_001);
  });

  it('una cotización que no está aceptada no se convierte', async () => {
    const e = entorno();
    const q = cotizacion('SENT');
    await e.deps.quotes.save(q);
    expect(await convertQuoteToWorkOrder(e.deps, cajero, q.id)).toEqual({
      ok: false,
      error: { code: 'QUOTE_NOT_ACCEPTED' },
    });
    expect(await e.outbox.list()).toHaveLength(0);
  });

  it('una cotización no se convierte dos veces', async () => {
    const e = entorno();
    const { quote } = await ordenDesdeCotizacion(e);
    const otra = await convertQuoteToWorkOrder(e.deps, cajero, quote.id);
    expect(!otra.ok && otra.error.code).toBe('ALREADY_CONVERTED');
    expect(await e.outbox.list()).toHaveLength(1);
  });

  it('una cotización que no existe, o quien no ha entrado con su PIN, se rechazan', async () => {
    const e = entorno();
    const falsa = await convertQuoteToWorkOrder(e.deps, cajero, 'no-existe');
    expect(!falsa.ok && falsa.error.code).toBe('NOT_FOUND');
    const q = cotizacion('ACCEPTED');
    await e.deps.quotes.save(q);
    const sinPersona = await convertQuoteToWorkOrder(
      e.deps,
      { userId: cajero.userId, role: null },
      q.id,
    );
    expect(!sinPersona.ok && sinPersona.error.code).toBe('NOT_AUTHORIZED');
  });

  it('una orden manual se captura sin cotización y también sale como operación', async () => {
    const e = entorno();
    const r = await createManualWorkOrder(e.deps, cajero, {
      customerId: CLIENTE,
      siteAddress: null,
      description: 'Puerta de baño',
      lines: [linea(23_200)],
    });
    expect(r.ok && r.value.quoteId).toBeNull();
    expect(r.ok && r.value.depositRequiredCents).toBe(11_600);
    expect(await e.outbox.list()).toHaveLength(1);
  });

  it('una orden sin líneas se rechaza', async () => {
    const e = entorno();
    const r = await createManualWorkOrder(e.deps, cajero, {
      customerId: CLIENTE,
      siteAddress: null,
      description: null,
      lines: [],
    });
    expect(!r.ok && r.error.code).toBe('EMPTY_ORDER');
  });
});

describe('datos de la orden', () => {
  it('guarda responsables, fecha estimada y notas, y manda solo lo que cambió', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    const r = await updateWorkOrder(e.deps, cajero, orden.id, {
      measuredBy: cajero.userId,
      notes: '  Llevar escalera  ',
    });
    expect(r.ok && r.value.measuredBy).toBe(cajero.userId);
    expect(r.ok && r.value.notes).toBe('Llevar escalera');
    const op = (await e.outbox.list()).at(-1);
    expect(op?.envelope.type).toBe('UpdateWorkOrder');
    expect(Object.keys((op?.envelope.payload as { patch: object }).patch).sort()).toEqual([
      'measuredBy',
      'notes',
    ]);
    expect(parseOperation(op?.envelope).ok).toBe(true);
  });

  it('una fecha mal escrita o un parche vacío se rechazan', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    const fecha = await updateWorkOrder(e.deps, cajero, orden.id, {
      estimatedDeliveryDate: '12/11/2026',
    });
    expect(!fecha.ok && fecha.error.code).toBe('INVALID_DATE');
    const vacio = await updateWorkOrder(e.deps, cajero, orden.id, {});
    expect(!vacio.ok && vacio.error.code).toBe('NOTHING_TO_UPDATE');
  });

  it('borrar un dato lo manda como vacío', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    await updateWorkOrder(e.deps, cajero, orden.id, { notes: 'algo' });
    const r = await updateWorkOrder(e.deps, cajero, orden.id, { notes: '   ' });
    expect(r.ok && r.value.notes).toBeNull();
  });
});

describe('cobros de la orden', () => {
  it('el primero es anticipo, el siguiente saldo, y el saldo se calcula siempre', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    const a = await registerWorkOrderPayment(e.deps, cajero, orden.id, [
      { method: 'CASH', amountCents: 5_800, cashReceivedCents: 6_000 },
    ]);
    expect(a.ok && a.value.payments[0]?.kind).toBe('DEPOSIT');
    expect(a.ok && a.value.plan.changeCents).toBe(200);
    expect(await workOrderBalance(e.deps, orden.id)).toBe(5_800);
    const b = await registerWorkOrderPayment(e.deps, cajero, orden.id, transferencia(5_800));
    expect(b.ok && b.value.payments[0]?.kind).toBe('BALANCE');
    expect(await workOrderBalance(e.deps, orden.id)).toBe(0);
  });

  it('cada pago es una fila nueva con quién cobró, el dispositivo y la hora; nada se sobrescribe', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    await registerWorkOrderPayment(e.deps, cajero, orden.id, transferencia(1_000));
    await registerWorkOrderPayment(e.deps, admin, orden.id, transferencia(2_000));
    const pagos = await e.deps.payments.listByTarget(orden.id);
    expect(pagos).toHaveLength(2);
    expect(new Set(pagos.map((p) => p.id)).size).toBe(2);
    expect(pagos.map((p) => p.userId)).toEqual([cajero.userId, admin.userId]);
    expect(pagos.every((p) => p.deviceId === e.deps.device.id && p.paidAt.endsWith('Z'))).toBe(
      true,
    );
  });

  it('un cobro mixto son dos filas del mismo grupo', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    const r = await registerWorkOrderPayment(e.deps, cajero, orden.id, [
      { method: 'CASH', amountCents: 3_000, cashReceivedCents: 3_000 },
      { method: 'TRANSFER', amountCents: 2_800, reference: 'R' },
    ]);
    expect(r.ok && new Set(r.value.payments.map((p) => p.groupId)).size).toBe(1);
    expect(r.ok && r.value.payments).toHaveLength(2);
    const op = (await e.outbox.list()).at(-1);
    expect(op?.envelope.type).toBe('RegisterPayment');
    expect(parseOperation(op?.envelope).ok).toBe(true);
  });

  it('un pago mayor al saldo se rechaza y no guarda nada', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    const antes = (await e.outbox.list()).length;
    const r = await registerWorkOrderPayment(e.deps, cajero, orden.id, transferencia(11_601));
    expect(!r.ok && r.error.code).toBe('EXCEEDS_BALANCE');
    expect((await e.outbox.list()).length).toBe(antes);
    expect(await e.deps.payments.list()).toHaveLength(0);
  });

  it('a una orden cancelada no se le cobra; sin persona activa tampoco', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    const sin = await registerWorkOrderPayment(
      e.deps,
      { userId: cajero.userId, role: null },
      orden.id,
      transferencia(1),
    );
    expect(!sin.ok && sin.error.code).toBe('NOT_AUTHORIZED');
    await cancelWorkOrder(e.deps, admin, orden.id, 'Duplicada');
    const r = await registerWorkOrderPayment(e.deps, cajero, orden.id, transferencia(1));
    expect(!r.ok && r.error.code).toBe('ORDER_CANCELLED');
  });
});

describe('avanzar la orden', () => {
  it('sin anticipo un cajero necesita la autorización de un administrador', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    const sin = await advanceWorkOrder(e.deps, cajero, orden.id);
    expect(!sin.ok && sin.error.code).toBe('NEEDS_AUTHORIZATION');
    const con = await advanceWorkOrder(e.deps, cajero, orden.id, conPin);
    expect(con.ok && con.value.status).toBe('IN_PROCESS');
    const op = (await e.outbox.list()).at(-1);
    expect(op?.envelope.authorizedBy).toBe(ADMIN_ID);
  });

  it('un administrador se autoriza a sí mismo', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    const r = await advanceWorkOrder(e.deps, admin, orden.id);
    expect(r.ok && r.value.status).toBe('IN_PROCESS');
    expect((await e.outbox.list()).at(-1)?.envelope.authorizedBy).toBe(ADMIN_ID);
  });

  it('con anticipo registrado avanza sin autorización: en espera → en proceso → listo', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    await registerWorkOrderPayment(e.deps, cajero, orden.id, transferencia(5_800));
    const a = await advanceWorkOrder(e.deps, cajero, orden.id);
    const b = await advanceWorkOrder(e.deps, cajero, orden.id);
    expect(a.ok && a.value.status).toBe('IN_PROCESS');
    expect(b.ok && b.value.status).toBe('READY');
    expect((await e.outbox.list()).at(-1)?.envelope.authorizedBy).toBeUndefined();
  });

  it('con el ajuste apagado no pide anticipo para empezar (configurable)', async () => {
    const e = entorno({ requireDepositToStart: false });
    const { orden } = await ordenDesdeCotizacion(e);
    const r = await advanceWorkOrder(e.deps, cajero, orden.id);
    expect(r.ok && r.value.status).toBe('IN_PROCESS');
  });

  it('"Avanzar" no entrega ni sigue después de listo; una cancelada no avanza', async () => {
    const e = entorno({ requireDepositToStart: false });
    const { orden } = await ordenDesdeCotizacion(e);
    await advanceWorkOrder(e.deps, cajero, orden.id);
    await advanceWorkOrder(e.deps, cajero, orden.id);
    const mas = await advanceWorkOrder(e.deps, cajero, orden.id);
    expect(!mas.ok && mas.error.code).toBe('INVALID_TRANSITION');
    const otra = await ordenDesdeCotizacion(e);
    await cancelWorkOrder(e.deps, admin, otra.orden.id, 'Error');
    const c = await advanceWorkOrder(e.deps, cajero, otra.orden.id);
    expect(!c.ok && c.error.code).toBe('INVALID_TRANSITION');
  });
});

describe('entregar', () => {
  async function listaParaEntregar(e: ReturnType<typeof entorno>, pagado: number) {
    const { orden } = await ordenDesdeCotizacion(e);
    await registerWorkOrderPayment(e.deps, cajero, orden.id, transferencia(pagado));
    await advanceWorkOrder(e.deps, cajero, orden.id);
    await advanceWorkOrder(e.deps, cajero, orden.id);
    return orden.id;
  }

  it('con el saldo liquidado un cajero entrega y se crea la garantía sin duración inventada', async () => {
    const e = entorno();
    const id = await listaParaEntregar(e, 5_800);
    await registerWorkOrderPayment(e.deps, cajero, id, transferencia(5_800));
    const r = await deliverWorkOrder(e.deps, cajero, id);
    expect(r.ok && r.value.status).toBe('DELIVERED');
    expect(r.ok && r.value.deliveredWithBalance).toBe(false);
    const garantia = await e.warranties.get(id);
    expect(garantia).toMatchObject({
      workOrderId: id,
      durationMonths: null,
      coverage: null,
      exclusions: null,
    });
    expect(garantia?.startsOn).toBe('2026-10-31');
  });

  it('la duración de la garantía sale de la configuración cuando existe', async () => {
    const e = entorno({ warrantyMonthsDefault: 12 });
    const id = await listaParaEntregar(e, 11_600);
    await deliverWorkOrder(e.deps, cajero, id);
    expect((await e.warranties.get(id))?.durationMonths).toBe(12);
  });

  it('con saldo, un cajero sin administrador es rechazado', async () => {
    const e = entorno();
    const id = await listaParaEntregar(e, 5_800);
    const r = await deliverWorkOrder(e.deps, cajero, id, { reason: 'Paga mañana' });
    expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
    expect((await e.deps.orders.get(id))?.status).toBe('READY');
  });

  it('con saldo, un administrador sin motivo es rechazado y con motivo entrega y registra quién autorizó', async () => {
    const e = entorno();
    const id = await listaParaEntregar(e, 5_800);
    const sin = await deliverWorkOrder(e.deps, admin, id);
    expect(!sin.ok && sin.error.code).toBe('REASON_REQUIRED');
    const con = await deliverWorkOrder(e.deps, admin, id, { reason: 'Liquida el viernes' });
    expect(con.ok && con.value.deliveredWithBalance).toBe(true);
    expect(con.ok && con.value.deliveryAuthorizedBy).toBe(ADMIN_ID);
    expect(con.ok && con.value.deliveryReason).toBe('Liquida el viernes');
    expect(await workOrderBalance(e.deps, id)).toBe(5_800);
  });

  it('un cajero con el PIN de un administrador y motivo puede entregar con saldo', async () => {
    const e = entorno();
    const id = await listaParaEntregar(e, 5_800);
    const r = await deliverWorkOrder(e.deps, cajero, id, {
      reason: 'Obra lejana',
      authorization: conPin,
    });
    expect(r.ok && r.value.status).toBe('DELIVERED');
    expect((await e.outbox.list()).at(-1)?.envelope.authorizedBy).toBe(ADMIN_ID);
  });

  it('solo se entrega lo que está listo', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    const r = await deliverWorkOrder(e.deps, admin, orden.id, { reason: 'x' });
    expect(!r.ok && r.error.code).toBe('INVALID_TRANSITION');
  });
});

describe('cancelar', () => {
  it('un cajero no cancela; un administrador sí, con motivo, y queda lo que había recibido', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    await registerWorkOrderPayment(e.deps, cajero, orden.id, transferencia(5_800));
    const cajeroIntenta = await cancelWorkOrder(e.deps, cajero, orden.id, 'Se arrepintió');
    expect(!cajeroIntenta.ok && cajeroIntenta.error.code).toBe('NOT_AUTHORIZED');
    const sinMotivo = await cancelWorkOrder(e.deps, admin, orden.id, '  ');
    expect(!sinMotivo.ok && sinMotivo.error.code).toBe('REASON_REQUIRED');
    const r = await cancelWorkOrder(e.deps, admin, orden.id, 'Se arrepintió');
    expect(r.ok && r.value.status).toBe('CANCELLED');
    expect(r.ok && r.value.cancelledFromStatus).toBe('WAITING');
    expect(r.ok && r.value.cancelDepositPaidCents).toBe(5_800);
    // Los pagos siguen ahí: nada se borra y no hay devolución automática (PD-07).
    expect(await e.deps.payments.listByTarget(orden.id)).toHaveLength(1);
  });

  it('un cajero con el PIN de un administrador puede cancelar', async () => {
    const e = entorno();
    const { orden } = await ordenDesdeCotizacion(e);
    const r = await cancelWorkOrder(e.deps, cajero, orden.id, 'Error de captura', conPin);
    expect(r.ok && r.value.status).toBe('CANCELLED');
    expect((await e.outbox.list()).at(-1)?.envelope.authorizedBy).toBe(ADMIN_ID);
  });

  it('una orden entregada o ya cancelada no se cancela', async () => {
    const e = entorno({ requireDepositToStart: false });
    const { orden } = await ordenDesdeCotizacion(e);
    await cancelWorkOrder(e.deps, admin, orden.id, 'Primera');
    const otra = await cancelWorkOrder(e.deps, admin, orden.id, 'Segunda');
    expect(!otra.ok && otra.error.code).toBe('INVALID_TRANSITION');
  });
});
