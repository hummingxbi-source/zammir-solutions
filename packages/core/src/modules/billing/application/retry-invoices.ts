import type { StampRequest } from '../domain/invoice';
import {
  completeInvoice,
  type IssueInvoiceDeps,
  type IssueInvoiceOutcome,
  type InvoiceSourceType,
} from './issue-invoice';

/** Una solicitud que el PAC no contestó: lo que se le mandó y cuántos intentos van. */
export interface PendingInvoice {
  readonly requestId: string;
  readonly source: { readonly type: InvoiceSourceType; readonly id: string };
  readonly attempts: number;
  readonly snapshot: StampRequest;
}

/** Puerto: las solicitudes "en proceso" que ya toca reintentar [RF-M10-15]. */
export interface PendingInvoiceStore {
  /** Las que no tienen intentos recientes (esperaron al menos `waitSeconds`) ni pasaron de `maxAttempts`. */
  listRetriable(opciones: {
    readonly waitSeconds: number;
    readonly maxAttempts: number;
    readonly limit: number;
  }): Promise<readonly PendingInvoice[]>;
  /** Una solicitud en proceso por su identificador; `null` si ya no está en proceso o no existe. */
  getPending(requestId: string): Promise<PendingInvoice | null>;
}

export interface RetryInvoicesDeps extends IssueInvoiceDeps {
  readonly pending: PendingInvoiceStore;
}

export interface RetryPolicy {
  /** Cuánto esperar entre intentos de una misma solicitud. */
  readonly waitSeconds: number;
  /** Intentos automáticos antes de dejarla para que un administrador la revise. */
  readonly maxAttempts: number;
  readonly limit: number;
}

/** Valores por omisión: esperar 2 minutos entre intentos, hasta 8 intentos y 50 solicitudes por pasada. Son de
 *  operación, no del negocio, y el servidor puede cambiarlos con variables de entorno. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = { waitSeconds: 120, maxAttempts: 8, limit: 50 };

export interface RetrySummary {
  /** Cuántas terminaron en factura. */
  readonly stamped: number;
  /** Cuántas siguen en proceso porque el PAC todavía no responde. */
  readonly stillPending: number;
  /** Cuántas rechazó el PAC de forma definitiva. */
  readonly rejected: number;
  /** Cuántas fallaron por un problema nuestro (base o red); se reintentan en la siguiente pasada. */
  readonly errors: number;
}

/** Reintenta una solicitud en proceso con el MISMO identificador: el PAC no timbra dos veces la misma solicitud, así
 *  que reintentar nunca duplica el timbre [RN-24]. Es lo que hace una pasada automática y el botón "Reintentar" del
 *  administrador. */
export async function retryInvoice(
  deps: IssueInvoiceDeps,
  pendiente: PendingInvoice,
): Promise<IssueInvoiceOutcome> {
  try {
    return await completeInvoice(deps, pendiente.snapshot);
  } catch {
    return { kind: 'UNAVAILABLE' };
  }
}

/** Una pasada de reintentos automáticos sobre todo lo que está en proceso y ya toca [RF-M10-15]. */
export async function retryPendingInvoices(
  deps: RetryInvoicesDeps,
  politica: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<RetrySummary> {
  let pendientes: readonly PendingInvoice[];
  try {
    pendientes = await deps.pending.listRetriable(politica);
  } catch {
    return { stamped: 0, stillPending: 0, rejected: 0, errors: 1 };
  }
  let stamped = 0;
  let stillPending = 0;
  let rejected = 0;
  let errors = 0;
  for (const pendiente of pendientes) {
    const r = await retryInvoice(deps, pendiente);
    if (r.kind === 'STAMPED') {
      stamped += 1;
    } else if (r.kind === 'IN_PROCESS') {
      stillPending += 1;
    } else if (r.kind === 'REJECTED') {
      rejected += 1;
    } else {
      errors += 1;
    }
  }
  return { stamped, stillPending, rejected, errors };
}
