import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { COUNTER_SALES_COLLECTION } from '../../counter/application/counter-sale-store';
import { reconcileSales } from '../../counter/application/reconcile-sales';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import {
  codigoPublicoDePrueba,
  createCounterSaleOperation,
  createWorkOrderOperation,
} from '../../sync/contracts/operation-receiver.contract';
import type { OperationEnvelope, OperationResult } from '../../sync/domain/operation';
import { reconcileOrders } from './reconcile-orders';
import { WORK_ORDERS_COLLECTION } from './work-order-store';

const DISPOSITIVO = '00000000-0000-4000-8000-0000000000d1';
const PERSONA = '00000000-0000-4000-8000-00000000a001';
const CLIENTE = '00000000-0000-4000-8000-00000000c001';
const ORDEN = '00000000-0000-4000-8000-00000000e001';
const VENTA = '00000000-0000-4000-8000-00000000e002';

let contador = 0;
const uuid = () => {
  contador += 1;
  return `00000000-0000-4000-8000-${String(contador + 700).padStart(12, '0')}`;
};

function sinSeq(op: Record<string, unknown>): Omit<OperationEnvelope, 'seq'> {
  return Object.fromEntries(Object.entries(op).filter(([clave]) => clave !== 'seq')) as Omit<
    OperationEnvelope,
    'seq'
  >;
}

const nueva = () => inMemorySyncOutbox({ clock: fixedClock(new Date('2026-10-31T15:00:00.000Z')) });
type Cola = ReturnType<typeof nueva>;

async function conOrdenEncolada() {
  const outbox = nueva();
  const op = createWorkOrderOperation({
    opId: uuid(),
    deviceId: DISPOSITIVO,
    seq: 1,
    userId: PERSONA,
    customerId: CLIENTE,
    year: 2026,
    newUuid: uuid,
    publicCode: codigoPublicoDePrueba(1),
    orderId: ORDEN,
  });
  await outbox.transaction(async (tx) => {
    await tx.enqueue(sinSeq(op));
    await tx.putDocument(WORK_ORDERS_COLLECTION, ORDEN, {
      id: ORDEN,
      folio: null,
      tempFolio: 'T1-0001',
      syncStatus: 'SAVED_ON_TABLET',
      reviewReason: null,
    });
  });
  return { outbox, opId: op.opId as string };
}

async function conVentaEncolada() {
  const outbox = nueva();
  const op = createCounterSaleOperation({
    opId: uuid(),
    deviceId: DISPOSITIVO,
    seq: 1,
    userId: PERSONA,
    year: 2026,
    newUuid: uuid,
    publicCode: codigoPublicoDePrueba(2),
    saleId: VENTA,
  });
  await outbox.transaction(async (tx) => {
    await tx.enqueue(sinSeq(op));
    await tx.putDocument(COUNTER_SALES_COLLECTION, VENTA, {
      id: VENTA,
      folio: null,
      tempFolio: 'T1-0001',
      syncStatus: 'SAVED_ON_TABLET',
      reviewReason: null,
    });
  });
  return { outbox, opId: op.opId as string };
}

const aplicada = (folio: string, id: string): OperationResult => ({
  ok: true,
  status: 'APPLIED',
  folio,
  documentId: id,
});

async function documento(outbox: Cola, coleccion: string, id: string) {
  return (await outbox.transaction((tx) => tx.getDocument(coleccion, id))) as {
    folio: string | null;
    syncStatus: string;
    reviewReason: string | null;
  };
}

