import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId, sequentialIdGenerator } from '../../../shared-kernel/id';
import type { InvoiceRecord, InvoiceRequestStore } from './issue-invoice';
import {
  issueSystemInvoice,
  validateSystemRecipient,
  type InvoiceSourceStore,
  type IssueSystemInvoiceInput,
} from './issue-system-invoice';
import type { PortalDocumentRecord } from './portal-lookup';
import { simulatedBilling } from './simulated-billing';

const AHORA = new Date('2026-12-20T18:00:00.000Z');
const ana = asId<'User'>('u-ana');
const luis = asId<'User'>('u-luis');

const venta: PortalDocumentRecord = {
  id: 'venta-1',
  type: 'COUNTER_SALE',
  folio: 'V-2026-0001',
  cancelled: false,
  totalCents: 11_600,
  paidCents: 11_600,
  // Un mes antes: fuera del plazo del portal, pero un administrador sí puede facturar.
  settledAt: '2026-10-03T18:00:00.000Z',
  invoiced: false,
  paymentMethods: ['CASH'],
  lines: [
    {
      name: 'Chapa',
      quantity: 1,
      lineTotalCents: 11_600,
      baseCents: 10_000,
      taxCents: 1_600,
      productServiceKey: '30171500',
      unitKey: 'H87',
      taxObject: '02',
    },
  ],
};

function entorno(documento: PortalDocumentRecord | null = venta) {
  const filas = new Map<string, { record: InvoiceRecord; sourceId: string }>();
  let numero = 0;
  const facturas: InvoiceRequestStore = {
    begin: (e) => {
      const existente = filas.get(e.requestId);
      if (existente !== undefined) {
        return Promise.resolve({ kind: 'EXISTING', record: existente.record });
      }
      if (
        [...filas.values()].some((f) => f.sourceId === e.source.id && f.record.status !== 'FAILED')
      ) {
        return Promise.resolve({ kind: 'ALREADY_INVOICED' });
      }
      filas.set(e.requestId, {
        sourceId: e.source.id,
        record: { status: 'IN_PROCESS', uuid: null, folio: null },
      });
      return Promise.resolve({ kind: 'STARTED' });
    },
    markStamped: (id, e) => {
      numero += 1;
      const folio = `F-2026-${String(numero).padStart(4, '0')}`;
      const fila = filas.get(id);
      filas.set(id, {
        sourceId: fila?.sourceId ?? '',
        record: { status: 'STAMPED', uuid: e.uuid, folio },
      });
      return Promise.resolve({ folio });
    },
    recordAttempt: () => Promise.resolve(),
    markFailed: () => Promise.resolve(),
  };
  const provider = simulatedBilling({
    clock: fixedClock(AHORA),
    idGenerator: sequentialIdGenerator('uuid'),
  });
  const buscadas: string[] = [];
  const sources: InvoiceSourceStore = {
    find: (s) => {
      buscadas.push(`${s.type}:${s.id}`);
      if (documento === null) {
        return Promise.resolve(null);
      }
      // Igual que la base: con una factura vigente o en proceso el documento figura como facturado.
      const invoiced =
        documento.invoiced ||
        [...filas.values()].some(
          (f) => f.sourceId === documento.id && f.record.status !== 'FAILED',
        );
      return Promise.resolve({ ...documento, invoiced });
    },
  };
  return {
    deps: { sources, issue: { provider, store: facturas, clock: fixedClock(AHORA) } },
    provider,
    buscadas,
    filas,
  };
}

const admin = { userId: luis, role: 'ADMIN' as const };

const entrada: IssueSystemInvoiceInput = {
  actor: admin,
  source: { type: 'COUNTER_SALE', id: 'venta-1' },
  requestId: 'solicitud-1',
  recipient: {
    rfc: ' xaxx 010101 000 ',
    name: ' CLIENTE   DE PRUEBA ',
    fiscalZip: '55900',
    regime: '616',
    cfdiUse: 'g03',
  },
};

