import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { sequentialIdGenerator } from '../../../shared-kernel/id';
import type { InvoiceSourceLine } from '../domain/invoice-concepts';
import {
  issueInvoice,
  type InvoiceRecord,
  type InvoiceRequestStore,
  type IssueInvoiceInput,
} from './issue-invoice';
import { simulatedBilling } from './simulated-billing';

interface Fila {
  record: InvoiceRecord;
  sourceId: string;
}

/** Almacén en memoria: una factura vigente por documento y folios consecutivos. */
function almacen() {
  const filas = new Map<string, Fila>();
  let numero = 0;
  const archivos: Record<string, { xml: string; pdf: Uint8Array }> = {};
  const intentos: string[] = [];
  const store: InvoiceRequestStore = {
    begin(entrada) {
      const existente = filas.get(entrada.requestId);
      if (existente !== undefined) {
        return Promise.resolve({ kind: 'EXISTING', record: existente.record });
      }
      const otra = [...filas.values()].find(
        (f) =>
          f.sourceId === entrada.source.id &&
          (f.record.status === 'IN_PROCESS' || f.record.status === 'STAMPED'),
      );
      if (otra !== undefined) {
        return Promise.resolve({ kind: 'ALREADY_INVOICED' });
      }
      filas.set(entrada.requestId, {
        sourceId: entrada.source.id,
        record: { status: 'IN_PROCESS', uuid: null, folio: null },
      });
      return Promise.resolve({ kind: 'STARTED' });
    },
    markStamped(requestId, entrada) {
      numero += 1;
      const folio = `F-2026-${String(numero).padStart(4, '0')}`;
      filas.set(requestId, {
        sourceId: filas.get(requestId)?.sourceId ?? '',
        record: { status: 'STAMPED', uuid: entrada.uuid, folio },
      });
      archivos[requestId] = { xml: entrada.xml, pdf: entrada.pdf };
      return Promise.resolve({ folio });
    },
    recordAttempt(requestId, error) {
      intentos.push(`${requestId}:${error}`);
      return Promise.resolve();
    },
    markFailed(requestId) {
      const f = filas.get(requestId);
      if (f !== undefined) {
        f.record = { status: 'FAILED', uuid: null, folio: null };
      }
      return Promise.resolve();
    },
  };
  return { store, filas, archivos, intentos };
}

const linea: InvoiceSourceLine = {
  name: 'Vidrio claro 6 mm',
  quantity: 2,
  baseCents: 50_000,
  taxCents: 8_000,
  lineTotalCents: 58_000,
  productServiceKey: '30171500',
  unitKey: 'MTK',
  taxObject: '02',
};

const entrada: IssueInvoiceInput = {
  requestId: 'solicitud-1',
  source: { type: 'COUNTER_SALE', id: 'venta-1' },
  channel: 'PORTAL',
  recipient: {
    rfc: 'XAXX010101000',
    name: 'CLIENTE DE PRUEBA',
    fiscalZip: '55900',
    regime: '616',
    cfdiUse: 'S01',
  },
  lines: [linea],
  paymentForm: '03',
};

function armar() {
  const provider = simulatedBilling({
    clock: fixedClock(new Date('2026-11-04T18:00:00.000Z')),
    idGenerator: sequentialIdGenerator('uuid'),
  });
  const a = almacen();
  return {
    provider,
    ...a,
    deps: { provider, store: a.store, clock: fixedClock(new Date('2026-11-04T18:00:00.000Z')) },
  };
}