describe('reconciliar órdenes con lo que confirmó el servidor', () => {
  it('mientras la operación está pendiente no cambia nada', async () => {
    const { outbox } = await conOrdenEncolada();
    expect(await reconcileOrders(outbox)).toBe(0);
    expect((await documento(outbox, WORK_ORDERS_COLLECTION, ORDEN)).syncStatus).toBe(
      'SAVED_ON_TABLET',
    );
  });

  it('al confirmarse recibe su folio OT definitivo y queda como enviada; repetir no cambia nada', async () => {
    const { outbox, opId } = await conOrdenEncolada();
    await outbox.markApplied(opId, aplicada('OT-2026-0007', ORDEN));
    expect(await reconcileOrders(outbox)).toBe(1);
    const o = await documento(outbox, WORK_ORDERS_COLLECTION, ORDEN);
    expect(o.folio).toBe('OT-2026-0007');
    expect(o.syncStatus).toBe('SENT');
    expect(await reconcileOrders(outbox)).toBe(0);
  });

  it('con otro cambio todavía por salir sigue como guardada en la tablet', async () => {
    const { outbox, opId } = await conOrdenEncolada();
    await outbox.markApplied(opId, aplicada('OT-2026-0007', ORDEN));
    await outbox.transaction(async (tx) => {
      await tx.enqueue({
        opId: uuid(),
        deviceId: DISPOSITIVO,
        type: 'UpdateWorkOrder',
        schemaVersion: 1,
        userId: PERSONA,
        clientCreatedAt: '2026-10-31T16:00:00.000Z',
        payload: { id: ORDEN, patch: { notes: 'Nota' } },
      });
    });
    await reconcileOrders(outbox);
    const o = await documento(outbox, WORK_ORDERS_COLLECTION, ORDEN);
    expect(o.folio).toBe('OT-2026-0007');
    expect(o.syncStatus).toBe('SAVED_ON_TABLET');
  });

  it('un cobro pendiente de la orden también la mantiene por enviar', async () => {
    const { outbox, opId } = await conOrdenEncolada();
    await outbox.markApplied(opId, aplicada('OT-2026-0007', ORDEN));
    await outbox.transaction(async (tx) => {
      await tx.enqueue({
        opId: uuid(),
        deviceId: DISPOSITIVO,
        type: 'RegisterPayment',
        schemaVersion: 1,
        userId: PERSONA,
        clientCreatedAt: '2026-10-31T16:00:00.000Z',
        payload: {
          groupId: uuid(),
          target: { type: 'WORK_ORDER', id: ORDEN },
          kind: 'DEPOSIT',
          paidAt: '2026-10-31T16:00:00.000Z',
          rows: [{ id: uuid(), method: 'TRANSFER', amountCents: 1_000 }],
        },
      });
    });
    await reconcileOrders(outbox);
    expect((await documento(outbox, WORK_ORDERS_COLLECTION, ORDEN)).syncStatus).toBe(
      'SAVED_ON_TABLET',
    );
  });

  it('si el servidor la dejó por revisar, guarda el motivo; si no, no lo toca', async () => {
    const { outbox, opId } = await conOrdenEncolada();
    await outbox.markApplied(opId, {
      ok: true,
      status: 'TO_REVIEW',
      reason: 'QUOTE_NOT_ACCEPTED',
      folio: 'OT-2026-0007',
      documentId: ORDEN,
    });
    await reconcileOrders(outbox);
    expect((await documento(outbox, WORK_ORDERS_COLLECTION, ORDEN)).reviewReason).toBe(
      'QUOTE_NOT_ACCEPTED',
    );
    const otra = await conOrdenEncolada();
    await otra.outbox.markApplied(otra.opId, aplicada('OT-2026-0008', ORDEN));
    await reconcileOrders(otra.outbox);
    expect((await documento(otra.outbox, WORK_ORDERS_COLLECTION, ORDEN)).reviewReason).toBeNull();
  });

  it('una operación de una orden que no está en la tablet no inventa nada', async () => {
    const outbox = nueva();
    const op = createWorkOrderOperation({
      opId: uuid(),
      deviceId: DISPOSITIVO,
      seq: 1,
      userId: PERSONA,
      customerId: CLIENTE,
      year: 2026,
      newUuid: uuid,
      publicCode: codigoPublicoDePrueba(3),
      orderId: ORDEN,
    });
    await outbox.transaction(async (tx) => {
      await tx.enqueue(sinSeq(op));
    });
    await outbox.markApplied(op.opId as string, aplicada('OT-2026-0009', ORDEN));
    expect(await reconcileOrders(outbox)).toBe(0);
    expect(
      await outbox.transaction((tx) => tx.getDocument(WORK_ORDERS_COLLECTION, ORDEN)),
    ).toBeUndefined();
  });

  it('una operación que no es de órdenes se ignora', async () => {
    const outbox = nueva();
    await outbox.transaction(async (tx) => {
      await tx.enqueue({
        opId: uuid(),
        deviceId: DISPOSITIVO,
        type: 'UpsertCustomer',
        schemaVersion: 1,
        userId: PERSONA,
        clientCreatedAt: '2026-10-31T16:00:00.000Z',
        payload: { id: ORDEN, name: 'Ana', phone: '5512345678' },
      });
      await tx.putDocument(WORK_ORDERS_COLLECTION, ORDEN, {
        id: ORDEN,
        folio: null,
        syncStatus: 'SAVED_ON_TABLET',
        reviewReason: null,
      });
    });
    const op = (await outbox.list())[0];
    await outbox.markApplied(op?.envelope.opId ?? '', aplicada('X', ORDEN));
    expect(await reconcileOrders(outbox)).toBe(0);
  });
});

