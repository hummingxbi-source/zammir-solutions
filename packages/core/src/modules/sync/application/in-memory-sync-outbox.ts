import type { Clock } from '../../../shared-kernel/clock';
import { err, ok, type Result } from '../../../shared-kernel/result';
import { parseOperation, type OperationResult } from '../domain/operation';
import type { OutboxError, OutboxTransaction, QueuedOperation, SyncOutbox } from './ports';

interface Estado {
  seq: number;
  temp: number;
  documentos: Map<string, Map<string, unknown>>;
  operaciones: Map<string, QueuedOperation>;
}

function copiar(e: Estado): Estado {
  return {
    seq: e.seq,
    temp: e.temp,
    documentos: new Map([...e.documentos].map(([c, docs]) => [c, new Map(docs)])),
    operaciones: new Map(e.operaciones),
  };
}

/** Copia profunda de un documento (los documentos son datos JSON); el almacén nunca comparte referencias. */
function clonar(valor: unknown): unknown {
  return valor === undefined ? undefined : (JSON.parse(JSON.stringify(valor)) as unknown);
}

const NO_ENCONTRADA: OutboxError = { code: 'NOT_FOUND' };

/** Cola de salida en memoria, para pruebas. Las transacciones se atienden una por una y, si fallan,
 *  dejan todo como estaba. */
export function inMemorySyncOutbox(deps: { readonly clock: Clock }): SyncOutbox {
  let estado: Estado = { seq: 0, temp: 0, documentos: new Map(), operaciones: new Map() };
  let cola: Promise<unknown> = Promise.resolve();

  function actualizar(
    opId: string,
    cambio: (op: QueuedOperation) => QueuedOperation,
  ): Result<void, OutboxError> {
    const op = estado.operaciones.get(opId);
    if (op === undefined) {
      return err(NO_ENCONTRADA);
    }
    estado.operaciones.set(opId, cambio(op));
    return ok(undefined);
  }

  const ordenadas = (): QueuedOperation[] =>
    [...estado.operaciones.values()].sort((a, b) => a.envelope.seq - b.envelope.seq);

  return {
    transaction<T>(work: (tx: OutboxTransaction) => Promise<T>): Promise<T> {
      const turno = cola.then(async () => {
        const respaldo = copiar(estado);
        const tx: OutboxTransaction = {
          nextTempNumber: () => {
            estado.temp += 1;
            return Promise.resolve(estado.temp);
          },
          putDocument: (coleccion, id, documento) => {
            const docs = estado.documentos.get(coleccion) ?? new Map<string, unknown>();
            docs.set(id, clonar(documento));
            estado.documentos.set(coleccion, docs);
            return Promise.resolve();
          },
          getDocument: (coleccion, id) =>
            Promise.resolve(clonar(estado.documentos.get(coleccion)?.get(id))),
          listDocuments: (coleccion) =>
            Promise.resolve(
              [...(estado.documentos.get(coleccion)?.values() ?? [])].map((d) => clonar(d)),
            ),
          enqueue: (operacion) => {
            const candidata = { ...operacion, seq: estado.seq + 1 };
            const valida = parseOperation(candidata);
            if (!valida.ok) {
              return Promise.resolve(
                err({ code: 'INVALID_OPERATION', problems: valida.error.problems }),
              );
            }
            estado.seq += 1;
            estado.operaciones.set(valida.value.opId, {
              envelope: valida.value,
              status: 'PENDING',
              attempts: 0,
              enqueuedAt: deps.clock.now().toISOString(),
            });
            return Promise.resolve(ok(valida.value));
          },
        };
        try {
          return await work(tx);
        } catch (error) {
          estado = respaldo;
          throw error;
        }
      });
      cola = turno.catch(() => undefined);
      return turno;
    },

    nextToSend() {
      const todas = ordenadas();
      if (todas.some((o) => o.status === 'FAILED')) {
        return Promise.resolve(null);
      }
      return Promise.resolve(todas.find((o) => o.status === 'PENDING') ?? null);
    },

    isStopped: () => Promise.resolve(ordenadas().some((o) => o.status === 'FAILED')),

    markApplied(opId, result: OperationResult) {
      return Promise.resolve(
        actualizar(opId, (op) => {
          const revisar = result.ok && result.status === 'TO_REVIEW';
          return { ...op, status: revisar ? 'TO_REVIEW' : 'APPLIED', result };
        }),
      );
    },

    recordAttempt(opId, error) {
      return Promise.resolve(
        actualizar(opId, (op) => ({ ...op, attempts: op.attempts + 1, lastError: error })),
      );
    },

    markFailed(opId, reason) {
      return Promise.resolve(
        actualizar(opId, (op) => ({ ...op, status: 'FAILED', lastError: reason })),
      );
    },

    resendFrom(seq) {
      for (const op of ordenadas()) {
        if (op.envelope.seq >= seq && op.status !== 'APPLIED' && op.status !== 'TO_REVIEW') {
          estado.operaciones.set(op.envelope.opId, { ...op, status: 'PENDING' });
        }
      }
      return Promise.resolve();
    },

    pendingCount: () => Promise.resolve(ordenadas().filter((o) => o.status === 'PENDING').length),

    list: () => Promise.resolve(ordenadas()),

    oldestPendingSince: () =>
      Promise.resolve(ordenadas().find((o) => o.status === 'PENDING')?.enqueuedAt ?? null),
  };
}
