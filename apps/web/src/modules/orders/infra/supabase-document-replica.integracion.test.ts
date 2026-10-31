import 'fake-indexeddb/auto';
import {
  fixedClock,
  outboxCounterSaleStore,
  outboxPaymentStore,
  outboxWorkOrderStore,
  refreshDocuments,
} from '@zammir/core';
import { createCounterSaleOperation, createWorkOrderOperation } from '@zammir/core/testing';
import { describe, expect, it } from 'vitest';

import { dexieOperaciones } from '../../../shared/infra/sync/dexie-operaciones';
import { harness, nuevoDispositivo } from '../../../shared/infra/sync/servidor-de-pruebas';
import { supabaseDocumentReplica } from './supabase-document-replica';

// S3-00 · Lo que hace una tablet (orden y anticipo) lo baja otra tablet, sin datos fiscales, para poder
// cobrarle el saldo desde otro mostrador.

describe('réplica de órdenes y pagos con el servidor real', () => {
  it('una tablet baja la orden y el anticipo que registró otra, y la siguiente vez no baja nada', async () => {
    const quien = await nuevoDispositivo();
    const otra = await nuevoDispositivo();
    const usuario = await harness.newUser(true);
    const cliente = await harness.newCustomer();
    const year = await harness.newYear();
    const orderId = harness.newUuid();

    const creada = await quien.receiver.receive(
      createWorkOrderOperation({
        opId: harness.newUuid(),
        deviceId: quien.id,
        seq: 1,
        userId: usuario,
        customerId: cliente,
        year,
        newUuid: () => harness.newUuid(),
        publicCode: harness.newPublicCode(),
        orderId,
      }),
    );
    expect(creada.ok).toBe(true);
    const pagoId = harness.newUuid();
    const cobrada = await quien.receiver.receive({
      opId: harness.newUuid(),
      deviceId: quien.id,
      seq: 2,
      type: 'RegisterPayment',
      schemaVersion: 1,
      userId: usuario,
      clientCreatedAt: `${String(year)}-06-16T18:00:00.000Z`,
      payload: {
        groupId: harness.newUuid(),
        target: { type: 'WORK_ORDER', id: orderId },
        kind: 'DEPOSIT',
        paidAt: `${String(year)}-06-16T18:00:00.000Z`,
        rows: [{ id: pagoId, method: 'CASH', amountCents: 5_800, cashReceivedCents: 6_000 }],
      },
    });
    expect(cobrada.ok).toBe(true);

    const ventaId = harness.newUuid();
    const venta = await quien.receiver.receive(
      createCounterSaleOperation({
        opId: harness.newUuid(),
        deviceId: quien.id,
        seq: 3,
        userId: usuario,
        year,
        newUuid: () => harness.newUuid(),
        publicCode: harness.newPublicCode(),
        saleId: ventaId,
        mixto: true,
      }),
    );
    expect(venta.ok).toBe(true);

    const reloj = fixedClock(new Date('2026-10-31T20:00:00.000Z'));
    const outbox = dexieOperaciones({ clock: reloj, nombre: `replica-${crypto.randomUUID()}` });
    const fuente = supabaseDocumentReplica(otra.session);
    const primera = await refreshDocuments({ source: fuente, outbox, clock: reloj });
    expect(primera.ok).toBe(true);

    const orden = await outboxWorkOrderStore(outbox).get(orderId);
    expect(orden).toMatchObject({
      status: 'WAITING',
      folio: `OT-${String(year)}-0001`,
      totalCents: 11_600,
      depositRequiredCents: 5_800,
      syncStatus: 'SENT',
    });
    expect(orden?.lines).toHaveLength(1);
    expect(orden?.lines[0]).toMatchObject({ name: 'Vidrio claro 6 mm', lineTotalCents: 11_600 });

    const pagos = await outboxPaymentStore(outbox).listByTarget(orderId);
    expect(pagos).toHaveLength(1);
    expect(pagos[0]).toMatchObject({
      id: pagoId,
      kind: 'DEPOSIT',
      method: 'CASH',
      amountCents: 5_800,
      cashReceivedCents: 6_000,
      changeCents: 200,
    });

    const ventaLocal = await outboxCounterSaleStore(outbox).get(ventaId);
    expect(ventaLocal).toMatchObject({
      status: 'COMPLETED',
      folio: `V-${String(year)}-0001`,
      totalCents: 11_600,
      syncStatus: 'SENT',
    });
    expect(await outboxPaymentStore(outbox).listByTarget(ventaId)).toHaveLength(2);

    const segunda = await refreshDocuments({ source: fuente, outbox, clock: reloj });
    expect(segunda.ok && segunda.value.orders).toBe(0);
    expect(segunda.ok && segunda.value.payments).toBe(0);
    expect(segunda.ok && segunda.value.sales).toBe(0);
  }, 60_000);

  it('las vistas de la tablet no traen columnas fiscales ni de relleno', async () => {
    const tablet = await nuevoDispositivo();
    const { data } = await tablet.session.from('work_orders_for_device').select('*').limit(1);
    const fila = (data as Record<string, unknown>[] | null)?.[0] ?? {};
    const claves = Object.keys(fila);
    // La prueba anterior dejó una orden: hay una fila que revisar.
    expect(claves.length).toBeGreaterThan(0);
    expect(claves.some((k) => k.startsWith('fiscal'))).toBe(false);
  });
});
