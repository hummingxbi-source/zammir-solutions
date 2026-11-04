import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { sequentialIdGenerator } from '../../../shared-kernel/id';
import { paymentFormFor } from '../domain/payment-form';
import { downloadPortalInvoice, type InvoiceFileStore } from './download-portal-invoice';
import type { InvoiceRecord, InvoiceRequestStore } from './issue-invoice';
import type { PortalDocumentRecord, PortalStore } from './portal-lookup';
import {
  normalizeRecipient,
  requestPortalInvoice,
  validatePortalRecipient,
  type RequestPortalInvoiceInput,
} from './request-portal-invoice';
import { simulatedBilling } from './simulated-billing';

const AHORA = new Date('2026-11-20T18:00:00.000Z');

const venta: PortalDocumentRecord = {
  id: 'venta-1',
  type: 'COUNTER_SALE',
  folio: 'V-2026-0001',
  cancelled: false,
  totalCents: 11_600,
  paidCents: 11_600,
  settledAt: '2026-11-03T18:00:00.000Z',
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

function entorno(documento: PortalDocumentRecord = venta) {
  const fallos: string[] = [];
  const filas = new Map<string, { record: InvoiceRecord; sourceId: string }>();
  const store: PortalStore = {
    // Igual que la base: con una factura vigente o en proceso, el documento figura como facturado.
    findDocument: (folio, code) =>
      Promise.resolve(
        code === 'BBBBBBBB' && folio === documento.folio
          ? {
              ...documento,
              invoiced:
                documento.invoiced ||
                [...filas.values()].some(
                  (f) => f.sourceId === documento.id && f.record.status !== 'FAILED',
                ),
            }
          : null,
      ),
    failureCounts: () => Promise.resolve({ ip: 0, folio: 0 }),
    recordFailure: (ip) => {
      fallos.push(ip);
      return Promise.resolve();
    },
  };
  const archivos = new Map<
    string,
    { folio: string; uuid: string; xml: string; pdfBase64: string }
  >();
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
      archivos.set(fila?.sourceId ?? '', {
        folio,
        uuid: e.uuid,
        xml: e.xml,
        pdfBase64: String(e.pdf.byteLength),
      });
      return Promise.resolve({ folio });
    },
    markFailed: () => Promise.resolve(),
  };
  const provider = simulatedBilling({
    clock: fixedClock(AHORA),
    idGenerator: sequentialIdGenerator('uuid'),
  });
  const files: InvoiceFileStore = {
    find: (source) => Promise.resolve(archivos.get(source.id) ?? null),
  };
  const deps = {
    store,
    clock: fixedClock(AHORA),
    hash: (t: string) => Promise.resolve(`h(${t})`),
    verifyHuman: () => Promise.resolve(true),
    issue: { provider, store: facturas, clock: fixedClock(AHORA) },
    files,
  };
  return { deps, provider, fallos, filas };
}

const bien: RequestPortalInvoiceInput = {
  folio: 'V-2026-0001',
  code: 'BBBBBBBB',
  ip: '203.0.113.7',
  honeypot: '',
  elapsedMs: 10_000,
  requestId: 'solicitud-1',
  acceptedPrivacy: true,
  recipient: {
    rfc: ' xaxx 010101 000 ',
    name: '  CLIENTE   DE PRUEBA ',
    fiscalZip: ' 55900 ',
    regime: '616',
    cfdiUse: 's01',
  },
};

describe('forma de pago según con qué se pagó [RN-28, PD-28]', () => {
  it('todo en efectivo es 01, todo por transferencia es 03', () => {
    expect(paymentFormFor(['CASH'])).toBe('01');
    expect(paymentFormFor(['TRANSFER'])).toBe('03');
    expect(paymentFormFor(['CASH', 'CASH'])).toBe('01');
  });

  it('un pago mixto o sin pagos queda sin definir hasta que el contador lo diga', () => {
    expect(paymentFormFor(['CASH', 'TRANSFER'])).toBeNull();
    expect(paymentFormFor([])).toBeNull();
  });
});