describe('facturar desde el sistema', () => {
  it('un administrador factura una venta liquidada aunque ya haya pasado el plazo del portal', async () => {
    const { deps, provider } = entorno();
    const r = await issueSystemInvoice(deps, entrada);
    expect(r).toEqual({ kind: 'STAMPED', uuid: 'uuid-0001', folio: 'F-2026-0001' });
    expect(provider.stampedCount()).toBe(1);
  });

  it('puede usar cualquier uso de CFDI del catálogo, no solo los que ve el cliente del portal', async () => {
    const { deps } = entorno();
    const r = await issueSystemInvoice(deps, {
      ...entrada,
      recipient: { ...entrada.recipient, cfdiUse: 'G02' },
    });
    expect(r.kind).toBe('STAMPED');
  });

  it('un cajero sin autorización no factura y se le pide el PIN de un administrador', async () => {
    const { deps, provider, buscadas } = entorno();
    const r = await issueSystemInvoice(deps, { ...entrada, actor: { userId: ana, role: 'STAFF' } });
    expect(r).toEqual({ kind: 'AUTHORIZATION_REQUIRED' });
    expect(provider.stampedCount()).toBe(0);
    expect(buscadas).toEqual([]);
  });

  it('un cajero con la autorización de un administrador sí factura', async () => {
    const { deps } = entorno();
    const r = await issueSystemInvoice(deps, {
      ...entrada,
      actor: { userId: ana, role: 'STAFF' },
      authorization: { adminId: luis, authorizedAt: AHORA },
    });
    expect(r.kind).toBe('STAMPED');
  });

  it('sin rol nadie factura', async () => {
    const { deps } = entorno();
    const r = await issueSystemInvoice(deps, { ...entrada, actor: { userId: ana, role: null } });
    expect(r).toEqual({ kind: 'NOT_AUTHORIZED' });
  });

  it('una venta u orden que no existe se dice sin más', async () => {
    const { deps } = entorno(null);
    expect(await issueSystemInvoice(deps, entrada)).toEqual({ kind: 'NOT_FOUND' });
  });

  it('con saldo o cancelada no se factura, y cancelada pesa más', async () => {
    const saldo = entorno({ ...venta, paidCents: 5_000, settledAt: null });
    expect(await issueSystemInvoice(saldo.deps, entrada)).toEqual({
      kind: 'INELIGIBLE',
      reason: 'NOT_SETTLED',
    });
    const cancelada = entorno({ ...venta, cancelled: true });
    expect(await issueSystemInvoice(cancelada.deps, entrada)).toEqual({
      kind: 'INELIGIBLE',
      reason: 'CANCELLED',
    });
    expect(saldo.provider.stampedCount() + cancelada.provider.stampedCount()).toBe(0);
  });

  it('otra solicitud sobre una venta ya facturada se rechaza, pero reenviar la misma devuelve su factura', async () => {
    const { deps, provider } = entorno();
    const primera = await issueSystemInvoice(deps, entrada);
    expect(await issueSystemInvoice(deps, { ...entrada, requestId: 'solicitud-2' })).toEqual({
      kind: 'INELIGIBLE',
      reason: 'ALREADY_INVOICED',
    });
    expect(await issueSystemInvoice(deps, entrada)).toEqual(primera);
    expect(provider.stampedCount()).toBe(1);
  });

  it('un pago mixto exige que quien factura elija la forma de pago; no se supone ninguna [PD-28]', async () => {
    const { deps, provider } = entorno({ ...venta, paymentMethods: ['CASH', 'TRANSFER'] });
    expect(await issueSystemInvoice(deps, entrada)).toEqual({ kind: 'PAYMENT_FORM_REQUIRED' });
    expect(provider.stampedCount()).toBe(0);
    const elegida = await issueSystemInvoice(deps, { ...entrada, paymentForm: '03' });
    expect(elegida.kind).toBe('STAMPED');
  });

  it('con un pago puro la forma sale de cómo se pagó y la elección no la cambia', async () => {
    const { deps } = entorno({ ...venta, paymentMethods: ['TRANSFER'] });
    // Con transferencia pura la forma es 03 aunque se pida 01: si cambiara, el XML saldría con la forma pedida.
    const r = await issueSystemInvoice(deps, { ...entrada, paymentForm: '01' });
    expect(r.kind).toBe('STAMPED');
  });

  it('datos del receptor inválidos se rechazan antes de gastar un timbre y dicen cuáles', async () => {
    const { deps, provider } = entorno();
    const r = await issueSystemInvoice(deps, {
      ...entrada,
      recipient: { rfc: 'CORTO', name: ' ', fiscalZip: '12', regime: '999', cfdiUse: 'XX9' },
    });
    expect(r).toEqual({
      kind: 'INVALID',
      fields: [
        'recipient.rfc',
        'recipient.name',
        'recipient.fiscalZip',
        'recipient.regime',
        'recipient.cfdiUse',
      ],
    });
    expect(provider.stampedCount()).toBe(0);
  });

  it('con el ajuste de anticipos en la opción (b) una orden no se factura: no está construida [RN-27]', async () => {
    const orden = entorno({ ...venta, type: 'WORK_ORDER' });
    const entradaOrden = { ...entrada, source: { type: 'WORK_ORDER' as const, id: 'venta-1' } };
    expect(
      await issueSystemInvoice({ ...orden.deps, depositTreatment: 'b' }, entradaOrden),
    ).toEqual({
      kind: 'DEPOSIT_TREATMENT_UNSUPPORTED',
    });
    expect(orden.provider.stampedCount()).toBe(0);
    expect(
      (await issueSystemInvoice({ ...orden.deps, depositTreatment: 'a' }, entradaOrden)).kind,
    ).toBe('STAMPED');
    const mostrador = entorno();
    expect(
      (await issueSystemInvoice({ ...mostrador.deps, depositTreatment: 'b' }, entrada)).kind,
    ).toBe('STAMPED');
  });

  it('un catálogo sin claves del SAT no se factura', async () => {
    const { deps } = entorno({
      ...venta,
      lines: venta.lines.map((l) => ({ ...l, unitKey: null })),
    });
    expect(await issueSystemInvoice(deps, entrada)).toEqual({
      kind: 'NOT_BILLABLE',
      reason: 'FISCAL_DATA_MISSING',
    });
  });

  it('si el PAC no responde queda en proceso y reintentar con el mismo identificador termina sin duplicar', async () => {
    const { deps, provider } = entorno();
    provider.failNext('TIMEOUT', { afterStamping: true });
    expect(await issueSystemInvoice(deps, entrada)).toEqual({ kind: 'IN_PROCESS' });
    expect((await issueSystemInvoice(deps, entrada)).kind).toBe('STAMPED');
    expect(provider.stampedCount()).toBe(1);
  });

  it('un rechazo definitivo del PAC se avisa con su código', async () => {
    const { deps, provider } = entorno();
    provider.failNext('CANCELLATION_REJECTED');
    expect(await issueSystemInvoice(deps, entrada)).toEqual({
      kind: 'REJECTED',
      code: 'CANCELLATION_REJECTED',
    });
  });

  it('si la base de documentos falla responde que no está disponible', async () => {
    const { deps } = entorno();
    const roto = { ...deps, sources: { find: () => Promise.reject(new Error('base caída')) } };
    expect(await issueSystemInvoice(roto, entrada)).toEqual({ kind: 'UNAVAILABLE' });
  });

  it('busca el documento por su tipo y su identificador', async () => {
    const { deps, buscadas } = entorno();
    await issueSystemInvoice(deps, entrada);
    expect(buscadas).toEqual(['COUNTER_SALE:venta-1']);
  });
});

describe('receptor al facturar desde el sistema', () => {
  const bueno = {
    rfc: 'XAXX010101000',
    name: 'CLIENTE',
    fiscalZip: '55900',
    regime: '616',
    cfdiUse: 'G03',
  };

  it('acepta los datos completos y cualquier uso del catálogo', () => {
    expect(validateSystemRecipient(bueno)).toEqual([]);
    expect(validateSystemRecipient({ ...bueno, cfdiUse: 'CP01' })).toEqual([]);
  });

  it('marca cada campo que no vale', () => {
    expect(validateSystemRecipient({ ...bueno, rfc: 'x' })).toEqual(['recipient.rfc']);
    expect(validateSystemRecipient({ ...bueno, name: '' })).toEqual(['recipient.name']);
    expect(validateSystemRecipient({ ...bueno, fiscalZip: '1234' })).toEqual([
      'recipient.fiscalZip',
    ]);
    expect(validateSystemRecipient({ ...bueno, regime: '' })).toEqual(['recipient.regime']);
    expect(validateSystemRecipient({ ...bueno, cfdiUse: '' })).toEqual(['recipient.cfdiUse']);
  });
});
