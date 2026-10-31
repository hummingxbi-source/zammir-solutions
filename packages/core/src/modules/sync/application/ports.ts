import type { Result } from '../../../shared-kernel/result';
import type { OperationEnvelope, OperationResult } from '../domain/operation';

/** Estado de una operación en la cola de la tablet.
 *  - `PENDING`: guardada en la tablet, aún sin confirmar.
 *  - `APPLIED`: el servidor la aplicó ("Enviado").
 *  - `TO_REVIEW`: el servidor la aplicó pero un administrador debe revisarla; para la tablet ya salió.
 *  - `FAILED`: rechazo estructural; la cola se detiene hasta que soporte la atienda. */
export type QueuedStatus = 'PENDING' | 'APPLIED' | 'TO_REVIEW' | 'FAILED';

export interface QueuedOperation {
  readonly envelope: OperationEnvelope;
  readonly status: QueuedStatus;
  /** Veces que se intentó enviar y no se pudo confirmar (red, servidor). */
  readonly attempts: number;
  readonly lastError?: string;
  readonly result?: OperationResult;
  /** Instante en que se guardó en la tablet (ISO, UTC). */
  readonly enqueuedAt: string;
}

export type OutboxErrorCode =
  /** La operación no cumple el formato; no se guardó nada. */
  'INVALID_OPERATION' | 'NOT_FOUND';

export interface OutboxError {
  readonly code: OutboxErrorCode;
  readonly problems?: readonly string[];
}

/** Lo que se puede hacer dentro de UNA transacción local: guardar documentos, tomar los números
 *  siguientes y encolar la operación. Si algo falla, nada de esto queda guardado [ADR-0012, S2-02]. */
export interface OutboxTransaction {
  /** Siguiente número del folio provisional del dispositivo (1, 2, 3…): una sola serie para todos los
   *  tipos de documento [RN-16]. Se consume solo si la transacción se confirma. */
  nextTempNumber(): Promise<number>;
  /** Guarda o reemplaza un documento (cotización, cliente…) en su colección. */
  putDocument(collection: string, id: string, document: unknown): Promise<void>;
  getDocument(collection: string, id: string): Promise<unknown>;
  listDocuments(collection: string): Promise<readonly unknown[]>;
  /** Valida la operación, le asigna el siguiente `seq` y la deja en la cola. Sin `seq`: lo pone la cola. */
  enqueue(
    operation: Omit<OperationEnvelope, 'seq'>,
  ): Promise<Result<OperationEnvelope, OutboxError>>;
}

/** Cola de salida de la tablet [ADR-0012]. Todo lo que se captura se guarda primero aquí, junto con su
 *  operación y en el mismo paso, y espera su turno para enviarse. Sobrevive a cerrar la aplicación. */
export interface SyncOutbox {
  /** Todo o nada: si `work` rechaza (lanza), no queda ni el documento ni la operación ni los números
   *  consumidos. */
  transaction<T>(work: (tx: OutboxTransaction) => Promise<T>): Promise<T>;

  /** La operación pendiente de menor `seq`; `null` si no hay o si la cola está detenida por un fallo. */
  nextToSend(): Promise<QueuedOperation | null>;
  /** ¿Hay una operación `FAILED`? Mientras la haya, la cola de este dispositivo no envía nada. */
  isStopped(): Promise<boolean>;
  markApplied(opId: string, result: OperationResult): Promise<Result<void, OutboxError>>;
  /** Registra un intento fallido por red o servidor; la operación sigue pendiente. */
  recordAttempt(opId: string, error: string): Promise<Result<void, OutboxError>>;
  /** Rechazo estructural: marca la operación y detiene la cola. No se descarta nada. */
  markFailed(opId: string, reason: string): Promise<Result<void, OutboxError>>;
  /** Tras `OUT_OF_ORDER`: las operaciones con `seq` ≥ `seq` que no estén aplicadas vuelven a pendientes. */
  resendFrom(seq: number): Promise<void>;
  /** Operaciones sin confirmar (pendientes). */
  pendingCount(): Promise<number>;
  list(): Promise<readonly QueuedOperation[]>;
  /** Hora del envío pendiente más antiguo (para avisar si lleva demasiado sin salir); `null` si no hay. */
  oldestPendingSince(): Promise<string | null>;
}
