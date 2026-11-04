import { describe, expect, it } from 'vitest';

import { looksAutomated, MIN_HUMAN_FILL_MS } from './automation-signals';
import {
  DEFAULT_RATE_LIMIT,
  evaluateRateLimit,
  evaluateSelfInvoicing,
  normalizeFolio,
  normalizeVerificationCode,
  selfInvoicingDeadline,
  type SelfInvoicingSource,
} from './self-invoicing';

const AHORA = new Date('2026-11-20T18:00:00.000Z');

const fuente = (c: Partial<SelfInvoicingSource> = {}): SelfInvoicingSource => ({
  type: 'COUNTER_SALE',
  cancelled: false,
  totalCents: 11_600,
  paidCents: 11_600,
  settledAt: '2026-11-03T18:00:00.000Z',
  invoiced: false,
  ...c,
});

describe('lo que se teclea', () => {
  it('el folio acepta definitivos y provisionales, sin importar mayúsculas ni espacios', () => {
    expect(normalizeFolio(' ot-2026-0012 ')).toBe('OT-2026-0012');
    expect(normalizeFolio('v-2026-10000')).toBe('V-2026-10000');
    expect(normalizeFolio('t1-0004')).toBe('T1-0004');
    expect(normalizeFolio('COT-2026-0001')).toBeNull();
    expect(normalizeFolio('OT-26-1')).toBeNull();
    expect(normalizeFolio('')).toBeNull();
    expect(normalizeFolio('OT-2026-0001; drop table')).toBeNull();
  });

  it('el código se limpia de guiones y espacios y exige 8 caracteres sin 0 ni 1', () => {
    expect(normalizeVerificationCode('abcd-2345')).toBe('ABCD2345');
    expect(normalizeVerificationCode(' ab cd 2345 ')).toBe('ABCD2345');
    expect(normalizeVerificationCode('ABCD234')).toBeNull();
    expect(normalizeVerificationCode('ABCD23456')).toBeNull();
    expect(normalizeVerificationCode('ABCD0123')).toBeNull();
    expect(normalizeVerificationCode('ABCD1234')).toBeNull();
  });
});

describe('plazo de autofacturación [RN-26]', () => {
  it('es el último día del mes de la compra', () => {
    expect(selfInvoicingDeadline(new Date('2026-11-03T18:00:00.000Z'))).toBe('2026-11-30');
    expect(selfInvoicingDeadline(new Date('2026-02-10T18:00:00.000Z'))).toBe('2026-02-28');
    expect(selfInvoicingDeadline(new Date('2028-02-10T18:00:00.000Z'))).toBe('2028-02-29');
    expect(selfInvoicingDeadline(new Date('2026-12-31T18:00:00.000Z'))).toBe('2026-12-31');
  });

  it('el mes es el de México, no el de UTC', () => {
    // 1 dic 03:00 UTC todavía es 30 nov en México.
    expect(selfInvoicingDeadline(new Date('2026-12-01T03:00:00.000Z'))).toBe('2026-11-30');
    expect(selfInvoicingDeadline(new Date('2026-12-01T07:00:00.000Z'))).toBe('2026-12-31');
  });
});

