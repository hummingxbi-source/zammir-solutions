import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { seededRandom } from '../../../shared-kernel/random';
import { err, ok } from '../../../shared-kernel/result';
import { operacionSinSeq } from '../contracts/sync-outbox.contract';
import { inMemorySyncOutbox } from './in-memory-sync-outbox';
import { exponentialBackoff, type SyncTransport } from './run-sync';
import { createSyncEngine, documentSyncLabel, isStale, type Timer } from './sync-engine';

const reloj = fixedClock(new Date('2026-10-30T12:00:00.000Z'));

/** Deja correr las promesas pendientes (el temporizador falso dispara `trigger()` sin esperarlo). */
async function soltar(): Promise<void> {
  for (let i = 0; i < 25; i += 1) {
    await Promise.resolve();
  }
}

/** Temporizador de pruebas: no corre solo, se avanza a mano. */
function temporizadorManual() {
  const tareas: { ms: number; accion: () => void; viva: boolean }[] = [];
  const timer: Timer = {
    after: (ms, accion) => {
      const tarea = { ms, accion, viva: true };
      tareas.push(tarea);
      return () => {
        tarea.viva = false;
      };
    },
  };
  return {
    timer,
    pendientes: () => tareas.filter((t) => t.viva),
    dispararSiguiente: () => {
      const t = tareas.find((x) => x.viva);
      if (t !== undefined) {
        t.viva = false;
        t.accion();
      }
    },
  };
}

function motor(opciones: { conectado: () => boolean }) {
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const temporizador = temporizadorManual();
  const enviadas: number[] = [];
  const transport: SyncTransport = {
    send: (op) => {
      enviadas.push(op.seq);
      return Promise.resolve(
        opciones.conectado()
          ? ok({
              ok: true,
              status: 'APPLIED',
              folio: `COT-2090-${String(op.seq).padStart(4, '0')}`,
            })
          : err({ code: 'NETWORK_UNAVAILABLE' }),
      );
    },
  };
  const engine = createSyncEngine({
    outbox,
    transport,
    backoff: exponentialBackoff({ baseMs: 1000, factor: 2, capMs: 8000, jitter: 0 }),
    random: seededRandom(1),
    timer: temporizador.timer,
    clock: reloj,
  });
  const guardar = () =>
    outbox.transaction(async (tx) => {
      await tx.enqueue(operacionSinSeq());
    });
  return { outbox, engine, temporizador, enviadas, guardar };
}

describe('createSyncEngine', () => {
  it('con conexión envía todo y queda en reposo con cero pendientes', async () => {
    const { engine, guardar } = motor({ conectado: () => true });
    await guardar();
    await guardar();
    await engine.trigger();
    expect(engine.status()).toMatchObject({ state: 'IDLE', pending: 0, lastError: null });
  });

  it('sin conexión espera y reintenta con espera creciente: 1 s, 2 s, 4 s, 8 s, 8 s', async () => {
    let hayRed = false;
    const { engine, temporizador, guardar } = motor({ conectado: () => hayRed });
    await guardar();
    await engine.trigger();
    expect(engine.status()).toMatchObject({ state: 'WAITING', pending: 1, retryInMs: 1000 });
    const esperas: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      temporizador.dispararSiguiente();
      await soltar();
      esperas.push(engine.status().retryInMs ?? -1);
    }
    expect(esperas).toEqual([2000, 4000, 8000, 8000]);
    // Vuelve la red: el siguiente reintento envía y todo queda en reposo.
    hayRed = true;
    temporizador.dispararSiguiente();
    await soltar();
    expect(engine.status()).toMatchObject({ state: 'IDLE', pending: 0, retryInMs: null });
  });

  it('al volver la conexión, un trigger envía de inmediato sin esperar el temporizador', async () => {
    let hayRed = false;
    const { engine, temporizador, guardar } = motor({ conectado: () => hayRed });
    await guardar();
    await engine.trigger();
    expect(temporizador.pendientes()).toHaveLength(1);
    hayRed = true;
    await engine.trigger();
    expect(engine.status()).toMatchObject({ state: 'IDLE', pending: 0 });
    expect(temporizador.pendientes()).toHaveLength(0);
  });

  it('dos triggers a la vez hacen una sola pasada', async () => {
    const { engine, enviadas, guardar } = motor({ conectado: () => true });
    await guardar();
    await Promise.all([engine.trigger(), engine.trigger(), engine.trigger()]);
    expect(enviadas).toEqual([1]);
  });

  it('un rechazo estructural detiene el motor hasta que se reanuda', async () => {
    const outbox = inMemorySyncOutbox({ clock: reloj });
    const temporizador = temporizadorManual();
    let malo = true;
    const engine = createSyncEngine({
      outbox,
      transport: {
        send: () =>
          Promise.resolve(
            malo ? ok({ ok: false, code: 'INVALID_PAYLOAD' }) : ok({ ok: true, status: 'APPLIED' }),
          ),
      },
      backoff: exponentialBackoff(),
      random: seededRandom(1),
      timer: temporizador.timer,
      clock: reloj,
    });
    await outbox.transaction(async (tx) => {
      await tx.enqueue(operacionSinSeq());
    });
    await engine.trigger();
    expect(engine.status()).toMatchObject({ state: 'STOPPED', lastError: 'INVALID_PAYLOAD' });
    expect(temporizador.pendientes()).toHaveLength(0);
    // Mientras esté detenido, un trigger no envía.
    await engine.trigger();
    expect(engine.status().state).toBe('STOPPED');
    // Soporte la atiende (la operación se corrige o se descarta fuera del motor) y se reanuda.
    malo = false;
    const op = (await outbox.list())[0];
    await outbox.resendFrom(op?.envelope.seq ?? 1);
    await engine.resume();
    expect(engine.status()).toMatchObject({ state: 'IDLE', pending: 0 });
  });

  it('avisa a quien escucha en cada cambio y deja de avisar al cancelar', async () => {
    const { engine, guardar } = motor({ conectado: () => true });
    let avisos = 0;
    const cancelar = engine.subscribe(() => {
      avisos += 1;
    });
    await guardar();
    await engine.trigger();
    expect(avisos).toBeGreaterThanOrEqual(2);
    const antes = avisos;
    cancelar();
    await engine.trigger();
    expect(avisos).toBe(antes);
  });

  it('dispose cancela el reintento programado', async () => {
    const { engine, temporizador, guardar } = motor({ conectado: () => false });
    await guardar();
    await engine.trigger();
    expect(temporizador.pendientes()).toHaveLength(1);
    engine.dispose();
    expect(temporizador.pendientes()).toHaveLength(0);
  });
});

describe('documentSyncLabel', () => {
  it.each([
    ['PENDING', 'SAVED_ON_TABLET'],
    ['FAILED', 'SAVED_ON_TABLET'],
    ['APPLIED', 'SENT'],
    ['TO_REVIEW', 'SENT'],
  ] as const)('%s → %s', (estado, esperado) => {
    expect(documentSyncLabel(estado)).toBe(esperado);
  });
});

describe('isStale', () => {
  const ahora = new Date('2026-10-30T18:00:00.000Z');
  it('sin pendientes nunca está atrasado', () => {
    expect(isStale(null, ahora, 6)).toBe(false);
  });
  it('un segundo antes del límite no, en el límite sí', () => {
    expect(isStale('2026-10-30T12:00:01.000Z', ahora, 6)).toBe(false);
    expect(isStale('2026-10-30T12:00:00.000Z', ahora, 6)).toBe(true);
  });
});
