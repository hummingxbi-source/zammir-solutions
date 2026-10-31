import { describe, expect, it } from 'vitest';

import type { OperationEnvelope } from '../domain/operation';
import type { SyncOutbox } from '../application/ports';
import { codigoPublicoDePrueba, issueQuoteOperation } from './operation-receiver.contract';

const DISPOSITIVO = '10000000-0000-4000-8000-0000000000d1';
const PERSONA = '10000000-0000-4000-8000-0000000000a1';
const CLIENTE = '10000000-0000-4000-8000-0000000000c1';

let contador = 0;
function uuid(): string {
  contador += 1;
  return `20000000-0000-4000-8000-${String(contador).padStart(12, '0')}`;
}

/** Una operación IssueQuote válida, sin `seq` (la pone la cola al encolar). */
export function operacionSinSeq(
  extra: Record<string, unknown> = {},
): Omit<OperationEnvelope, 'seq'> {
  const completa = issueQuoteOperation({
    opId: uuid(),
    deviceId: DISPOSITIVO,
    seq: 1,
    userId: PERSONA,
    customerId: CLIENTE,
    year: 2090,
    newUuid: uuid,
    publicCode: codigoPublicoDePrueba(contador + 1000),
  });
  const resto = Object.fromEntries(Object.entries(completa).filter(([clave]) => clave !== 'seq'));
  return { ...resto, ...extra } as Omit<OperationEnvelope, 'seq'>;
}

