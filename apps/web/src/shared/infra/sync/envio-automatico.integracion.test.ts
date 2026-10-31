import 'fake-indexeddb/auto';
import {
  createSyncEngine,
  exponentialBackoff,
  fixedClock,
  seededRandom,
  type OperationEnvelope,
  type Timer,
} from '@zammir/core';
import { issueQuoteOperation } from '@zammir/core/testing';
import { describe, expect, it } from 'vitest';

import { dexieOperaciones } from './dexie-operaciones';
import { httpOperationTransport } from './http-operation-transport';
import { harness, nuevoDispositivo } from './servidor-de-pruebas';

// S2-06 · La cola de la tablet (IndexedDB) envía sola al servidor real: guarda sin conexión,
// reintenta con espera creciente y, al volver la red, todo llega una sola vez y en orden.

let contadorDeBases = 0;

describe('envío automático de la tablet contra el servidor real', () => {
  it('lo guardado sin conexión sale solo al volver la red: sin duplicados y con folios consecutivos', async () => {
    let hayRed = false;
    const sinRedONormal: typeof fetch = (entrada, init) =>
      hayRed ? fetch(entrada, init) : Promise.reject(new TypeError('Failed to fetch'));
    const dispositivo = await nuevoDispositivo(sinRedONormal);
    const usuario = await harness.newUser(true);
    const cliente = await harness.newCustomer();
    const year = await harness.newYear();

    contadorDeBases += 1;
    const reloj = fixedClock(new Date('2026-10-30T12:00:00.000Z'));
    const outbox = dexieOperaciones({ clock: reloj, nombre: `envio-${String(contadorDeBases)}` });
    const esperas: number[] = [];
    const timer: Timer = {
      after: (ms) => {
        esperas.push(ms);
        return () => undefined;
      },
    };
    const engine = createSyncEngine({
      outbox,
      transport: httpOperationTransport(dispositivo.receiver),
      backoff: exponentialBackoff({ baseMs: 1000, factor: 2, capMs: 8000, jitter: 0 }),
      random: seededRandom(1),
      timer,
      clock: reloj,
    });

    // Tres cotizaciones hechas "en modo avión".
    for (let i = 0; i < 3; i += 1) {
      await outbox.transaction(async (tx) => {
        const completa = issueQuoteOperation({
          opId: harness.newUuid(),
          deviceId: dispositivo.id,
          seq: 1,
          userId: usuario,
          customerId: cliente,
          year,
          newUuid: () => harness.newUuid(),
          publicCode: harness.newPublicCode(),
        });
        const sinSeq = Object.fromEntries(
          Object.entries(completa).filter(([clave]) => clave !== 'seq'),
        ) as Omit<OperationEnvelope, 'seq'>;
        const r = await tx.enqueue(sinSeq);
        expect(r.ok).toBe(true);
      });
    }

    await engine.trigger();
    expect(engine.status()).toMatchObject({ state: 'WAITING', pending: 3 });
    await engine.trigger();
    expect(esperas).toEqual([1000, 2000]);
    expect((await harness.countsFor([dispositivo.id])).operations).toBe(0);

    hayRed = true;
    await engine.trigger();
    expect(engine.status()).toMatchObject({ state: 'IDLE', pending: 0 });

    const lista = await outbox.list();
    expect(lista.map((o) => o.status)).toEqual(['APPLIED', 'APPLIED', 'APPLIED']);
    const folios = lista.map((o) => (o.result?.ok ? o.result.folio : undefined));
    expect(folios).toEqual([1, 2, 3].map((n) => `COT-${String(year)}-000${String(n)}`));
    expect(await harness.countsFor([dispositivo.id])).toEqual({ quotes: 3, operations: 3 });
  }, 60_000);
});