describe('datos del receptor', () => {
  it('se normalizan como los pide el SAT', () => {
    expect(normalizeRecipient(bien.recipient)).toEqual({
      rfc: 'XAXX010101000',
      name: 'CLIENTE DE PRUEBA',
      fiscalZip: '55900',
      regime: '616',
      cfdiUse: 'S01',
    });
  });

  it('se revisan formatos y catálogos, y se dice qué campos no valen', () => {
    const buena = normalizeRecipient(bien.recipient);
    expect(validatePortalRecipient(buena)).toEqual([]);
    expect(
      validatePortalRecipient({
        rfc: 'CORTO',
        name: '',
        fiscalZip: '123',
        regime: '999',
        cfdiUse: 'CP01',
      }),
    ).toEqual([
      'recipient.rfc',
      'recipient.name',
      'recipient.fiscalZip',
      'recipient.regime',
      'recipient.cfdiUse',
    ]);
  });
});

describe('pedir la factura desde el portal', () => {
  it('con todo en orden emite la factura y devuelve su folio', async () => {
    const { deps, provider } = entorno();
    const r = await requestPortalInvoice(deps, bien);
    expect(r).toEqual({ kind: 'STAMPED', uuid: 'uuid-0001', folio: 'F-2026-0001' });
    expect(provider.stampedCount()).toBe(1);
  });

  it('sin aceptar el aviso de privacidad no hace nada, ni siquiera busca el documento', async () => {
    const { deps, provider } = entorno();
    const r = await requestPortalInvoice(deps, { ...bien, acceptedPrivacy: false });
    expect(r).toEqual({ kind: 'PRIVACY_NOT_ACCEPTED' });
    expect(provider.stampedCount()).toBe(0);
  });

  it('un folio o código que no cuadran responden igual que en la consulta y no emiten nada', async () => {
    const { deps, provider } = entorno();
    expect(await requestPortalInvoice(deps, { ...bien, code: 'CCCCCCCC' })).toEqual({
      kind: 'NOT_AVAILABLE',
    });
    expect(provider.stampedCount()).toBe(0);
  });

  it('un programa (campo trampa lleno) no emite factura', async () => {
    const { deps, provider } = entorno();
    expect(await requestPortalInvoice(deps, { ...bien, honeypot: 'spam' })).toEqual({
      kind: 'NOT_AVAILABLE',
    });
    expect(provider.stampedCount()).toBe(0);
  });

  it('con saldo, vencida o ya facturada explica por qué y no emite', async () => {
    const { deps, provider } = entorno({ ...venta, paidCents: 5_000, settledAt: null });
    expect(await requestPortalInvoice(deps, bien)).toEqual({
      kind: 'INELIGIBLE',
      reason: 'NOT_SETTLED',
    });
    const vieja = entorno({ ...venta, settledAt: '2026-10-03T18:00:00.000Z' });
    expect(await requestPortalInvoice(vieja.deps, bien)).toEqual({
      kind: 'INELIGIBLE',
      reason: 'EXPIRED',
    });
    expect(provider.stampedCount()).toBe(0);
  });

  it('otra solicitud sobre una venta ya facturada se rechaza, pero reenviar la misma devuelve su factura', async () => {
    const { deps, provider } = entorno();
    const primera = await requestPortalInvoice(deps, bien);
    const otra = await requestPortalInvoice(deps, { ...bien, requestId: 'solicitud-2' });
    expect(otra).toEqual({ kind: 'INELIGIBLE', reason: 'ALREADY_INVOICED' });
    // Un doble toque o una red que se cayó al responder: la misma solicitud devuelve la misma factura.
    expect(await requestPortalInvoice(deps, bien)).toEqual(primera);
    expect(provider.stampedCount()).toBe(1);
  });

  it('los datos inválidos se avisan antes que el pago mixto, para que la persona los corrija', async () => {
    const { deps } = entorno({ ...venta, paymentMethods: ['CASH', 'TRANSFER'] });
    const r = await requestPortalInvoice(deps, {
      ...bien,
      recipient: { ...bien.recipient, rfc: 'CORTO' },
    });
    expect(r).toEqual({ kind: 'INVALID', fields: ['recipient.rfc'] });
  });

  it('un pago mixto no se factura solo: la forma de pago la define el contador', async () => {
    const { deps, provider } = entorno({ ...venta, paymentMethods: ['CASH', 'TRANSFER'] });
    expect(await requestPortalInvoice(deps, bien)).toEqual({ kind: 'PAYMENT_FORM_UNDEFINED' });
    expect(provider.stampedCount()).toBe(0);
  });

  it('datos fiscales inválidos se rechazan antes de gastar un timbre', async () => {
    const { deps, provider, filas } = entorno();
    const r = await requestPortalInvoice(deps, {
      ...bien,
      recipient: { ...bien.recipient, rfc: 'CORTO', regime: '999', cfdiUse: 'CP01' },
    });
    expect(r).toEqual({
      kind: 'INVALID',
      fields: ['recipient.rfc', 'recipient.regime', 'recipient.cfdiUse'],
    });
    expect(provider.stampedCount()).toBe(0);
    expect(filas.size).toBe(0);
  });

  it('un catálogo sin claves del SAT no se factura y no abre solicitud', async () => {
    const { deps, filas } = entorno({
      ...venta,
      lines: [{ ...(venta.lines[0] ?? venta.lines[0]!), productServiceKey: null }],
    });
    expect(await requestPortalInvoice(deps, bien)).toEqual({
      kind: 'NOT_BILLABLE',
      reason: 'FISCAL_DATA_MISSING',
    });
    expect(filas.size).toBe(0);
  });

  it('reenviar el formulario con el mismo identificador no duplica el timbre', async () => {
    const { deps, provider } = entorno();
    const a = await requestPortalInvoice(deps, bien);
    const b = await requestPortalInvoice(deps, bien);
    expect(a.kind).toBe('STAMPED');
    expect(b).toEqual(a);
    expect(provider.stampedCount()).toBe(1);
  });

  it('si el PAC no responde queda en proceso y reintentar con el mismo identificador termina sin duplicar', async () => {
    const { deps, provider } = entorno();
    provider.failNext('TIMEOUT', { afterStamping: true });
    expect(await requestPortalInvoice(deps, bien)).toEqual({ kind: 'IN_PROCESS' });
    expect((await requestPortalInvoice(deps, bien)).kind).toBe('STAMPED');
    expect(provider.stampedCount()).toBe(1);
  });
});

