import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { sequentialIdGenerator } from '../../../shared-kernel/id';
import type { StampRequest } from '../domain/invoice';
import { SOLICITUD_DE_PRUEBA } from '../contracts/billing-provider.contract';
import type { InvoiceRecord, InvoiceRequestStore } from './issue-invoice';
import {
  DEFAULT_RETRY_POLICY,
  retryInvoice,
  retryPendingInvoices,
  type PendingInvoice,
  type PendingInvoiceStore,
} from './retry-invoices';
import { simulatedBilling } from './simulated-billing';

const AHORA = new Date('2026-11-20T18:00:00.000Z');

function solicitud(id: string): StampRequest {
  return { ...SOLICITUD_DE_PRUEBA, requestId: id };
}

const pendiente = (id: string, intentos = 0): PendingInvoice => ({
  requestId: id,
  source: { type: 'COUNTER_SALE', id: `venta-${id}` },
  attempts: intentos,
  snapshot: solicitud(id),
});

/** Almacén en memoria con solicitudes en proceso que se van terminando. */
function entorno(ids: readonly string[]) {
  const filas = new Map<string, InvoiceRecord>(
    ids.map((id) => [id, { status: 'IN_PROCESS', uuid: null, folio: null }]),
  );
  const intentos: Record<string, string[]> = {};
  let numero = 0;
  const store: InvoiceRequestStore = {
    begin: () => Promise.reject(new Error('un reintento no abre solicitudes')),
    markStamped: (id, e) => {
      numero += 1;
      const folio = `F-2026-${String(numero).padStart(4, '0')}`;
      filas.set(id, { status: 'STAMPED', uuid: e.uuid, folio });
      return Promise.resolve({ folio });
    },
    recordAttempt: (id, error) => {
      (intentos[id] ??= []).push(error);
      return Promise.resolve();
    },
    markFailed: (id) => {
      filas.set(id, { status: 'FAILED', uuid: null, folio: null });
      return Promise.resolve();
    },
  };
  const consultas: { waitSeconds: number; maxAttempts: number; limit: number }[] = [];
  const pending: PendingInvoiceStore = {
    listRetriable: (opciones) => {
      consultas.push(opciones);
      return Promise.resolve(
        ids.filter((id) => filas.get(id)?.status === 'IN_PROCESS').map((id) => pendiente(id)),
      );
    },
    getPending: (id) =>
      Promise.resolve(filas.get(id)?.status === 'IN_PROCESS' ? pendiente(id) : null),
  };
  const provider = simulatedBilling({
    clock: fixedClock(AHORA),
    idGenerator: sequentialIdGenerator('uuid'),
  });
  return {
    deps: { provider, store, clock: fixedClock(AHORA), pending },
    provider,
    filas,
    intentos,
    consultas,
  };
}

describe('reintentar una solicitud en proceso', () => {
  it('con el PAC ya disponible la termina con su folio', async () => {
    const { deps, filas } = entorno(['s1']);
    const r = await retryInvoice(deps, pendiente('s1'));
    expect(r).toEqual({ kind: 'STAMPED', uuid: 'uuid-0001', folio: 'F-2026-0001' });
    expect(filas.get('s1')?.status).toBe('STAMPED');
  });

  it('si el PAC sigue sin responder anota el intento y la deja en proceso', async () => {
    const { deps, provider, intentos, filas } = entorno(['s1']);
    provider.failNext('PROVIDER_UNAVAILABLE');
    expect(await retryInvoice(deps, pendiente('s1'))).toEqual({ kind: 'IN_PROCESS' });
    expect(intentos.s1).toEqual(['PROVIDER_UNAVAILABLE']);
    expect(filas.get('s1')?.status).toBe('IN_PROCESS');
  });

  it('si el PAC timbró pero la respuesta se perdió, reintentar no duplica el timbre [RN-24]', async () => {
    const { deps, provider } = entorno(['s1']);
    provider.failNext('TIMEOUT', { afterStamping: true });
    expect(await retryInvoice(deps, pendiente('s1'))).toEqual({ kind: 'IN_PROCESS' });
    expect((await retryInvoice(deps, pendiente('s1'))).kind).toBe('STAMPED');
    expect(provider.stampedCount()).toBe(1);
  });

  it('un rechazo definitivo la marca fallida y no se reintenta más', async () => {
    const { deps, provider, filas } = entorno(['s1']);
    provider.failNext('CANCELLATION_REJECTED');
    expect(await retryInvoice(deps, pendiente('s1'))).toEqual({
      kind: 'REJECTED',
      code: 'CANCELLATION_REJECTED',
    });
    expect(filas.get('s1')?.status).toBe('FAILED');
  });

  it('un fallo propio (el almacén) responde que no está disponible', async () => {
    const { deps } = entorno(['s1']);
    const roto = {
      ...deps,
      store: { ...deps.store, markStamped: () => Promise.reject(new Error('base caída')) },
    };
    expect(await retryInvoice(roto, pendiente('s1'))).toEqual({ kind: 'UNAVAILABLE' });
  });
});

