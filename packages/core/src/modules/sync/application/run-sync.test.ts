import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { seededRandom } from '../../../shared-kernel/random';
import { err, ok, type Result } from '../../../shared-kernel/result';
import { operacionSinSeq } from '../contracts/sync-outbox.contract';
import type { OperationEnvelope, OperationResult } from '../domain/operation';
import { inMemorySyncOutbox } from './in-memory-sync-outbox';
import {
  DEFAULT_BACKOFF,
  exponentialBackoff,
  runSync,
  type SyncTransport,
  type TransportError,
} from './run-sync';

const reloj = fixedClock(new Date('2026-10-30T12:00:00.000Z'));

async function conOperaciones(n: number) {
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const ops: OperationEnvelope[] = [];
  for (let i = 0; i < n; i += 1) {
    const op = await outbox.transaction(async (tx) => {
      const r = await tx.enqueue(operacionSinSeq());
      if (!r.ok) {
        throw new Error('encolar');
      }
      return r.value;
    });
    ops.push(op);
  }
  return { outbox, ops };
}

type Respuesta = Result<OperationResult, TransportError>;

function transporte(respuestas: (op: OperationEnvelope, n: number) => Respuesta) {
  const enviadas: number[] = [];
  const t: SyncTransport = {
    send: (op) => {
      enviadas.push(op.seq);
      return Promise.resolve(respuestas(op, enviadas.length));
    },
  };
  return { t, enviadas };
}

const aplicada = (op: OperationEnvelope): Respuesta =>
  ok({ ok: true, status: 'APPLIED', folio: `COT-2090-${String(op.seq).padStart(4, '0')}` });