describe('reconciliar ventas con lo que confirmó el servidor', () => {
  it('mientras la operación está pendiente no cambia nada', async () => {
    const { outbox } = await conVentaEncolada();
    expect(await reconcileSales(outbox)).toBe(0);
    expect((await documento(outbox, COUNTER_SALES_COLLECTION, VENTA)).syncStatus).toBe(
      'SAVED_ON_TABLET',
    );
  });

  it('al confirmarse recibe su folio V definitivo y queda como enviada; repetir no cambia nada', async () => {
    const { outbox, opId } = await conVentaEncolada();
    await outbox.markApplied(opId, aplicada('V-2026-0003', VENTA));
    expect(await reconcileSales(outbox)).toBe(1);
    const v = await documento(outbox, COUNTER_SALES_COLLECTION, VENTA);
    expect(v.folio).toBe('V-2026-0003');
    expect(v.syncStatus).toBe('SENT');
    expect(await reconcileSales(outbox)).toBe(0);
  });

  it('una cancelación pendiente la mantiene por enviar', async () => {
    const { outbox, opId } = await conVentaEncolada();
    await outbox.markApplied(opId, aplicada('V-2026-0003', VENTA));
    await outbox.transaction(async (tx) => {
      await tx.enqueue({
        opId: uuid(),
        deviceId: DISPOSITIVO,
        type: 'CancelCounterSale',
        schemaVersion: 1,
        userId: PERSONA,
        clientCreatedAt: '2026-10-31T16:00:00.000Z',
        payload: { id: VENTA, reason: 'Error' },
      });
    });
    await reconcileSales(outbox);
    expect((await documento(outbox, COUNTER_SALES_COLLECTION, VENTA)).syncStatus).toBe(
      'SAVED_ON_TABLET',
    );
  });

  it('si el servidor la dejó por revisar, guarda el motivo', async () => {
    const { outbox, opId } = await conVentaEncolada();
    await outbox.markApplied(opId, {
      ok: true,
      status: 'TO_REVIEW',
      reason: 'PAYMENT_NOT_EQUAL_TOTAL',
      folio: 'V-2026-0003',
      documentId: VENTA,
    });
    await reconcileSales(outbox);
    expect((await documento(outbox, COUNTER_SALES_COLLECTION, VENTA)).reviewReason).toBe(
      'PAYMENT_NOT_EQUAL_TOTAL',
    );
  });

  it('una venta que no está en la tablet no se inventa, y una operación de otro tipo se ignora', async () => {
    const outbox = nueva();
    const op = createCounterSaleOperation({
      opId: uuid(),
      deviceId: DISPOSITIVO,
      seq: 1,
      userId: PERSONA,
      year: 2026,
      newUuid: uuid,
      publicCode: codigoPublicoDePrueba(4),
      saleId: VENTA,
    });
    await outbox.transaction(async (tx) => {
      await tx.enqueue(sinSeq(op));
    });
    await outbox.markApplied(op.opId as string, aplicada('V-2026-0004', VENTA));
    expect(await reconcileSales(outbox)).toBe(0);
    expect(
      await outbox.transaction((tx) => tx.getDocument(COUNTER_SALES_COLLECTION, VENTA)),
    ).toBeUndefined();
  });
});
