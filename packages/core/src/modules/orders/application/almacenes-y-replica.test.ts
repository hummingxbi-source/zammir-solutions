import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId } from '../../../shared-kernel/id';
import { ok } from '../../../shared-kernel/result';
import {
  COUNTER_SALES_COLLECTION,
  outboxCounterSaleStore,
} from '../../counter/application/counter-sale-store';
import type { CounterSale } from '../../counter/domain/counter-sale';
import type { Payment } from '../../payments/domain/payment';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import type { WorkOrder } from '../domain/work-order';
import {
  DOCUMENT_REPLICA_PAGE_SIZE,
  refreshDocuments,
  type DocumentReplicaSource,
  type ReplicatedPayment,
  type ReplicatedSale,
  type ReplicatedShift,
  type ReplicatedWorkOrder,
} from './replica-documents';
import {
  outboxPaymentStore,
  outboxWarrantyReader,
  outboxWorkOrderStore,
  PAYMENTS_COLLECTION,
  WARRANTIES_COLLECTION,
  WORK_ORDERS_COLLECTION,
} from './work-order-store';

const VENTA_U = '00000000-0000-4000-8000-0000000000a5';
const ORDEN_U = '00000000-0000-4000-8000-0000000000a6';
const reloj = fixedClock(new Date('2026-10-31T20:00:00.000Z'));
const nueva = () => inMemorySyncOutbox({ clock: reloj });

function orden(id: string, cambios: Record<string, unknown> = {}): WorkOrder {
  return {
    id,
    status: 'WAITING',
    customerId: 'c1',
    totalCents: 100,
    issuedAt: '2026-10-31T15:00:00.000Z',
    updatedAt: '2026-10-31T15:00:00.000Z',
    ...cambios,
  } as unknown as WorkOrder;
}

function pago(id: string, targetId: string, paidAt: string): Payment {
  return { id, targetId, paidAt, amountCents: 10 } as unknown as Payment;
}

describe('almacén de órdenes', () => {
  it('guarda, lee y lista las órdenes; una que no existe es nula', async () => {
    const outbox = nueva();
    const almacen = outboxWorkOrderStore(outbox);
    expect(await almacen.get('x')).toBeNull();
    await almacen.save(orden('a'));
    await almacen.save(orden('b'));
    expect((await almacen.get('a'))?.id).toBe('a');
    expect((await almacen.list()).map((o) => o.id).sort()).toEqual(['a', 'b']);
  });

  it('las de un cliente salen de la más reciente a la más antigua y no mezclan a otros', async () => {
    const almacen = outboxWorkOrderStore(nueva());
    await almacen.save(orden('vieja', { updatedAt: '2026-10-01T10:00:00.000Z' }));
    await almacen.save(orden('nueva', { updatedAt: '2026-10-30T10:00:00.000Z' }));
    await almacen.save(
      orden('ajena', { customerId: 'otro', updatedAt: '2026-10-31T10:00:00.000Z' }),
    );
    const r = await almacen.listByCustomer(asId<'Customer'>('c1'));
    expect(r.map((o) => o.id)).toEqual(['nueva', 'vieja']);
  });
});

describe('almacén de pagos', () => {
  it('los de una orden salen en el orden en que se cobraron y no mezclan otras órdenes', async () => {
    const outbox = nueva();
    await outbox.transaction(async (tx) => {
      await tx.putDocument(PAYMENTS_COLLECTION, 'p2', pago('p2', 'o1', '2026-10-31T12:00:00.000Z'));
      await tx.putDocument(PAYMENTS_COLLECTION, 'p1', pago('p1', 'o1', '2026-10-30T12:00:00.000Z'));
      await tx.putDocument(PAYMENTS_COLLECTION, 'p3', pago('p3', 'o2', '2026-10-29T12:00:00.000Z'));
    });
    const almacen = outboxPaymentStore(outbox);
    expect((await almacen.listByTarget('o1')).map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(await almacen.list()).toHaveLength(3);
  });
});

describe('lector de garantías y almacén de ventas', () => {
  it('una garantía que no existe es nula y una guardada se lee', async () => {
    const outbox = nueva();
    const lector = outboxWarrantyReader(outbox);
    expect(await lector.get('o1')).toBeNull();
    await outbox.transaction((tx) =>
      tx.putDocument(WARRANTIES_COLLECTION, 'o1', { workOrderId: 'o1', startsOn: '2026-10-31' }),
    );
    expect((await lector.get('o1'))?.startsOn).toBe('2026-10-31');
  });

  it('las ventas se guardan, se leen y se listan; una que no existe es nula', async () => {
    const almacen = outboxCounterSaleStore(nueva());
    expect(await almacen.get('v')).toBeNull();
    await almacen.save({ id: 'v1', totalCents: 5 } as unknown as CounterSale);
    await almacen.save({ id: 'v2', totalCents: 6 } as unknown as CounterSale);
    expect((await almacen.get('v1'))?.totalCents).toBe(5);
    expect(await almacen.list()).toHaveLength(2);
  });
});

function ordenReplicada(id: string, changeSeq: number, extra: Record<string, unknown> = {}) {
  return { ...orden(id), changeSeq, ...extra } as unknown as ReplicatedWorkOrder;
}
function ventaReplicada(id: string, changeSeq: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    status: 'COMPLETED',
    totalCents: 100,
    changeSeq,
    ...extra,
  } as unknown as ReplicatedSale;
}
function pagoReplicado(id: string, changeSeq: number) {
  return { id, targetId: 'o1', amountCents: 5, changeSeq } as unknown as ReplicatedPayment;
}