describe('pasada de reintentos automáticos', () => {
  it('termina todo lo pendiente y cuenta cada resultado', async () => {
    const { deps, provider } = entorno(['a', 'b', 'c', 'd']);
    // Orden de las llamadas al PAC: a timbra; b falla antes (sigue); c se rechaza; d timbra.
    const original = provider.stamp.bind(provider);
    let llamada = 0;
    const conFallas = {
      ...deps,
      provider: Object.assign(Object.create(provider) as typeof provider, {
        stamp: (s: StampRequest) => {
          llamada += 1;
          if (llamada === 2) {
            return Promise.resolve({ ok: false as const, error: { code: 'TIMEOUT' as const } });
          }
          if (llamada === 3) {
            return Promise.resolve({
              ok: false as const,
              error: { code: 'CANCELLATION_REJECTED' as const },
            });
          }
          return original(s);
        },
      }),
    };
    const r = await retryPendingInvoices(conFallas);
    expect(r).toEqual({ stamped: 2, stillPending: 1, rejected: 1, errors: 0 });
  });

  it('pide solo lo que ya toca, con la política configurada', async () => {
    const { deps, consultas } = entorno(['a']);
    await retryPendingInvoices(deps);
    await retryPendingInvoices(deps, { waitSeconds: 10, maxAttempts: 2, limit: 5 });
    expect(consultas).toEqual([
      DEFAULT_RETRY_POLICY,
      { waitSeconds: 10, maxAttempts: 2, limit: 5 },
    ]);
  });

  it('sin nada pendiente no hace nada', async () => {
    const { deps, provider } = entorno([]);
    expect(await retryPendingInvoices(deps)).toEqual({
      stamped: 0,
      stillPending: 0,
      rejected: 0,
      errors: 0,
    });
    expect(provider.stampedCount()).toBe(0);
  });

  it('un fallo propio al listar o al terminar una no detiene a las demás', async () => {
    const { deps } = entorno(['a', 'b']);
    let primera = true;
    const conFalla = {
      ...deps,
      store: {
        ...deps.store,
        markStamped: (id: string, e: Parameters<InvoiceRequestStore['markStamped']>[1]) => {
          if (primera) {
            primera = false;
            return Promise.reject(new Error('base caída'));
          }
          return deps.store.markStamped(id, e);
        },
      },
    };
    const r = await retryPendingInvoices(conFalla);
    expect(r).toEqual({ stamped: 1, stillPending: 0, rejected: 0, errors: 1 });
    const sinListar = {
      ...deps,
      pending: { ...deps.pending, listRetriable: () => Promise.reject(new Error('x')) },
    };
    expect(await retryPendingInvoices(sinListar)).toEqual({
      stamped: 0,
      stillPending: 0,
      rejected: 0,
      errors: 1,
    });
  });
});