/** Batería de contrato de SyncOutbox: la pasan la memoria y IndexedDB (Dexie). */
export function syncOutboxContract(
  nombre: string,
  crear: () => SyncOutbox | Promise<SyncOutbox>,
): void {
  describe(`contrato de SyncOutbox: ${nombre}`, () => {
    async function guardar(o: SyncOutbox, extra: Record<string, unknown> = {}) {
      return o.transaction(async (tx) => {
        const operacion = operacionSinSeq(extra);
        const r = await tx.enqueue(operacion);
        if (!r.ok) {
          throw new Error('no se pudo encolar');
        }
        await tx.putDocument('quotes', operacion.opId, { opId: operacion.opId });
        return r.value;
      });
    }

    it('guarda el documento y su operación en una sola transacción', async () => {
      const o = await crear();
      const op = await guardar(o);
      expect(op.seq).toBe(1);
      expect(await o.pendingCount()).toBe(1);
      const lista = await o.list();
      expect(lista).toHaveLength(1);
      expect(lista[0]?.status).toBe('PENDING');
      expect(lista[0]?.attempts).toBe(0);
      const documentos = await o.transaction((tx) => tx.listDocuments('quotes'));
      expect(documentos).toEqual([{ opId: op.opId }]);
    });

    it('los seq son consecutivos desde 1', async () => {
      const o = await crear();
      const seqs = [(await guardar(o)).seq, (await guardar(o)).seq, (await guardar(o)).seq];
      expect(seqs).toEqual([1, 2, 3]);
    });

    it('si la transacción falla no queda nada: ni documento, ni operación, ni números consumidos', async () => {
      const o = await crear();
      await expect(
        o.transaction(async (tx) => {
          await tx.nextTempNumber();
          await tx.putDocument('quotes', 'a', { x: 1 });
          await tx.enqueue(operacionSinSeq());
          throw new Error('falla a mitad');
        }),
      ).rejects.toThrow('falla a mitad');
      expect(await o.pendingCount()).toBe(0);
      expect(await o.transaction((tx) => tx.listDocuments('quotes'))).toEqual([]);
      const siguiente = await o.transaction(async (tx) => ({
        temp: await tx.nextTempNumber(),
        op: await tx.enqueue(operacionSinSeq()),
      }));
      expect(siguiente.temp).toBe(1);
      expect(siguiente.op.ok && siguiente.op.value.seq).toBe(1);
    });

    it('el folio provisional avanza de uno en uno entre transacciones', async () => {
      const o = await crear();
      const a = await o.transaction((tx) => tx.nextTempNumber());
      const b = await o.transaction(async (tx) => [
        await tx.nextTempNumber(),
        await tx.nextTempNumber(),
      ]);
      expect([a, ...b]).toEqual([1, 2, 3]);
    });

    it('una operación con formato inválido se rechaza antes de guardarla', async () => {
      const o = await crear();
      const r = await o.transaction((tx) =>
        tx.enqueue(operacionSinSeq({ userId: 'no-es-un-uuid' })),
      );
      expect(!r.ok && r.error.code).toBe('INVALID_OPERATION');
      const sinCarga = await o.transaction((tx) => tx.enqueue(operacionSinSeq({ payload: {} })));
      expect(!sinCarga.ok && sinCarga.error.code).toBe('INVALID_OPERATION');
      expect(await o.pendingCount()).toBe(0);
      // El seq no se gastó en las rechazadas.
      expect((await guardar(o)).seq).toBe(1);
    });

    it('los documentos se guardan y se leen por colección e id, y guardar de nuevo reemplaza', async () => {
      const o = await crear();
      await o.transaction(async (tx) => {
        await tx.putDocument('customers', 'c1', { name: 'Ana' });
        await tx.putDocument('customers', 'c1', { name: 'Ana López' });
        await tx.putDocument('customers', 'c2', { name: 'Beto' });
      });
      expect(await o.transaction((tx) => tx.getDocument('customers', 'c1'))).toEqual({
        name: 'Ana López',
      });
      expect(await o.transaction((tx) => tx.getDocument('customers', 'nadie'))).toBeUndefined();
      expect(await o.transaction((tx) => tx.listDocuments('customers'))).toHaveLength(2);
      expect(await o.transaction((tx) => tx.listDocuments('quotes'))).toEqual([]);
    });

    it('nextToSend entrega la pendiente de menor seq y avanza al confirmar', async () => {
      const o = await crear();
      const a = await guardar(o);
      const b = await guardar(o);
      expect((await o.nextToSend())?.envelope.opId).toBe(a.opId);
      await o.markApplied(a.opId, { ok: true, status: 'APPLIED', folio: 'COT-2090-0001' });
      expect((await o.nextToSend())?.envelope.opId).toBe(b.opId);
      expect(await o.pendingCount()).toBe(1);
      const aplicada = (await o.list()).find((x) => x.envelope.opId === a.opId);
      expect(aplicada?.status).toBe('APPLIED');
      expect(aplicada?.result).toEqual({ ok: true, status: 'APPLIED', folio: 'COT-2090-0001' });
    });

    it('una aplicada "por revisar" cuenta como enviada para la tablet', async () => {
      const o = await crear();
      const a = await guardar(o);
      await o.markApplied(a.opId, { ok: true, status: 'TO_REVIEW', folio: 'COT-2090-0001' });
      expect((await o.list())[0]?.status).toBe('TO_REVIEW');
      expect(await o.pendingCount()).toBe(0);
      expect(await o.nextToSend()).toBeNull();
    });

    it('los intentos fallidos se cuentan y la operación sigue pendiente', async () => {
      const o = await crear();
      const a = await guardar(o);
      await o.recordAttempt(a.opId, 'sin red');
      await o.recordAttempt(a.opId, 'sin red otra vez');
      const op = (await o.list())[0];
      expect(op?.attempts).toBe(2);
      expect(op?.lastError).toBe('sin red otra vez');
      expect(op?.status).toBe('PENDING');
    });

    it('un fallo estructural detiene la cola y no descarta nada', async () => {
      const o = await crear();
      const a = await guardar(o);
      await guardar(o);
      await o.markFailed(a.opId, 'INVALID_PAYLOAD');
      expect(await o.isStopped()).toBe(true);
      expect(await o.nextToSend()).toBeNull();
      expect(await o.list()).toHaveLength(2);
      expect((await o.list())[0]?.status).toBe('FAILED');
    });

    it('resendFrom devuelve a pendientes lo no aplicado desde esa seq, sin tocar lo ya aplicado', async () => {
      const o = await crear();
      const [a, b, c] = [await guardar(o), await guardar(o), await guardar(o)];
      await o.markApplied(a.opId, { ok: true, status: 'APPLIED' });
      await o.markFailed(b.opId, 'x');
      await o.resendFrom(2);
      const estados = (await o.list()).map((x) => x.status);
      expect(estados).toEqual(['APPLIED', 'PENDING', 'PENDING']);
      expect((await o.nextToSend())?.envelope.opId).toBe(b.opId);
      expect(c.seq).toBe(3);
    });

    it('confirmar o marcar una operación que no existe avisa', async () => {
      const o = await crear();
      const r = await o.markApplied(uuid(), { ok: true, status: 'APPLIED' });
      expect(!r.ok && r.error.code).toBe('NOT_FOUND');
      const f = await o.markFailed(uuid(), 'x');
      expect(!f.ok && f.error.code).toBe('NOT_FOUND');
      const t = await o.recordAttempt(uuid(), 'x');
      expect(!t.ok && t.error.code).toBe('NOT_FOUND');
    });

    it('oldestPendingSince da la hora de la pendiente más antigua y null si no hay', async () => {
      const o = await crear();
      expect(await o.oldestPendingSince()).toBeNull();
      const a = await guardar(o);
      const primera = await o.oldestPendingSince();
      expect(primera).not.toBeNull();
      await guardar(o);
      expect(await o.oldestPendingSince()).toBe(primera);
      await o.markApplied(a.opId, { ok: true, status: 'APPLIED' });
      expect(await o.oldestPendingSince()).not.toBeNull();
    });

    it('transacciones simultáneas se atienden por turnos: 25 operaciones dan seq 1..25 sin repetidos', async () => {
      const o = await crear();
      const ops = await Promise.all(Array.from({ length: 25 }, () => guardar(o)));
      expect(ops.map((x) => x.seq).sort((x, y) => x - y)).toEqual(
        Array.from({ length: 25 }, (_v, i) => i + 1),
      );
    });
  });
}
