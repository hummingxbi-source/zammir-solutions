import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { inMemorySyncOutbox } from '../../sync/application/in-memory-sync-outbox';
import {
  codigoPublicoDePrueba,
  issueQuoteOperation,
  markQuoteOperation,
} from '../../sync/contracts/operation-receiver.contract';
import { QUOTES_COLLECTION } from './quote-store';
import { reconcileQuotes } from './reconcile-quotes';

const DISPOSITIVO = '00000000-0000-4000-8000-0000000000d1';
const PERSONA = '00000000-0000-4000-8000-00000000a001';
const CLIENTE = '00000000-0000-4000-8000-00000000c001';
const COTIZACION = '00000000-0000-4000-8000-00000000f001';

let contador = 0;
const uuid = () => {
  contador += 1;
  return `00000000-0000-4000-8000-${String(contador + 500).padStart(12, '0')}`;
};

async function conCotizacionEmitida() {
  const outbox = inMemorySyncOutbox({ clock: fixedClock(new Date('2026-10-31T15:00:00.000Z')) });
  let ids = 0;
  const operacion = issueQuoteOperation({
    opId: uuid(),
    deviceId: DISPOSITIVO,
    seq: 1,
    userId: PERSONA,
    customerId: CLIENTE,
    year: 2026,
    newUuid: () => {
      ids += 1;
      return ids === 1 ? COTIZACION : uuid();
    },
    publicCode: codigoPublicoDePrueba(1),
  });
  await outbox.transaction(async (tx) => {
    const { seq: _seq, ...sinSeq } = operacion;
    await tx.enqueue(sinSeq as never);
    await tx.putDocument(QUOTES_COLLECTION, COTIZACION, {
      id: COTIZACION,
      status: 'SENT',
      folio: null,
      tempFolio: 'T1-0001',
      syncStatus: 'SAVED_ON_TABLET',
      reviewReason: null,
    });
  });
  return { outbox, opId: operacion.opId as string };
}

async function cotizacion(outbox: ReturnType<typeof inMemorySyncOutbox>) {
  return (await outbox.transaction((tx) => tx.getDocument(QUOTES_COLLECTION, COTIZACION))) as {
    folio: string | null;
    syncStatus: string;
    reviewReason: string | null;
  };
}

describe('reconciliar cotizaciones con lo que confirmó el servidor', () => {
  it('mientras la operación sigue pendiente no cambia nada', async () => {
    const { outbox } = await conCotizacionEmitida();
    expect(await reconcileQuotes(outbox)).toBe(0);
    expect((await cotizacion(outbox)).syncStatus).toBe('SAVED_ON_TABLET');
  });

  it('al confirmarse, la cotización recibe su folio definitivo y queda como enviada', async () => {
    const { outbox, opId } = await conCotizacionEmitida();
    await outbox.markApplied(opId, {
      ok: true,
      status: 'APPLIED',
      folio: 'COT-2026-0001',
      documentId: COTIZACION,
    });
    expect(await reconcileQuotes(outbox)).toBe(1);
    const q = await cotizacion(outbox);
    expect(q.folio).toBe('COT-2026-0001');
    expect(q.syncStatus).toBe('SENT');
  });

  it('repetirlo no cambia nada más', async () => {
    const { outbox, opId } = await conCotizacionEmitida();
    await outbox.markApplied(opId, {
      ok: true,
      status: 'APPLIED',
      folio: 'COT-2026-0001',
      documentId: COTIZACION,
    });
    await reconcileQuotes(outbox);
    expect(await reconcileQuotes(outbox)).toBe(0);
  });

  it('con otro cambio todavía por salir sigue como guardada en la tablet', async () => {
    const { outbox, opId } = await conCotizacionEmitida();
    await outbox.markApplied(opId, {
      ok: true,
      status: 'APPLIED',
      folio: 'COT-2026-0001',
      documentId: COTIZACION,
    });
    await outbox.transaction(async (tx) => {
      const { seq: _seq, ...sinSeq } = markQuoteOperation({
        opId: uuid(),
        deviceId: DISPOSITIVO,
        seq: 2,
        userId: PERSONA,
        quoteId: COTIZACION,
        accepted: true,
      });
      await tx.enqueue(sinSeq as never);
    });
    await reconcileQuotes(outbox);
    const q = await cotizacion(outbox);
    expect(q.folio).toBe('COT-2026-0001');
    expect(q.syncStatus).toBe('SAVED_ON_TABLET');
  });

  it('si el servidor la marcó por revisar, guarda el motivo', async () => {
    const { outbox, opId } = await conCotizacionEmitida();
    await outbox.markApplied(opId, {
      ok: true,
      status: 'TO_REVIEW',
      reason: 'DISCOUNT_WITHOUT_AUTHORIZATION',
      folio: 'COT-2026-0001',
      documentId: COTIZACION,
    });
    await reconcileQuotes(outbox);
    expect((await cotizacion(outbox)).reviewReason).toBe('DISCOUNT_WITHOUT_AUTHORIZATION');
  });
});