function fuente(datos: {
  ordenes?: ReplicatedWorkOrder[];
  ventas?: ReplicatedSale[];
  pagos?: ReplicatedPayment[];
  turnos?: ReplicatedShift[];
}): DocumentReplicaSource & { llamadas: string[] } {
  const llamadas: string[] = [];
  const pagina =
    <T extends { changeSeq: number }>(todos: T[], nombre: string) =>
    (seq: number, limit: number) => {
      llamadas.push(`${nombre}:${String(seq)}`);
      return Promise.resolve(ok(todos.filter((x) => x.changeSeq > seq).slice(0, limit)));
    };
  return {
    llamadas,
    ordersChangedAfter: pagina(datos.ordenes ?? [], 'ordenes'),
    shiftsChangedAfter: pagina(datos.turnos ?? [], 'turnos'),
    salesChangedAfter: pagina(datos.ventas ?? [], 'ventas'),
    paymentsChangedAfter: pagina(datos.pagos ?? [], 'pagos'),
  };
}

describe('réplica de ventas', () => {
  it('baja las ventas nuevas, las guarda como enviadas y la siguiente vez pide desde su último número', async () => {
    const outbox = nueva();
    const origen = fuente({ ventas: [ventaReplicada('v1', 3), ventaReplicada('v2', 9)] });
    const r = await refreshDocuments({ source: origen, outbox, clock: reloj });
    expect(r.ok && r.value.sales).toBe(2);
    const local = await outboxCounterSaleStore(outbox).get('v2');
    expect(local).toMatchObject({ syncStatus: 'SENT', updatedAt: '2026-10-31T20:00:00.000Z' });
    expect(local).not.toHaveProperty('changeSeq');
    await refreshDocuments({ source: origen, outbox, clock: reloj });
    expect(origen.llamadas.filter((l) => l.startsWith('ventas'))).toEqual(['ventas:0', 'ventas:9']);
  });

  it('una venta con una cancelación todavía por enviar no se sobrescribe', async () => {
    const outbox = nueva();
    await outbox.transaction(async (tx) => {
      await tx.enqueue({
        opId: '00000000-0000-4000-8000-0000000000c9',
        deviceId: '00000000-0000-4000-8000-0000000000d1',
        type: 'CancelCounterSale',
        schemaVersion: 1,
        userId: '00000000-0000-4000-8000-00000000a001',
        clientCreatedAt: '2026-10-31T19:00:00.000Z',
        payload: { id: VENTA_U, reason: 'Error' },
      });
      await tx.putDocument(COUNTER_SALES_COLLECTION, VENTA_U, {
        id: VENTA_U,
        status: 'CANCELLED',
        totalCents: 100,
      });
    });
    await refreshDocuments({
      source: fuente({ ventas: [ventaReplicada(VENTA_U, 5, { status: 'COMPLETED' })] }),
      outbox,
      clock: reloj,
    });
    expect((await outboxCounterSaleStore(outbox).get(VENTA_U))?.status).toBe('CANCELLED');
  });
});

