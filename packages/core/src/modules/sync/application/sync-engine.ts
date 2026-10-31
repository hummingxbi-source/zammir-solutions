import type { Clock } from '../../../shared-kernel/clock';
import type { Random } from '../../../shared-kernel/random';
import type { SyncOutbox } from './ports';
import { runSync, type BackoffPolicy, type SyncRunOutcome, type SyncTransport } from './run-sync';

/** Puerto: temporizador. El núcleo no llama a `setTimeout`. Devuelve la función que lo cancela. */
export interface Timer {
  after(ms: number, action: () => void): () => void;
}

export type SyncEngineState =
  /** Nada que enviar. */
  | 'IDLE'
  /** Enviando ahora. */
  | 'SENDING'
  /** No se pudo enviar; espera para reintentar. */
  | 'WAITING'
  /** Un rechazo estructural detuvo la cola: hace falta soporte. */
  | 'STOPPED';

export interface SyncStatus {
  readonly state: SyncEngineState;
  /** Operaciones guardadas en la tablet que aún no se confirman ("N pendientes"). */
  readonly pending: number;
  /** Desde cuándo está la más antigua sin enviar (ISO), para avisar si pasa de cierto tiempo. */
  readonly oldestPendingSince: string | null;
  /** Milisegundos hasta el próximo reintento, si está esperando. */
  readonly retryInMs: number | null;
  readonly lastError: string | null;
}

export interface SyncEngine {
  /** Pide enviar ahora (al guardar algo, al abrir, al volver la conexión). Si ya está enviando, no hace
   *  nada: lo nuevo se envía en la misma pasada o en la siguiente. */
  trigger(): Promise<void>;
  /** Después de que soporte atendió un fallo estructural. */
  resume(): Promise<void>;
  status(): SyncStatus;
  subscribe(listener: () => void): () => void;
  /** Apaga el temporizador (al cerrar la aplicación o en pruebas). */
  dispose(): void;
}

/** Motor de envío de la tablet: dispara `runSync`, reintenta con espera creciente y publica su estado.
 *  Sin red solo espera; al volver la conexión el llamador hace `trigger()`. */
export function createSyncEngine(deps: {
  readonly outbox: SyncOutbox;
  readonly transport: SyncTransport;
  readonly backoff: BackoffPolicy;
  readonly random: Random;
  readonly timer: Timer;
  readonly clock: Clock;
  /** Se llama al terminar cada pasada de envío (con o sin éxito), por ejemplo para poner el folio
   *  definitivo en lo que ya se confirmó. Un fallo aquí no detiene el envío. */
  readonly afterPass?: () => Promise<void>;
}): SyncEngine {
  let state: SyncEngineState = 'IDLE';
  let pending = 0;
  let oldest: string | null = null;
  let retryInMs: number | null = null;
  let lastError: string | null = null;
  let failures = 0;
  let cancelRetry: (() => void) | null = null;
  let running: Promise<void> | null = null;
  let foto: SyncStatus = { state, pending, oldestPendingSince: oldest, retryInMs, lastError };
  const oyentes = new Set<() => void>();

  function publicar(): void {
    foto = { state, pending, oldestPendingSince: oldest, retryInMs, lastError };
    for (const oyente of [...oyentes]) {
      oyente();
    }
  }

  async function refrescarConteo(): Promise<void> {
    pending = await deps.outbox.pendingCount();
    oldest = await deps.outbox.oldestPendingSince();
  }

  function programar(ms: number): void {
    cancelRetry?.();
    retryInMs = ms;
    cancelRetry = deps.timer.after(ms, () => {
      cancelRetry = null;
      retryInMs = null;
      void trigger();
    });
  }

  function aplicar(resultado: SyncRunOutcome): void {
    if (resultado.kind === 'DONE') {
      failures = 0;
      lastError = null;
      state = 'IDLE';
    } else if (resultado.kind === 'RETRY') {
      failures += 1;
      lastError = resultado.error;
      state = 'WAITING';
      programar(deps.backoff.delayMs(failures, deps.random));
    } else {
      lastError = resultado.code;
      state = 'STOPPED';
    }
  }

  async function pasada(): Promise<void> {
    state = 'SENDING';
    cancelRetry?.();
    cancelRetry = null;
    retryInMs = null;
    publicar();
    try {
      aplicar(await runSync({ outbox: deps.outbox, transport: deps.transport }));
    } catch (error) {
      // Un fallo inesperado no debe dejar la cola muerta: se trata como falla del servidor.
      failures += 1;
      lastError = error instanceof Error ? error.message : 'UNEXPECTED';
      state = 'WAITING';
      programar(deps.backoff.delayMs(failures, deps.random));
    }
    try {
      await deps.afterPass?.();
    } catch {
      // Se vuelve a intentar en la siguiente pasada: lo que ya se confirmó no se pierde.
    }
    await refrescarConteo();
    publicar();
  }

  async function trigger(): Promise<void> {
    if (state === 'STOPPED') {
      await refrescarConteo();
      publicar();
      return;
    }
    if (running !== null) {
      return running;
    }
    running = pasada().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    trigger,
    async resume() {
      state = 'IDLE';
      lastError = null;
      failures = 0;
      await trigger();
    },
    status: () => foto,
    subscribe(listener) {
      oyentes.add(listener);
      return () => {
        oyentes.delete(listener);
      };
    },
    dispose() {
      cancelRetry?.();
      cancelRetry = null;
    },
  };
}

/** Texto del estado de un documento según su operación [GLOSARIO]. */
export type DocumentSyncLabel = 'SAVED_ON_TABLET' | 'SENT';

/** "Guardado en la tablet" mientras la operación del documento no está confirmada; "Enviado" cuando sí. */
export function documentSyncLabel(
  status: 'PENDING' | 'APPLIED' | 'TO_REVIEW' | 'FAILED',
): DocumentSyncLabel {
  return status === 'APPLIED' || status === 'TO_REVIEW' ? 'SENT' : 'SAVED_ON_TABLET';
}

/** ¿Lleva demasiado sin salir? `staleHours` viene de la configuración (`sync_stale_hours`). */
export function isStale(oldestPendingSince: string | null, now: Date, staleHours: number): boolean {
  if (oldestPendingSince === null) {
    return false;
  }
  return now.getTime() - new Date(oldestPendingSince).getTime() >= staleHours * 3_600_000;
}