describe('runSync', () => {
  it('envía en orden de seq, de una en una, y marca cada una como enviada', async () => {
    const { outbox } = await conOperaciones(3);
    const { t, enviadas } = transporte((op) => aplicada(op));
    const r = await runSync({ outbox, transport: t });
    expect(r).toEqual({ kind: 'DONE', sent: 3 });
    expect(enviadas).toEqual([1, 2, 3]);
    expect(await outbox.pendingCount()).toBe(0);
    expect((await outbox.list()).map((o) => o.status)).toEqual(['APPLIED', 'APPLIED', 'APPLIED']);
  });

  it('sin nada pendiente no envía nada', async () => {
    const { outbox } = await conOperaciones(0);
    const { t, enviadas } = transporte((op) => aplicada(op));
    expect(await runSync({ outbox, transport: t })).toEqual({ kind: 'DONE', sent: 0 });
    expect(enviadas).toEqual([]);
  });

  it('si falla la red se detiene, cuenta el intento y no pierde nada', async () => {
    const { outbox } = await conOperaciones(3);
    const { t, enviadas } = transporte((op, n) =>
      n === 2 ? err({ code: 'NETWORK_UNAVAILABLE' }) : aplicada(op),
    );
    const r = await runSync({ outbox, transport: t });
    expect(r).toEqual({ kind: 'RETRY', sent: 1, error: 'NETWORK_UNAVAILABLE' });
    expect(enviadas).toEqual([1, 2]);
    const estados = await outbox.list();
    expect(estados.map((o) => o.status)).toEqual(['APPLIED', 'PENDING', 'PENDING']);
    expect(estados[1]?.attempts).toBe(1);
    expect(estados[1]?.lastError).toBe('NETWORK_UNAVAILABLE');
  });

  it('al reintentar continúa donde se quedó, sin repetir lo confirmado', async () => {
    const { outbox } = await conOperaciones(3);
    let caida = true;
    const { t, enviadas } = transporte((op, n) =>
      caida && n === 2 ? err({ code: 'SERVER_UNAVAILABLE' }) : aplicada(op),
    );
    await runSync({ outbox, transport: t });
    caida = false;
    const r = await runSync({ outbox, transport: t });
    expect(r).toEqual({ kind: 'DONE', sent: 2 });
    expect(enviadas).toEqual([1, 2, 2, 3]);
  });

  it('un rechazo estructural marca la operación, detiene la cola y no descarta nada', async () => {
    const { outbox } = await conOperaciones(3);
    const { t, enviadas } = transporte((op) =>
      op.seq === 2 ? ok({ ok: false, code: 'INVALID_PAYLOAD' }) : aplicada(op),
    );
    const r = await runSync({ outbox, transport: t });
    expect(r).toEqual({ kind: 'STOPPED', sent: 1, code: 'INVALID_PAYLOAD' });
    expect(enviadas).toEqual([1, 2]);
    expect((await outbox.list()).map((o) => o.status)).toEqual(['APPLIED', 'FAILED', 'PENDING']);
    expect(await outbox.isStopped()).toBe(true);
    // Otra pasada no envía nada mientras siga detenida.
    const otra = await runSync({ outbox, transport: t });
    expect(otra.kind).toBe('STOPPED');
    expect(enviadas).toEqual([1, 2]);
  });

  it('fuera de orden: reenvía desde la seq que el servidor espera y sigue', async () => {
    const { outbox } = await conOperaciones(3);
    let primera = true;
    const { t, enviadas } = transporte((op) => {
      if (primera && op.seq === 1) {
        primera = false;
        return ok({ ok: false, code: 'OUT_OF_ORDER', expectedSeq: 1 });
      }
      return aplicada(op);
    });
    const r = await runSync({ outbox, transport: t });
    expect(r).toEqual({ kind: 'DONE', sent: 3 });
    expect(enviadas).toEqual([1, 1, 2, 3]);
  });

  it('si el servidor espera una seq que aquí ya está confirmada, lo trata como problema y detiene', async () => {
    const { outbox } = await conOperaciones(3);
    const { t } = transporte((op) =>
      op.seq === 1 ? aplicada(op) : ok({ ok: false, code: 'OUT_OF_ORDER', expectedSeq: 1 }),
    );
    const r = await runSync({ outbox, transport: t });
    expect(r).toEqual({ kind: 'STOPPED', sent: 1, code: 'SEQUENCE_MISMATCH' });
    expect(await outbox.isStopped()).toBe(true);
  });

  it('si el servidor sigue diciendo fuera de orden, no entra en ciclo infinito', async () => {
    const { outbox } = await conOperaciones(2);
    const { t, enviadas } = transporte(() =>
      ok({ ok: false, code: 'OUT_OF_ORDER', expectedSeq: 1 }),
    );
    const r = await runSync({ outbox, transport: t });
    expect(r.kind).toBe('STOPPED');
    expect(enviadas.length).toBeLessThanOrEqual(5);
  });

  it('una aplicada "por revisar" cuenta como enviada', async () => {
    const { outbox } = await conOperaciones(1);
    const { t } = transporte(() => ok({ ok: true, status: 'TO_REVIEW', reason: 'USER_INACTIVE' }));
    expect(await runSync({ outbox, transport: t })).toEqual({ kind: 'DONE', sent: 1 });
    expect((await outbox.list())[0]?.status).toBe('TO_REVIEW');
  });
});

describe('exponentialBackoff', () => {
  const sinVariacion = exponentialBackoff({ baseMs: 2000, factor: 2, capMs: 300_000, jitter: 0 });
  const azar = seededRandom(1);

  it.each([
    [1, 2000],
    [2, 4000],
    [3, 8000],
    [4, 16_000],
    [8, 256_000],
    [9, 300_000],
    [50, 300_000],
  ])('intento %i espera %i ms sin variación', (intento, esperado) => {
    expect(sinVariacion.delayMs(intento, azar)).toBe(esperado);
  });

  it('con variación se queda dentro de ±20 % y nunca pasa del tope', () => {
    const politica = exponentialBackoff(DEFAULT_BACKOFF);
    const r = seededRandom(7);
    for (let intento = 1; intento <= 20; intento += 1) {
      const base = Math.min(300_000, 2000 * 2 ** (intento - 1));
      for (let i = 0; i < 50; i += 1) {
        const espera = politica.delayMs(intento, r);
        expect(espera).toBeGreaterThanOrEqual(Math.floor(base * 0.8));
        expect(espera).toBeLessThanOrEqual(Math.min(300_000, Math.ceil(base * 1.2)));
      }
    }
  });
});