describe('réplica · cursores y páginas', () => {
  it('cada tipo lleva su propio cursor, el mayor número recibido', async () => {
    const outbox = nueva();
    const origen = fuente({
      ordenes: [ordenReplicada('o1', 2), ordenReplicada('o2', 7), ordenReplicada('o3', 4)],
      pagos: [pagoReplicado('p1', 11), pagoReplicado('p2', 3)],
      ventas: [ventaReplicada('v1', 5)],
    });
    await refreshDocuments({ source: origen, outbox, clock: reloj });
    await refreshDocuments({ source: origen, outbox, clock: reloj });
    expect(origen.llamadas.filter((l) => l.startsWith('ordenes'))).toEqual([
      'ordenes:0',
      'ordenes:7',
    ]);
    expect(origen.llamadas.filter((l) => l.startsWith('pagos'))).toEqual(['pagos:0', 'pagos:11']);
    expect(origen.llamadas.filter((l) => l.startsWith('ventas'))).toEqual(['ventas:0', 'ventas:5']);
  });

  it('con más documentos que una página sigue pidiendo hasta terminar, sin duplicar', async () => {
    const outbox = nueva();
    const total = DOCUMENT_REPLICA_PAGE_SIZE + 5;
    const ordenes = Array.from({ length: total }, (_, i) => ordenReplicada(`o${String(i)}`, i + 1));
    const ventas = Array.from({ length: total }, (_, i) => ventaReplicada(`v${String(i)}`, i + 1));
    const pagos = Array.from({ length: total }, (_, i) => pagoReplicado(`p${String(i)}`, i + 1));
    const origen = fuente({ ordenes, ventas, pagos });
    const r = await refreshDocuments({ source: origen, outbox, clock: reloj });
    expect(r.ok && r.value).toEqual({ orders: total, payments: total, sales: total, shifts: 0 });
    expect(await outboxWorkOrderStore(outbox).list()).toHaveLength(total);
    expect(await outboxCounterSaleStore(outbox).list()).toHaveLength(total);
    expect(await outboxPaymentStore(outbox).list()).toHaveLength(total);
  });

  it('una página justo del tamaño pide una más para confirmar que ya no hay', async () => {
    const outbox = nueva();
    const ordenes = Array.from({ length: DOCUMENT_REPLICA_PAGE_SIZE }, (_, i) =>
      ordenReplicada(`o${String(i)}`, i + 1),
    );
    const origen = fuente({ ordenes });
    await refreshDocuments({ source: origen, outbox, clock: reloj });
    expect(origen.llamadas.filter((l) => l.startsWith('ordenes'))).toEqual([
      'ordenes:0',
      `ordenes:${String(DOCUMENT_REPLICA_PAGE_SIZE)}`,
    ]);
  });

  it('una operación ya confirmada de la orden no impide actualizarla; una por enviar sí', async () => {
    const outbox = nueva();
    await outbox.transaction(async (tx) => {
      await tx.putDocument(WORK_ORDERS_COLLECTION, ORDEN_U, orden(ORDEN_U, { notes: 'local' }));
      await tx.enqueue({
        opId: '00000000-0000-4000-8000-0000000000c1',
        deviceId: '00000000-0000-4000-8000-0000000000d1',
        type: 'UpdateWorkOrder',
        schemaVersion: 1,
        userId: '00000000-0000-4000-8000-00000000a001',
        clientCreatedAt: '2026-10-31T19:00:00.000Z',
        payload: { id: ORDEN_U, patch: { notes: 'local' } },
      });
    });
    await outbox.markApplied('00000000-0000-4000-8000-0000000000c1', {
      ok: true,
      status: 'APPLIED',
    });
    await refreshDocuments({
      source: fuente({ ordenes: [ordenReplicada(ORDEN_U, 2, { notes: 'servidor' })] }),
      outbox,
      clock: reloj,
    });
    expect((await outboxWorkOrderStore(outbox).get(ORDEN_U))?.notes).toBe('servidor');
  });

  it('un cobro por enviar de la orden también la protege de ser sobrescrita', async () => {
    const outbox = nueva();
    await outbox.transaction(async (tx) => {
      await tx.putDocument(WORK_ORDERS_COLLECTION, ORDEN_U, orden(ORDEN_U, { notes: 'local' }));
      await tx.enqueue({
        opId: '00000000-0000-4000-8000-0000000000c2',
        deviceId: '00000000-0000-4000-8000-0000000000d1',
        type: 'RegisterPayment',
        schemaVersion: 1,
        userId: '00000000-0000-4000-8000-00000000a001',
        clientCreatedAt: '2026-10-31T19:00:00.000Z',
        payload: {
          groupId: '00000000-0000-4000-8000-0000000000c3',
          target: { type: 'WORK_ORDER', id: ORDEN_U },
          kind: 'DEPOSIT',
          paidAt: '2026-10-31T19:00:00.000Z',
          rows: [
            { id: '00000000-0000-4000-8000-0000000000c4', method: 'TRANSFER', amountCents: 5 },
          ],
        },
      });
    });
    await refreshDocuments({
      source: fuente({ ordenes: [ordenReplicada(ORDEN_U, 2, { notes: 'servidor' })] }),
      outbox,
      clock: reloj,
    });
    expect((await outboxWorkOrderStore(outbox).get(ORDEN_U))?.notes).toBe('local');
  });
});
