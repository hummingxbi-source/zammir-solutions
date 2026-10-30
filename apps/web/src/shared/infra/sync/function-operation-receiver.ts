import type { OperationReceiver, OperationResult } from '@zammir/core';

export interface FunctionOperationReceiverOptions {
  /** Dirección de Supabase, sin diagonal final. */
  readonly url: string;
  readonly anonKey: string;
  /** Sesión de la tablet. Se pide en cada envío por si se renovó. */
  readonly accessToken: () => Promise<string>;
  /** Solo para pruebas. */
  readonly fetchImpl?: typeof fetch;
}

/** Error de infraestructura: sin conexión o el servidor no pudo (se reintenta). */
export class OperationTransportError extends Error {
  readonly kind: 'NETWORK_UNAVAILABLE' | 'SERVER_UNAVAILABLE';

  constructor(kind: 'NETWORK_UNAVAILABLE' | 'SERVER_UNAVAILABLE') {
    super(kind);
    this.kind = kind;
  }
}

/** Adaptador de OperationReceiver: llama a la función de servidor `recibir-operacion` con la sesión
 *  de la tablet. Los rechazos estructurales llegan como resultado; la falta de red o un error del
 *  servidor se lanzan como `OperationTransportError` para que la cola reintente. */
export function functionOperationReceiver(
  opciones: FunctionOperationReceiverOptions,
): OperationReceiver {
  const peticion = opciones.fetchImpl ?? fetch;
  return {
    async receive(operacion) {
      let respuesta: Response;
      try {
        respuesta = await peticion(`${opciones.url}/functions/v1/recibir-operacion`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            apikey: opciones.anonKey,
            authorization: `Bearer ${await opciones.accessToken()}`,
          },
          body: JSON.stringify(operacion),
        });
      } catch {
        throw new OperationTransportError('NETWORK_UNAVAILABLE');
      }
      if (respuesta.status >= 500) {
        throw new OperationTransportError('SERVER_UNAVAILABLE');
      }
      let cuerpo: unknown;
      try {
        cuerpo = await respuesta.json();
      } catch {
        throw new OperationTransportError('SERVER_UNAVAILABLE');
      }
      if (typeof cuerpo !== 'object' || cuerpo === null || !('ok' in cuerpo)) {
        throw new OperationTransportError('SERVER_UNAVAILABLE');
      }
      return cuerpo as OperationResult;
    },
  };
}
