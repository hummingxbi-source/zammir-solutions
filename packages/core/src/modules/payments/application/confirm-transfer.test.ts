import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId } from '../../../shared-kernel/id';
import type { Authorization } from '../../identity/application/authorize-with-admin-pin';
import { PAYMENTS_COLLECTION } from '../../orders/application/work-order-store';
import type { QuoteActor } from '../../quotes/application/quote-use-cases';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import { parseOperation } from '../../sync/domain/operation';
import type { Payment } from '../domain/payment';
import { pendingTransfers, transferStatus } from '../domain/transfer-confirmation';
import {
  confirmTransfer,
  outboxTransferConfirmationStore,
  PAYMENT_CONFIRMATIONS_COLLECTION,
  type ConfirmTransferDeps,
} from './confirm-transfer';

const admin: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-0000000000a1'),
  role: 'ADMIN',
};
const cajero: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-0000000000c1'),
  role: 'STAFF',
};
const TRANSFERENCIA = '00000000-0000-4000-8000-000000000b01';
const EFECTIVO = '00000000-0000-4000-8000-000000000b02';

const pago = (
  id: string,
  method: Payment['method'],
  paidAt = '2026-11-20T18:00:00.000Z',
): Payment => ({
  id,
  groupId: '00000000-0000-4000-8000-000000000a00',
  targetType: 'COUNTER_SALE',
  targetId: '00000000-0000-4000-8000-0000000000e1',
  kind: 'SALE',
  method,
  amountCents: 11_600,
  cashReceivedCents: method === 'CASH' ? 11_600 : null,
  changeCents: method === 'CASH' ? 0 : null,
  reference: method === 'TRANSFER' ? 'SPEI 123' : null,
  userId: cajero.userId,
  deviceId: null,
  paidAt,
  cashShiftId: null,
});

let n = 0;
async function entorno() {
  const reloj = fixedClock(new Date('2026-11-21T16:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  await outbox.transaction(async (tx) => {
    await tx.putDocument(PAYMENTS_COLLECTION, TRANSFERENCIA, pago(TRANSFERENCIA, 'TRANSFER'));
    await tx.putDocument(PAYMENTS_COLLECTION, EFECTIVO, pago(EFECTIVO, 'CASH'));
  });
  const deps: ConfirmTransferDeps = {
    outbox,
    clock: reloj,
    device: { id: '00000000-0000-4000-8000-0000000000d1' },
    idGenerator: {
      newId: <E extends string>() => {
        n += 1;
        return asId<E>(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
      },
    },
  };
  return { deps, outbox, confirmaciones: outboxTransferConfirmationStore(outbox) };
}

describe('estado de una transferencia [RF-M4-11]', () => {
  it('un pago en efectivo no tiene estado de confirmación', () => {
    expect(transferStatus(pago('x', 'CASH'), new Set())).toBe('NOT_A_TRANSFER');
    expect(transferStatus(pago('x', 'CASH'), new Set(['x']))).toBe('NOT_A_TRANSFER');
  });

  it('una transferencia está por confirmar hasta que alguien la confirma', () => {
    expect(transferStatus(pago('x', 'TRANSFER'), new Set())).toBe('PENDING');
    expect(transferStatus(pago('x', 'TRANSFER'), new Set(['x']))).toBe('CONFIRMED');
  });

  it('las pendientes van de la más antigua a la más reciente, sin efectivo ni confirmadas', () => {
    const pagos = [
      pago('nueva', 'TRANSFER', '2026-11-20T18:00:00.000Z'),
      pago('vieja', 'TRANSFER', '2026-11-01T18:00:00.000Z'),
      pago('efectivo', 'CASH', '2026-10-01T18:00:00.000Z'),
      pago('lista', 'TRANSFER', '2026-10-15T18:00:00.000Z'),
    ];
    expect(pendingTransfers(pagos, new Set(['lista'])).map((p) => p.id)).toEqual([
      'vieja',
      'nueva',
    ]);
  });
});

describe('confirmar que llegó una transferencia [RF-M4-11, ADR-0044]', () => {
  it('un administrador la confirma: queda quién y cuándo, y sale en la cola', async () => {
    const { deps, outbox, confirmaciones } = await entorno();
    const r = await confirmTransfer(deps, admin, TRANSFERENCIA);
    expect(r).toEqual({
      ok: true,
      value: {
        paymentId: TRANSFERENCIA,
        confirmedBy: admin.userId,
        confirmedAt: '2026-11-21T16:00:00.000Z',
        syncStatus: 'SAVED_ON_TABLET',
      },
    });
    const op = (await outbox.list()).at(-1);
    expect(op?.envelope).toMatchObject({
      type: 'ConfirmTransfer',
      userId: admin.userId,
      payload: { paymentId: TRANSFERENCIA, confirmedAt: '2026-11-21T16:00:00.000Z' },
    });
    expect(op?.envelope.authorizedBy).toBeUndefined();
    expect(parseOperation(op?.envelope).ok).toBe(true);
    expect(await confirmaciones.confirmedIds()).toEqual(new Set([TRANSFERENCIA]));
  });

  it('un cajero no puede solo; con el PIN de un administrador, confirma ese administrador', async () => {
    const { deps, outbox } = await entorno();
    expect(await confirmTransfer(deps, cajero, TRANSFERENCIA)).toEqual({
      ok: false,
      error: { code: 'NOT_AUTHORIZED' },
    });
    expect(await outbox.list()).toHaveLength(0);
    const permiso: Authorization = { adminId: admin.userId, authorizedAt: deps.clock.now() };
    const r = await confirmTransfer(deps, cajero, TRANSFERENCIA, permiso);
    expect(r.ok && r.value.confirmedBy).toBe(admin.userId);
    expect((await outbox.list()).at(-1)?.envelope).toMatchObject({
      userId: cajero.userId,
      authorizedBy: admin.userId,
    });
  });

  it('no se confirma dos veces, ni un pago en efectivo, ni uno que no está en la tablet', async () => {
    const { deps, outbox } = await entorno();
    await confirmTransfer(deps, admin, TRANSFERENCIA);
    expect(await confirmTransfer(deps, admin, TRANSFERENCIA)).toEqual({
      ok: false,
      error: { code: 'ALREADY_CONFIRMED' },
    });
    expect(await confirmTransfer(deps, admin, EFECTIVO)).toEqual({
      ok: false,
      error: { code: 'NOT_A_TRANSFER' },
    });
    expect(await confirmTransfer(deps, admin, '00000000-0000-4000-8000-000000000bff')).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(await outbox.list()).toHaveLength(1);
  });

  it('una confirmación que bajó de otra tablet también cuenta como confirmada', async () => {
    const { deps, outbox } = await entorno();
    await outbox.transaction((tx) =>
      tx.putDocument(PAYMENT_CONFIRMATIONS_COLLECTION, TRANSFERENCIA, {
        paymentId: TRANSFERENCIA,
        confirmedBy: admin.userId,
        confirmedAt: '2026-11-21T10:00:00.000Z',
        syncStatus: 'SENT',
      }),
    );
    expect(await confirmTransfer(deps, admin, TRANSFERENCIA)).toEqual({
      ok: false,
      error: { code: 'ALREADY_CONFIRMED' },
    });
  });
});
