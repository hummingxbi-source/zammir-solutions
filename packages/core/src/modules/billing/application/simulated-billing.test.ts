import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { sequentialIdGenerator } from '../../../shared-kernel/id';
import {
  billingProviderContract,
  SOLICITUD_DE_PRUEBA,
} from '../contracts/billing-provider.contract';
import {
  invoiceTotals,
  isRetryable,
  validateCancelRequest,
  validateStampRequest,
  type BillingErrorCode,
} from '../domain/invoice';
import { simulatedBilling } from './simulated-billing';

const nuevo = (opciones: { cancellationNeedsAcceptance?: boolean } = {}) =>
  simulatedBilling({
    clock: fixedClock(new Date('2026-11-03T18:00:00.000Z')),
    idGenerator: sequentialIdGenerator('uuid'),
    ...opciones,
  });

billingProviderContract('simulado', () => {
  const billing = nuevo();
  return {
    billing,
    stampedCount: () => billing.stampedCount(),
    failNextAfterStamping: (code) => {
      billing.failNext(code, { afterStamping: true });
    },
  };
});

describe('adaptador simulado de facturación', () => {
  it('una falla antes de timbrar no gasta timbre y la siguiente llamada ya funciona', async () => {
    const b = nuevo();
    b.failNext('PROVIDER_UNAVAILABLE');
    const falla = await b.stamp(SOLICITUD_DE_PRUEBA);
    expect(!falla.ok && falla.error.code).toBe('PROVIDER_UNAVAILABLE');
    expect(b.stampedCount()).toBe(0);
    expect((await b.stamp(SOLICITUD_DE_PRUEBA)).ok).toBe(true);
  });

  it.each(['cancel', 'getStatus', 'download'] as const)(
    'una falla inyectada también alcanza a %s',
    async (operacion) => {
      const b = nuevo();
      const f = await b.stamp(SOLICITUD_DE_PRUEBA);
      if (!f.ok) {
        throw new Error('no timbró');
      }
      b.failNext('TIMEOUT');
      const r =
        operacion === 'cancel'
          ? await b.cancel({ uuid: f.value.uuid, motive: '02' })
          : await b[operacion](f.value.uuid);
      expect(!r.ok && r.error.code).toBe('TIMEOUT');
    },
  );

  it('con aceptación del receptor la cancelación queda pendiente hasta que se resuelve', async () => {
    const b = nuevo({ cancellationNeedsAcceptance: true });
    const f = await b.stamp(SOLICITUD_DE_PRUEBA);
    if (!f.ok) {
      throw new Error('no timbró');
    }
    const c = await b.cancel({ uuid: f.value.uuid, motive: '02' });
    expect(c.ok && c.value.status).toBe('CANCELLATION_PENDING');
    b.resolveCancellation(f.value.uuid);
    const s = await b.getStatus(f.value.uuid);
    expect(s.ok && s.value).toBe('CANCELLED');
  });

  it('el XML lleva el RFC del receptor y el total con dos decimales', async () => {
    const b = nuevo();
    const f = await b.stamp(SOLICITUD_DE_PRUEBA);
    if (!f.ok) {
      throw new Error('no timbró');
    }
    const d = await b.download(f.value.uuid);
    expect(d.ok && d.value.xml).toContain('Rfc="XAXX010101000"');
    expect(d.ok && d.value.xml).toContain('Total="580.00"');
  });
});

describe('qué se puede reintentar', () => {
  it('solo cuando el PAC no respondió', () => {
    const codigos: readonly BillingErrorCode[] = [
      'INVALID_REQUEST',
      'NOT_FOUND',
      'ALREADY_CANCELLED',
      'CANCELLATION_REJECTED',
      'PROVIDER_UNAVAILABLE',
      'TIMEOUT',
    ];
    expect(codigos.filter(isRetryable)).toEqual(['PROVIDER_UNAVAILABLE', 'TIMEOUT']);
  });
});