describe('qué se puede autofacturar [RN-24, RN-25, RN-26]', () => {
  it('una venta liquidada, sin facturar y dentro del plazo sí', () => {
    const r = evaluateSelfInvoicing({ source: fuente(), now: AHORA });
    expect(r).toEqual({ ok: true, value: { deadline: '2026-11-30' } });
  });

  it('el último día del mes todavía se puede y al siguiente ya no', () => {
    const ultimo = new Date('2026-12-01T05:59:00.000Z'); // 30 nov 23:59 en México
    const siguiente = new Date('2026-12-01T06:00:00.000Z'); // 1 dic 00:00 en México
    expect(evaluateSelfInvoicing({ source: fuente(), now: ultimo }).ok).toBe(true);
    const r = evaluateSelfInvoicing({ source: fuente(), now: siguiente });
    expect(!r.ok && r.error).toBe('EXPIRED');
  });

  it('una orden con saldo no se factura', () => {
    const r = evaluateSelfInvoicing({
      source: fuente({ type: 'WORK_ORDER', paidCents: 5_000, settledAt: null }),
      now: AHORA,
    });
    expect(!r.ok && r.error).toBe('NOT_SETTLED');
  });

  it('pagada pero sin fecha de liquidación, o con fecha inválida, tampoco', () => {
    expect(evaluateSelfInvoicing({ source: fuente({ settledAt: null }), now: AHORA })).toEqual({
      ok: false,
      error: 'NOT_SETTLED',
    });
    expect(
      evaluateSelfInvoicing({ source: fuente({ settledAt: 'no-es-fecha' }), now: AHORA }),
    ).toEqual({ ok: false, error: 'NOT_SETTLED' });
  });

  it('con fecha de compra pero con un centavo de saldo todavía no se factura', () => {
    const r = evaluateSelfInvoicing({ source: fuente({ paidCents: 11_599 }), now: AHORA });
    expect(r).toEqual({ ok: false, error: 'NOT_SETTLED' });
    expect(evaluateSelfInvoicing({ source: fuente({ paidCents: 11_600 }), now: AHORA }).ok).toBe(
      true,
    );
  });

  it('una orden liquidada con un pago de más cuenta como liquidada', () => {
    const r = evaluateSelfInvoicing({ source: fuente({ paidCents: 20_000 }), now: AHORA });
    expect(r.ok).toBe(true);
  });

  it('cancelada y ya facturada se rechazan, y cancelada pesa más', () => {
    expect(evaluateSelfInvoicing({ source: fuente({ invoiced: true }), now: AHORA })).toEqual({
      ok: false,
      error: 'ALREADY_INVOICED',
    });
    expect(
      evaluateSelfInvoicing({ source: fuente({ cancelled: true, invoiced: true }), now: AHORA }),
    ).toEqual({ ok: false, error: 'CANCELLED' });
  });
});

describe('límite de intentos [RF-M10-11]', () => {
  it('permite mientras los fallos estén por debajo de los topes', () => {
    expect(evaluateRateLimit({ ip: 0, folio: 0 })).toEqual({ allowed: true });
    expect(
      evaluateRateLimit({
        ip: DEFAULT_RATE_LIMIT.maxFailuresPerIp - 1,
        folio: DEFAULT_RATE_LIMIT.maxFailuresPerFolio - 1,
      }),
    ).toEqual({ allowed: true });
  });

  it('bloquea al llegar al tope por folio y dice cuánto esperar', () => {
    expect(evaluateRateLimit({ ip: 0, folio: DEFAULT_RATE_LIMIT.maxFailuresPerFolio })).toEqual({
      allowed: false,
      scope: 'FOLIO',
      retryAfterSeconds: 900,
    });
  });

  it('bloquea al llegar al tope por IP, aunque ese folio no tenga fallos', () => {
    expect(evaluateRateLimit({ ip: DEFAULT_RATE_LIMIT.maxFailuresPerIp, folio: 0 })).toEqual({
      allowed: false,
      scope: 'IP',
      retryAfterSeconds: 900,
    });
  });

  it('con una política propia usa sus valores', () => {
    const p = { windowSeconds: 60, maxFailuresPerIp: 2, maxFailuresPerFolio: 1 };
    expect(evaluateRateLimit({ ip: 0, folio: 1 }, p)).toEqual({
      allowed: false,
      scope: 'FOLIO',
      retryAfterSeconds: 60,
    });
    expect(evaluateRateLimit({ ip: 2, folio: 0 }, p).allowed).toBe(false);
    expect(evaluateRateLimit({ ip: 1, folio: 0 }, p).allowed).toBe(true);
  });
});

describe('verificación ligera contra automatización', () => {
  it('una persona llena el formulario sin tocar el campo trampa y tardando un poco', () => {
    expect(looksAutomated({ honeypot: '', elapsedMs: MIN_HUMAN_FILL_MS })).toBe(false);
    expect(looksAutomated({ honeypot: null, elapsedMs: 20_000 })).toBe(false);
  });

  it('el campo trampa lleno, la prisa o la falta de datos delatan a un programa', () => {
    expect(looksAutomated({ honeypot: 'http://spam', elapsedMs: 20_000 })).toBe(true);
    expect(looksAutomated({ honeypot: '  ', elapsedMs: 20_000 })).toBe(false);
    expect(looksAutomated({ honeypot: '', elapsedMs: MIN_HUMAN_FILL_MS - 1 })).toBe(true);
    expect(looksAutomated({ honeypot: '', elapsedMs: null })).toBe(true);
    expect(looksAutomated({ honeypot: '', elapsedMs: undefined })).toBe(true);
    expect(looksAutomated({ honeypot: '', elapsedMs: Number.NaN })).toBe(true);
  });
});
