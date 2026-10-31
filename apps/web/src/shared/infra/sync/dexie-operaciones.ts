import Dexie, { type EntityTable } from 'dexie';
import {
  err,
  ok,
  parseOperation,
  type Clock,
  type OperationResult,
  type OutboxError,
  type OutboxTransaction,
  type QueuedOperation,
  type Result,
  type SyncOutbox,
} from '@zammir/core';

interface FilaDeDocumento {
  readonly llave: string;
  readonly coleccion: string;
  readonly id: string;
  readonly documento: unknown;
}

interface FilaDeContador {
  readonly clave: string;
  readonly valor: number;
}

class BaseDeOperaciones extends Dexie {
  operaciones!: EntityTable<
    QueuedOperation & { readonly opId: string; readonly seq: number },
    'opId'
  >;
  documentos!: EntityTable<FilaDeDocumento, 'llave'>;
  contadores!: EntityTable<FilaDeContador, 'clave'>;

  constructor(nombre: string) {
    super(nombre);
    // `seq` e `status` están indexados para pedir "la siguiente por enviar" sin recorrer todo.
    this.version(1).stores({
      operaciones: 'opId, seq, status',
      documentos: 'llave, coleccion',
      contadores: 'clave',
    });
  }
}

const SEQ = 'seq';
const TEMP = 'folio-provisional';
const NO_ENCONTRADA: OutboxError = { code: 'NOT_FOUND' };

type Fila = QueuedOperation & { readonly opId: string; readonly seq: number };

function aFila(op: QueuedOperation): Fila {
  return { ...op, opId: op.envelope.opId, seq: op.envelope.seq };
}

function aOperacion(fila: Fila): QueuedOperation {
  return {
    envelope: fila.envelope,
    status: fila.status,
    attempts: fila.attempts,
    enqueuedAt: fila.enqueuedAt,
    ...(fila.lastError === undefined ? {} : { lastError: fila.lastError }),
    ...(fila.result === undefined ? {} : { result: fila.result }),
  };
}

/** Cola de salida en IndexedDB: documentos, operaciones y contadores en una sola base, para que se
 *  guarden en la misma transacción local [ADR-0012, S2-02]. Sobrevive a cerrar la aplicación. */
export function dexieOperaciones(deps: {
  readonly clock: Clock;
  readonly nombre?: string;
}): SyncOutbox {
  const base = new BaseDeOperaciones(deps.nombre ?? 'zammir-operaciones');
  const tablas = [base.operaciones, base.documentos, base.contadores];

  async function siguiente(clave: string): Promise<number> {
    const actual = (await base.contadores.get(clave))?.valor ?? 0;
    await base.contadores.put({ clave, valor: actual + 1 });
    return actual + 1;
  }

  async function actualizar(
    opId: string,
    cambio: (op: QueuedOperation) => QueuedOperation,
  ): Promise<Result<void, OutboxError>> {
    return base.transaction('rw', base.operaciones, async () => {
      const fila = await base.operaciones.get(opId);
      if (fila === undefined) {
        return err(NO_ENCONTRADA);
      }
      await base.operaciones.put(aFila(cambio(aOperacion(fila))));
      return ok(undefined);
    });
  }

  const ordenadas = async (): Promise<QueuedOperation[]> =>
    (await base.operaciones.orderBy('seq').toArray()).map(aOperacion);

  const tx: OutboxTransaction = {
    nextTempNumber: () => siguiente(TEMP),
    async putDocument(coleccion, id, documento) {
      await base.documentos.put({ llave: `${coleccion}\u0000${id}`, coleccion, id, documento });
    },
    async getDocument(coleccion, id) {
      return (await base.documentos.get(`${coleccion}\u0000${id}`))?.documento;
    },
    async listDocuments(coleccion) {
      return (await base.documentos.where('coleccion').equals(coleccion).toArray()).map(
        (fila) => fila.documento,
      );
    },
    async enqueue(operacion) {
      // Se valida con un seq provisional; el definitivo se toma solo si es válida.
      const candidata = parseOperation({ ...operacion, seq: 1 });
      if (!candidata.ok) {
        return err({ code: 'INVALID_OPERATION', problems: candidata.error.problems });
      }
      const seq = await siguiente(SEQ);
      const envelope = { ...candidata.value, seq };
      await base.operaciones.put(
        aFila({
          envelope,
          status: 'PENDING',
          attempts: 0,
          enqueuedAt: deps.clock.now().toISOString(),
        }),
      );
      return ok(envelope);
    },
  };

  return {
    // Dexie confirma la transacción si `work` termina y la revierte si rechaza. Dentro de `work` solo
    // se pueden esperar operaciones de esta base (si no, IndexedDB cierra la transacción).
    transaction: (work) => base.transaction('rw', tablas, () => work(tx)),

    async nextToSend() {
      const todas = await ordenadas();
      if (todas.some((o) => o.status === 'FAILED')) {
        return null;
      }
      return todas.find((o) => o.status === 'PENDING') ?? null;
    },

    async isStopped() {
      return (await base.operaciones.where('status').equals('FAILED').count()) > 0;
    },

    markApplied: (opId, result: OperationResult) =>
      actualizar(opId, (op) => ({
        ...op,
        status: result.ok && result.status === 'TO_REVIEW' ? 'TO_REVIEW' : 'APPLIED',
        result,
      })),

    recordAttempt: (opId, error) =>
      actualizar(opId, (op) => ({ ...op, attempts: op.attempts + 1, lastError: error })),

    markFailed: (opId, reason) =>
      actualizar(opId, (op) => ({ ...op, status: 'FAILED', lastError: reason })),

    async resendFrom(seq) {
      await base.transaction('rw', base.operaciones, async () => {
        const filas = await base.operaciones.where('seq').aboveOrEqual(seq).toArray();
        for (const fila of filas) {
          if (fila.status !== 'APPLIED' && fila.status !== 'TO_REVIEW') {
            await base.operaciones.put({ ...fila, status: 'PENDING' });
          }
        }
      });
    },

    pendingCount: () => base.operaciones.where('status').equals('PENDING').count(),

    list: ordenadas,

    async oldestPendingSince() {
      const primera = (await ordenadas()).find((o) => o.status === 'PENDING');
      return primera?.enqueuedAt ?? null;
    },
  };
}