describe('descargar la factura', () => {
  it('con folio y código entrega el XML y el PDF de la factura emitida', async () => {
    const { deps } = entorno();
    await requestPortalInvoice(deps, bien);
    const xml = await downloadPortalInvoice(deps, bien, 'xml');
    expect(xml).toMatchObject({
      kind: 'FILE',
      filename: 'F-2026-0001.xml',
      contentType: 'application/xml',
      encoding: 'utf8',
    });
    expect(xml.kind === 'FILE' && xml.content).toContain('uuid-0001');
    const pdf = await downloadPortalInvoice(deps, bien, 'pdf');
    expect(pdf).toMatchObject({
      kind: 'FILE',
      filename: 'F-2026-0001.pdf',
      contentType: 'application/pdf',
      encoding: 'base64',
    });
  });

  it('si todavía no hay factura, o el código no cuadra, responde lo mismo', async () => {
    const { deps } = entorno();
    expect(await downloadPortalInvoice(deps, bien, 'xml')).toEqual({ kind: 'NOT_AVAILABLE' });
    await requestPortalInvoice(deps, bien);
    expect(await downloadPortalInvoice(deps, { ...bien, code: 'CCCCCCCC' }, 'xml')).toEqual({
      kind: 'NOT_AVAILABLE',
    });
  });

  it('un programa no baja archivos y la caída del almacén no revela detalles', async () => {
    const { deps } = entorno();
    expect(await downloadPortalInvoice(deps, { ...bien, honeypot: 'x' }, 'pdf')).toEqual({
      kind: 'NOT_AVAILABLE',
    });
    const roto = { ...deps, files: { find: () => Promise.reject(new Error('base caída')) } };
    expect(await downloadPortalInvoice(roto, bien, 'pdf')).toEqual({ kind: 'UNAVAILABLE' });
  });
});
