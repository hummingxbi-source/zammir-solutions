import type { Clock } from '../../../shared-kernel/clock';
import { formatFolio } from '../../../shared-kernel/folio/folio';
import { folioYear } from '../../../shared-kernel/folio/folio';
import { issueQuotePayloadSchema, parseEnvelope, type OperationResult } from '../domain/operation';
import type { FolioAllocator } from './folio-allocator';

/** Puerto del servidor: recibe una operación de una tablet y la aplica UNA sola vez [RNF-03, ADR-0016].
 *  - El mismo `opId` devuelve el mismo resultado guardado, sin repetir nada ni consumir otro folio.
 *  - `seq` debe ser la última aplicada de ese dispositivo + 1; si no, responde `OUT_OF_ORDER`.
 *  - Un dispositivo revocado, un tipo desconocido o una carga inválida se rechazan sin guardar nada.
 *  - Una persona desactivada o desconocida no se rechaza: se aplica y queda `TO_REVIEW` [ADR-0013]. */
export interface OperationReceiver {
  receive(operation: unknown): Promise<OperationResult>;
}

export interface InMemoryReceiverState {
  readonly activeDevices: Set<string>;
  readonly activeUsers: Set<string>;
  readonly knownCustomers: Set<string>;
}

export interface InMemoryReceiver extends OperationReceiver {
  readonly state: InMemoryReceiverState;
  quoteCount(): number;
  operationCount(): number;
  /** Folio definitivo de una cotización, si ya se aplicó. */
  folioOf(documentId: string): string | undefined;
}

interface Guardada {
  readonly resultado: OperationResult;
}

/** Adaptador en memoria para pruebas. Se comporta como `receive_operation` de la base: bloquea por
 *  dispositivo, es idempotente y asigna el folio al final dentro de la transacción. */
export function inMemoryOperationReceiver(deps: {
  readonly folios: FolioAllocator;
  readonly clock: Clock;
  /** Dispositivo que hace la llamada (su sesión); una operación a nombre de otro se rechaza. */
  readonly callerDeviceId: string;
  readonly state?: InMemoryReceiverState;
  readonly shared?: SharedStore;
}): InMemoryReceiver {
  const compartido = deps.shared ?? crearAlmacen();
  const state = deps.state ?? compartido.state;

  return {
    state,
    quoteCount: () => compartido.cotizaciones.size,
    operationCount: () => compartido.operaciones.size,
    folioOf: (id) => compartido.cotizaciones.get(id),
    async receive(crudo) {
      const sobre = parseEnvelope(crudo);
      if (!sobre.ok) {
        return {
          ok: false,
          code: sobre.error.code === 'UNKNOWN_TYPE' ? 'UNKNOWN_TYPE' : 'INVALID_ENVELOPE',
        };
      }
      const op = sobre.value;
      if (op.deviceId !== deps.callerDeviceId || !state.activeDevices.has(op.deviceId)) {
        return { ok: false, code: 'DEVICE_REVOKED' };
      }

      // Una operación a la vez por dispositivo, igual que el bloqueo de su fila en la base.
      return compartido.porDispositivo(op.deviceId, async () => {
        const previa = compartido.operaciones.get(op.opId);
        if (previa !== undefined) {
          return previa.resultado;
        }
        const ultima = compartido.ultimaSeq.get(op.deviceId) ?? 0;
        if (op.seq !== ultima + 1) {
          return { ok: false, code: 'OUT_OF_ORDER', expectedSeq: ultima + 1 } as const;
        }

        let estado: 'APPLIED' | 'TO_REVIEW' = 'APPLIED';
        let motivo: string | undefined;
        if (!state.activeUsers.has(op.userId)) {
          estado = 'TO_REVIEW';
          motivo = 'USER_INACTIVE';
        }

        const carga = issueQuotePayloadSchema.safeParse(op.payload);
        if (op.type !== 'IssueQuote') {
          // Los demás tipos del sprint se implementan en sus historias; hasta entonces no hay efecto.
          return { ok: false, code: 'UNKNOWN_TYPE' } as const;
        }
        if (!carga.success) {
          return { ok: false, code: 'INVALID_PAYLOAD' } as const;
        }
        const q = carga.data;
        if (!state.knownCustomers.has(q.customerId)) {
          return { ok: false, code: 'INVALID_PAYLOAD', detail: 'CUSTOMER_NOT_FOUND' } as const;
        }

        if (compartido.codigos.has(q.publicCode)) {
          estado = 'TO_REVIEW';
          motivo = 'PUBLIC_CODE_CONFLICT';
          const resultado: OperationResult = { ok: true, status: estado, reason: motivo };
          compartido.operaciones.set(op.opId, { resultado });
          compartido.ultimaSeq.set(op.deviceId, op.seq);
          return resultado;
        }

        const resultado = await deps.folios.withTransaction(async (tx) => {
          const anio = folioYear(new Date(q.issuedAt));
          const numero = await tx.next('QUOTE', anio);
          const folio = formatFolio('QUOTE', anio, numero);
          if (!folio.ok) {
            throw new Error('folio inválido');
          }
          const res: OperationResult = {
            ok: true,
            status: estado,
            folio: folio.value,
            documentId: q.id,
            ...(motivo === undefined ? {} : { reason: motivo }),
          };
          compartido.cotizaciones.set(q.id, folio.value);
          compartido.codigos.add(q.publicCode);
          return res;
        });
        compartido.operaciones.set(op.opId, { resultado });
        compartido.ultimaSeq.set(op.deviceId, op.seq);
        return resultado;
      });
    },
  };
}

/** Lo que comparten los receptores de varios dispositivos: es "el servidor". */
export interface SharedStore {
  readonly state: InMemoryReceiverState;
  readonly operaciones: Map<string, Guardada>;
  readonly cotizaciones: Map<string, string>;
  readonly codigos: Set<string>;
  readonly ultimaSeq: Map<string, number>;
  porDispositivo<T>(deviceId: string, trabajo: () => Promise<T>): Promise<T>;
}

export function crearAlmacen(): SharedStore {
  const colas = new Map<string, Promise<unknown>>();
  return {
    state: {
      activeDevices: new Set(),
      activeUsers: new Set(),
      knownCustomers: new Set(),
    },
    operaciones: new Map(),
    cotizaciones: new Map(),
    codigos: new Set(),
    ultimaSeq: new Map(),
    porDispositivo<T>(deviceId: string, trabajo: () => Promise<T>): Promise<T> {
      const turno = (colas.get(deviceId) ?? Promise.resolve()).then(trabajo);
      colas.set(
        deviceId,
        turno.catch(() => undefined),
      );
      return turno;
    },
  };
}
