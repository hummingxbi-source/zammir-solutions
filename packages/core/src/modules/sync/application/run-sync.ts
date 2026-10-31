import type { Random } from '../../../shared-kernel/random';
import { err, ok, type Result } from '../../../shared-kernel/result';
import {
  isStructuralRejection,
  type OperationEnvelope,
  type OperationResult,
} from '../domain/operation';
import type { SyncOutbox } from './ports';

export type TransportErrorCode = 'NETWORK_UNAVAILABLE' | 'SERVER_UNAVAILABLE';

export interface TransportError {
  readonly code: TransportErrorCode;
}

/** Puerto: cómo llega una operación al servidor. Un rechazo estructural llega como resultado; la
 *  falta de red o un fallo del servidor llegan como error, y se reintentan. */
export interface SyncTransport {
  send(operation: OperationEnvelope): Promise<Result<OperationResult, TransportError>>;
}

export interface BackoffPolicy {
  /** Espera antes del intento número `attempt` (1, 2, 3…), en milisegundos. */
  delayMs(attempt: number, random: Random): number;
}

export interface ExponentialBackoffOptions {
  readonly baseMs: number;
  readonly factor: number;
  readonly capMs: number;
  /** Variación aleatoria: 0.2 = hasta ±20 % (evita que dos tablets reintenten al mismo tiempo). */
  readonly jitter: number;
}

/** Espera creciente con tope y variación [RNF-04]: 2 s, 4 s, 8 s… hasta 5 minutos. No hay límite de
 *  intentos: se reintenta mientras haya operaciones sin enviar. */
export const DEFAULT_BACKOFF: ExponentialBackoffOptions = {
  baseMs: 2000,
  factor: 2,
  capMs: 300_000,
  jitter: 0.2,
};

export function exponentialBackoff(
  opciones: ExponentialBackoffOptions = DEFAULT_BACKOFF,
): BackoffPolicy {
  return {
    delayMs(attempt, random) {
      const crudo = Math.min(opciones.capMs, opciones.baseMs * opciones.factor ** (attempt - 1));
      const variacion = 1 + opciones.jitter * (2 * random.nextFraction() - 1);
      return Math.round(Math.min(opciones.capMs, crudo * variacion));
    },
  };
}

/** Cómo terminó una pasada de envío:
 *  - `DONE`: no quedan operaciones por enviar.
 *  - `RETRY`: no se pudo (sin red o servidor caído); hay que volver a intentar más tarde.
 *  - `STOPPED`: un rechazo estructural detuvo la cola; hace falta soporte. */
export type SyncRunOutcome =
  | { readonly kind: 'DONE'; readonly sent: number }
  | { readonly kind: 'RETRY'; readonly sent: number; readonly error: TransportErrorCode }
  | { readonly kind: 'STOPPED'; readonly sent: number; readonly code: string };

/** Envía en orden las operaciones pendientes, de una en una, esperando la confirmación de cada una
 *  [SINCRONIZACION §4]. */
export async function runSync(deps: {
  readonly outbox: SyncOutbox;
  readonly transport: SyncTransport;
}): Promise<SyncRunOutcome> {
  let enviadas = 0;
  let reenviosDeEstaPasada = 0;
  for (;;) {
    const siguiente = await deps.outbox.nextToSend();
    if (siguiente === null) {
      return (await deps.outbox.isStopped())
        ? { kind: 'STOPPED', sent: enviadas, code: 'FAILED_OPERATION' }
        : { kind: 'DONE', sent: enviadas };
    }
    const sobre = siguiente.envelope;
    const respuesta = await deps.transport.send(sobre);
    if (!respuesta.ok) {
      await deps.outbox.recordAttempt(sobre.opId, respuesta.error.code);
      return { kind: 'RETRY', sent: enviadas, error: respuesta.error.code };
    }
    const resultado = respuesta.value;
    if (resultado.ok) {
      await deps.outbox.markApplied(sobre.opId, resultado);
      enviadas += 1;
      continue;
    }
    if (!isStructuralRejection(resultado)) {
      // Fuera de orden: el servidor dice cuál espera. Se reenvía desde esa; si la que espera ya está
      // confirmada aquí (o ya se reenvió en esta pasada), las dos partes no coinciden: es un problema.
      const esperada = resultado.expectedSeq ?? sobre.seq;
      reenviosDeEstaPasada += 1;
      const hayEsperada = (await deps.outbox.list()).some(
        (o) => o.envelope.seq === esperada && o.status !== 'APPLIED' && o.status !== 'TO_REVIEW',
      );
      if (reenviosDeEstaPasada > 3 || !hayEsperada) {
        await deps.outbox.markFailed(sobre.opId, 'SEQUENCE_MISMATCH');
        return { kind: 'STOPPED', sent: enviadas, code: 'SEQUENCE_MISMATCH' };
      }
      await deps.outbox.resendFrom(esperada);
      continue;
    }
    await deps.outbox.markFailed(sobre.opId, resultado.code);
    return { kind: 'STOPPED', sent: enviadas, code: resultado.code };
  }
}

/** Convierte `ok`/`err` de transporte en una función; útil en pruebas y adaptadores. */
export function transportOk(r: OperationResult): Result<OperationResult, TransportError> {
  return ok(r);
}

export function transportError(code: TransportErrorCode): Result<OperationResult, TransportError> {
  return err({ code });
}