describe('validación de la solicitud de timbrado', () => {
  const con = (cambios: Partial<typeof SOLICITUD_DE_PRUEBA>) => ({
    ...SOLICITUD_DE_PRUEBA,
    ...cambios,
  });
  const concepto = SOLICITUD_DE_PRUEBA.concepts[0];
  if (concepto === undefined) {
    throw new Error('concepto de prueba');
  }

  it('acepta la solicitud de prueba y un RFC de persona moral de 12 caracteres', () => {
    expect(validateStampRequest(SOLICITUD_DE_PRUEBA).ok).toBe(true);
    const moral = con({ recipient: { ...SOLICITUD_DE_PRUEBA.recipient, rfc: 'ABC010101AB1' } });
    expect(validateStampRequest(moral).ok).toBe(true);
  });

  it.each([
    ['sin conceptos', con({ concepts: [] }), ['concepts']],
    ['sin identificador de solicitud', con({ requestId: ' ' }), ['requestId']],
    [
      'receptor incompleto',
      con({
        recipient: { rfc: 'XAXX010101000', name: ' ', fiscalZip: '55900', regime: '', cfdiUse: '' },
      }),
      ['recipient.name', 'recipient.regime', 'recipient.cfdiUse'],
    ],
    [
      'claves y descripción vacías',
      con({ concepts: [{ ...concepto, productServiceKey: '', unitKey: '', description: '' }] }),
      ['concepts[0].productServiceKey', 'concepts[0].unitKey', 'concepts[0].description'],
    ],
    [
      'cantidad cero',
      con({ concepts: [{ ...concepto, quantity: 0 }] }),
      ['concepts[0].quantity', 'concepts[0].amountCents'],
    ],
    [
      'importe que no cuadra con cantidad por valor',
      con({ concepts: [{ ...concepto, amountCents: 49_999 }] }),
      ['concepts[0].amountCents'],
    ],
    [
      'centavos con decimales',
      con({ concepts: [{ ...concepto, unitValueMicros: 2_505_000.5, amountCents: 501 }] }),
      ['concepts[0].amountCents'],
    ],
    [
      'IVA en un concepto que no es objeto de impuesto',
      con({ concepts: [{ ...concepto, taxObject: '01' }] }),
      ['concepts[0].taxCents'],
    ],
  ])('rechaza %s', (_nombre, solicitud, campos) => {
    const r = validateStampRequest(solicitud);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.fields).toEqual(campos);
  });

  it('los valores de solo espacios cuentan como vacíos', () => {
    const r = validateStampRequest(
      con({
        requestId: '  ',
        recipient: { ...SOLICITUD_DE_PRUEBA.recipient, name: '  ', regime: '  ', cfdiUse: '  ' },
        concepts: [{ ...concepto, productServiceKey: '  ', unitKey: '  ', description: '  ' }],
      }),
    );
    expect(!r.ok && r.error.fields).toEqual([
      'requestId',
      'recipient.name',
      'recipient.regime',
      'recipient.cfdiUse',
      'concepts[0].productServiceKey',
      'concepts[0].unitKey',
      'concepts[0].description',
    ]);
  });

  it('una cantidad infinita no vale', () => {
    const r = validateStampRequest(con({ concepts: [{ ...concepto, quantity: Infinity }] }));
    expect(!r.ok && r.error.fields).toContain('concepts[0].quantity');
  });

  it('los totales suman subtotal, IVA y total en centavos', () => {
    expect(invoiceTotals(SOLICITUD_DE_PRUEBA.concepts)).toEqual({
      subtotalCents: 50_000,
      taxCents: 8_000,
      totalCents: 58_000,
    });
    expect(invoiceTotals([])).toEqual({ subtotalCents: 0, taxCents: 0, totalCents: 0 });
  });
});

describe('validación de la cancelación', () => {
  it('el motivo 01 exige sustituta y los demás no la admiten', () => {
    expect(validateCancelRequest({ uuid: 'u', motive: '01', substituteUuid: 's' }).ok).toBe(true);
    expect(validateCancelRequest({ uuid: 'u', motive: '01' }).ok).toBe(false);
    expect(validateCancelRequest({ uuid: 'u', motive: '01', substituteUuid: ' ' }).ok).toBe(false);
    expect(validateCancelRequest({ uuid: 'u', motive: '02' }).ok).toBe(true);
    expect(validateCancelRequest({ uuid: 'u', motive: '02', substituteUuid: 's' }).ok).toBe(false);
    expect(validateCancelRequest({ uuid: ' ', motive: '03' }).ok).toBe(false);
  });
});
