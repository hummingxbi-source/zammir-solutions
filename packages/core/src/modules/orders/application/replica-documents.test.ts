import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId } from '../../../shared-kernel/id';
import { err, ok } from '../../../shared-kernel/result';
import type { Payment } from '../../payments/domain/payment';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import type { WorkOrder } from '../domain/work-order';
import {
  refreshDocuments,
  type DocumentReplicaSource,
  type ReplicatedPayment,
  type ReplicatedWorkOrder,
} from './replica-documents';
import { outboxPaymentStore, outboxWorkOrderStore } from './work-order-store';

const reloj = fixedClock(new Date('2026-10-31T20:00:00.000Z'));
const ID_A = '00000000-0000-4000-8000-0000000000a1';
const ID_B = '00000000-0000-4000-8000-0000000000b2';

function orden(
  id: string,
  changeSeq: number,
  cambios: Partial<WorkOrder> = {},
): ReplicatedWorkOrder {
  return {
    id: asId<'WorkOrder'>(id),
    status: 'WAITING',
    customerId: asId<'Customer'>('00000000-0000-4000-8000-00000000c001'),
    quoteId: null,
    siteAddress: null,
    description: null,
    lines: [],
    subtotalCents: 10_000,
    taxCents: 1_600,
    totalCents: 11_600,
    depositPercentBps: 5_000,
    depositRequiredCents: 5_800,
    measuredBy: null,
    builtBy: null,
    installedBy: null,
    estimatedDeliveryDate: null,
    notes: null,
    tempFolio: 'T9-0001',
    folio: 'OT-2026-0001',
    publicCode: 'ABCDEFGH',
    issuedAt: '2026-10-31T15:00:00.000Z',
    deliveredAt: null,
    deliveredWithBalance: false,
    deliveryReason: null,
    deliveryAuthorizedBy: null,
    cancelledAt: null,
    cancelReason: null,
    cancelledFromStatus: null,
    cancelDepositPaidCents: null,
    userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
    syncStatus: 'SENT',
    reviewReason: null,
    changeSeq,
    ...cambios,
  };
}

function pago(id: string, orderId: string, centavos: number, changeSeq: number): ReplicatedPayment {
  return {
    id,
    groupId: id,
    targetType: 'WORK_ORDER',
    targetId: orderId,
    kind: 'DEPOSIT',
    method: 'TRANSFER',
    amountCents: centavos,
    cashReceivedCents: null,
    changeCents: null,
    reference: null,
    userId: 'u1',
    deviceId: null,
    paidAt: '2026-10-31T16:00:00.000Z',
    cashShiftId: null,
    changeSeq,
  };
}

function fuente(ordenes: ReplicatedWorkOrder[], pagos: ReplicatedPayment[]): DocumentReplicaSource {
  return {
    salesChangedAfter: () => Promise.resolve(ok([])),
    ordersChangedAfter: (seq, limit) =>
      Promise.resolve(ok(ordenes.filter((o) => o.changeSeq > seq).slice(0, limit))),
    paymentsChangedAfter: (seq, limit) =>
      Promise.resolve(ok(pagos.filter((p) => p.changeSeq > seq).slice(0, limit))),
  };
}