describe('emitir una factura', () => {
  it('timbra, guarda el timbre con sus archivos y devuelve el folio F consecutivo', async () => {
    const { deps, archivos, provider } = armar();
    const r = await issueInvoice(deps, entrada);
    expect(r).toEqual({ kind: 'STAMPED', uuid: 'uuid-0001', folio: 'F-2026-0001' });
    expect(provider.stampedCount()).toBe(1);
    expect(archivos['solicitud-1']?.xml).toContain('uuid-0001');
    expect(archivos['solicitud-1']?.pdf.byteLength).toBeGreaterThan(0);
  });

  it('repetir la misma solicitud devuelve la misma factura y no gasta otro timbre [RN-24]', async () => {
    const { deps, provider } = armar();
    const a = await issueInvoice(deps, entrada);
    const b = await issueInvoice(deps, entrada);
    expect(b).toEqual(a);
    expect(provider.stampedCount()).toBe(1);
  });

  it('otra solicitud sobre la misma venta se rechaza: una operación, una factura', async () => {
    const { deps, provider } = armar();
    await issueInvoice(deps, entrada);
    const otra = await issueInvoice(deps, { ...entrada, requestId: 'solicitud-2' });
    expect(otra).toEqual({ kind: 'ALREADY_INVOICED' });
    expect(provider.stampedCount()).toBe(1);
  });

  it('dos ventas distintas llevan folios distintos y consecutivos', async () => {
    const { deps } = armar();
    await issueInvoice(deps, entrada);
    const r = await issueInvoice(deps, {
      ...entrada,
      requestId: 'solicitud-2',
      source: { type: 'WORK_ORDER', id: 'orden-1' },
    });
    expect(r.kind === 'STAMPED' && r.folio).toBe('F-2026-0002');
  });

  it('un RFC o código postal inválidos se rechazan antes de gastar un timbre y dicen cuáles campos', async () => {
    const { deps, provider, filas } = armar();
    const r = await issueInvoice(deps, {
      ...entrada,
      recipient: { ...entrada.recipient, rfc: 'CORTO', fiscalZip: '12' },
    });
    expect(r).toEqual({ kind: 'INVALID', fields: ['recipient.rfc', 'recipient.fiscalZip'] });
    expect(provider.stampedCount()).toBe(0);
    expect(filas.size).toBe(0);
  });

  it('con líneas sin claves del SAT no se factura ni se abre la solicitud', async () => {
    const { deps, filas } = armar();
    const r = await issueInvoice(deps, {
      ...entrada,
      lines: [{ ...linea, productServiceKey: null }],
    });
    expect(r).toEqual({ kind: 'NOT_BILLABLE', reason: 'FISCAL_DATA_MISSING' });
    expect(filas.size).toBe(0);
    const sin = await issueInvoice(deps, { ...entrada, lines: [] });
    expect(sin).toEqual({ kind: 'NOT_BILLABLE', reason: 'NO_LINES' });
  });

  it('si el PAC no responde queda en proceso y el reintento con el mismo identificador termina sin duplicar', async () => {
    const { deps, provider, filas } = armar();
    provider.failNext('TIMEOUT', { afterStamping: true });
    const primera = await issueInvoice(deps, entrada);
    expect(primera).toEqual({ kind: 'IN_PROCESS' });
    expect(filas.get('solicitud-1')?.record.status).toBe('IN_PROCESS');
    const segunda = await issueInvoice(deps, entrada);
    expect(segunda).toEqual({ kind: 'STAMPED', uuid: 'uuid-0001', folio: 'F-2026-0001' });
    expect(provider.stampedCount()).toBe(1);
  });

  it('si el PAC cae antes de timbrar, también queda en proceso y reintenta', async () => {
    const { deps, provider } = armar();
    provider.failNext('PROVIDER_UNAVAILABLE');
    expect(await issueInvoice(deps, entrada)).toEqual({ kind: 'IN_PROCESS' });
    expect((await issueInvoice(deps, entrada)).kind).toBe('STAMPED');
  });

  it('si ya timbró pero no se pudieron bajar los archivos, queda en proceso sin timbrar otra vez', async () => {
    const { deps, provider } = armar();
    let llamadas = 0;
    const original = provider.download.bind(provider);
    const conFalla = {
      ...deps,
      provider: Object.assign(Object.create(provider) as typeof provider, {
        download: (uuid: string) => {
          llamadas += 1;
          if (llamadas === 1) {
            return Promise.resolve({ ok: false as const, error: { code: 'TIMEOUT' as const } });
          }
          return original(uuid);
        },
      }),
    };
    expect(await issueInvoice(conFalla, entrada)).toEqual({ kind: 'IN_PROCESS' });
    expect((await issueInvoice(conFalla, entrada)).kind).toBe('STAMPED');
    expect(provider.stampedCount()).toBe(1);
  });

  it('un rechazo definitivo del PAC marca la solicitud como fallida y no se reintenta con ese identificador', async () => {
    const { deps, provider, filas } = armar();
    provider.failNext('CANCELLATION_REJECTED');
    const r = await issueInvoice(deps, entrada);
    expect(r).toEqual({ kind: 'REJECTED', code: 'CANCELLATION_REJECTED' });
    expect(filas.get('solicitud-1')?.record.status).toBe('FAILED');
    expect((await issueInvoice(deps, entrada)).kind).toBe('REJECTED');
    // Con otro identificador se puede volver a intentar.
    const nueva = await issueInvoice(deps, { ...entrada, requestId: 'solicitud-2' });
    expect(nueva.kind).toBe('STAMPED');
  });

  it('si el almacén falla responde que no está disponible', async () => {
    const { deps } = armar();
    const roto: InvoiceRequestStore = {
      ...deps.store,
      begin: () => Promise.reject(new Error('base caída')),
    };
    expect(await issueInvoice({ ...deps, store: roto }, entrada)).toEqual({ kind: 'UNAVAILABLE' });
  });
});
