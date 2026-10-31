import type { OperationReceiver, SyncTransport } from '@zammir/core';

import { OperationTransportError } from './function-operation-receiver';

/** Adapta el receptor HTTP al puerto de transporte de la cola: la falta de red y los fallos del servidor
 *  se vuelven errores reintentables; un rechazo estructural llega como resultado. */
export function httpOperationTransport(receiver: OperationReceiver): SyncTransport {
  return {
    async send(operacion) {
      try {
        return { ok: true, value: await receiver.receive(operacion) };
      } catch (error) {
        if (error instanceof OperationTransportError) {
          return { ok: false, error: { code: error.kind } };
        }
        // Cualquier otro fallo (por ejemplo, una respuesta que no se entiende) se trata como del servidor.
        return { ok: false, error: { code: 'SERVER_UNAVAILABLE' } };
      }
    },
  };
}