describe('réplica de órdenes y pagos', () => {
  it('baja lo nuevo, lo guarda en la tablet y la siguiente vez solo pide lo que cambió', async () => {
    const outbox = inMemorySyncOutbox({ clock: reloj });
    const origen = fuente([orden(ID_A, 1), orden(ID_B, 2)], [pago('p1', ID_A, 5_800, 1)]);
    const r = await refreshDocuments({ source: origen, outbox, clock: reloj });
    expect(r).toEqual(ok({ orders: 2, payments: 1, sales: 0 }));
    expect(await outboxWorkOrderStore(outbox).list()).toHaveLength(2);
    expect(await outboxPaymentStore(outbox).listByTarget(ID_A)).toHaveLength(1);
    const otra = await refreshDocuments({ source: origen, outbox, clock: reloj });
    expect(otra).toEqual(ok({ orders: 0, payments: 0, sales: 0 }));
  });

  it('el documento local queda sin el número de cambio y marcado como enviado', async () => {
    const outbox = inMemorySyncOutbox({ clock: reloj });
    await refreshDocuments({ source: fuente([orden(ID_A, 7)], []), outbox, clock: reloj });
    const local = await outboxWorkOrderStore(outbox).get(ID_A);
    expect(local).not.toBeNull();
    expect(local).not.toHaveProperty('changeSeq');
    expect(local?.syncStatus).toBe('SENT');
    expect(local?.updatedAt).toBe('2026-10-31T20:00:00.000Z');
  });

  it('un cambio cuando la orden ya está en la tablet la actualiza (otra tablet la avanzó)', async () => {
    const outbox = inMemorySyncOutbox({ clock: reloj });
    await refreshDocuments({ source: fuente([orden(ID_A, 1)], []), outbox, clock: reloj });
    await refreshDocuments({
      source: fuente([orden(ID_A, 5, { status: 'IN_PROCESS' })], []),
      outbox,
      clock: reloj,
    });
    expect((await outboxWorkOrderStore(outbox).get(ID_A))?.status).toBe('IN_PROCESS');
  });

  it('una orden con un cambio todavía por enviar no se sobrescribe con la del servidor', async () => {
    const outbox = inMemorySyncOutbox({ clock: reloj });
    await refreshDocuments({ source: fuente([orden(ID_A, 1)], []), outbox, clock: reloj });
    await outbox.transaction(async (tx) => {
      await tx.enqueue({
        opId: '00000000-0000-4000-8000-0000000000c9',
        deviceId: '00000000-0000-4000-8000-0000000000d1',
        type: 'UpdateWorkOrder',
        schemaVersion: 1,
        userId: '00000000-0000-4000-8000-00000000a001',
        clientCreatedAt: '2026-10-31T19:00:00.000Z',
        payload: { id: ID_A, patch: { notes: 'Nota local' } },
      });
      await tx.putDocument('work_orders', ID_A, { ...orden(ID_A, 1), notes: 'Nota local' });
    });
    await refreshDocuments({
      source: fuente([orden(ID_A, 9, { notes: 'Nota del servidor' })], []),
      outbox,
      clock: reloj,
    });
    expect((await outboxWorkOrderStore(outbox).get(ID_A))?.notes).toBe('Nota local');
  });

  it('un pago que ya está no se toca: los pagos solo se agregan', async () => {
    const outbox = inMemorySyncOutbox({ clock: reloj });
    await refreshDocuments({
      source: fuente([], [pago('p1', ID_A, 5_800, 1)]),
      outbox,
      clock: reloj,
    });
    await refreshDocuments({
      source: fuente([], [pago('p1', ID_A, 999, 2)]),
      outbox,
      clock: reloj,
    });
    const pagos: readonly Payment[] = await outboxPaymentStore(outbox).listByTarget(ID_A);
    expect(pagos).toHaveLength(1);
    expect(pagos[0]?.amountCents).toBe(5_800);
  });

  it('si el servidor no responde, lo guardado se queda y el error se informa', async () => {
    const outbox = inMemorySyncOutbox({ clock: reloj });
    await refreshDocuments({ source: fuente([orden(ID_A, 1)], []), outbox, clock: reloj });
    const roto: DocumentReplicaSource = {
      salesChangedAfter: () => Promise.resolve(err({ code: 'DOCUMENTS_UNAVAILABLE' })),
      ordersChangedAfter: () => Promise.resolve(err({ code: 'DOCUMENTS_UNAVAILABLE' })),
      paymentsChangedAfter: () => Promise.resolve(err({ code: 'DOCUMENTS_UNAVAILABLE' })),
    };
    expect(await refreshDocuments({ source: roto, outbox, clock: reloj })).toEqual(
      err({ code: 'DOCUMENTS_UNAVAILABLE' }),
    );
    expect(await outboxWorkOrderStore(outbox).list()).toHaveLength(1);
  });
});
