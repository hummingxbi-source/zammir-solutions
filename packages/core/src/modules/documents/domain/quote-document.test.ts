import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import type { Quote, QuoteLine } from '../../quotes/domain/quote';
import { ROTULOS_DE_PRUEBA } from '../contracts/document-renderer.contract';
import { buildQuoteDocument, formatDate, formatPhone, splitConditions } from './quote-document';

function linea(total: number, base: number): QuoteLine {
  return {
    id: 'l',
    productId: null,
    name: 'Vidrio',
    chargeUnit: 'SQUARE_METER',
    unitPriceCents: 28_000,
    catalogPriceCents: 28_000,
    ruleId: 'AREA',
    ruleParams: {},
    widthMm: 1200,
    heightMm: 800,
    quantity: 2,
    displayUnit: 'cm',
    baseCents: base,
    taxCents: total - base,
    lineTotalCents: total,
    isTaxExempt: false,
    detail: '1.92 m²',
  };
}

const enviada: Quote = {
  id: asId<'Quote'>('q'),
  status: 'SENT',
  customerId: asId<'Customer'>('c'),
  siteAddress: null,
  lines: [linea(53_760, 46_345), linea(50_000, 43_103)],
  userId: asId<'User'>('u'),
  tempFolio: 'T1-0004',
  folio: null,
  publicCode: 'ABCD2345',
  issuedAt: '2026-10-31T05:30:00.000Z',
  validUntil: '2026-11-14',
  conditionsText: 'Uno.\n\n  Dos.  \nTres.',
  privacyNoticeVersion: 1,
  catalogVersion: 1,
  discountAuthorizedBy: null,
  syncStatus: 'SAVED_ON_TABLET',
  reviewReason: null,
  updatedAt: '2026-10-31T05:30:00.000Z',
};

const entrada = {
  customer: { name: 'Ana', phone: '5512345678' },
  business: { name: 'Vidriería', phone: null, address: null },
  privacyNotice: 'Aviso',
  defaultConditions: 'Por defecto',
  now: new Date('2026-11-05T12:00:00.000Z'),
  provisionalNote: 'Folio provisional',
  labels: ROTULOS_DE_PRUEBA,
};

describe('buildQuoteDocument', () => {
  it('los totales son los de la cotización: suma de sus líneas, al centavo', () => {
    const d = buildQuoteDocument({ ...entrada, quote: enviada });
    expect(d.subtotal).toBe('$894.48');
    expect(d.tax).toBe('$143.12');
    expect(d.total).toBe('$1,037.60');
    expect(d.lines.map((l) => l.amount)).toEqual(['$537.60', '$500.00']);
  });

  it('sin enviar muestra el folio provisional y la nota; ya enviada, el definitivo', () => {
    const sin = buildQuoteDocument({ ...entrada, quote: enviada });
    expect(sin.folioLabel).toBe('Folio provisional T1-0004');
    expect(sin.provisionalNote).toBe('Folio provisional');
    const con = buildQuoteDocument({ ...entrada, quote: { ...enviada, folio: 'COT-2026-0012' } });
    expect(con.folioLabel).toBe('COT-2026-0012');
    expect(con.provisionalNote).toBeNull();
  });

  it('la fecha de emisión es la de México, no la de UTC', () => {
    const d = buildQuoteDocument({ ...entrada, quote: enviada });
    expect(d.issuedDate).toBe('30 oct 2026');
    expect(d.validUntilDate).toBe('14 nov 2026');
  });

  it('un borrador no tiene folio, usa las condiciones por defecto y se marca como borrador', () => {
    const d = buildQuoteDocument({
      ...entrada,
      quote: {
        ...enviada,
        status: 'DRAFT',
        tempFolio: null,
        publicCode: null,
        issuedAt: null,
        validUntil: null,
        conditionsText: null,
      },
    });
    expect(d.folioLabel).toBe('');
    expect(d.isDraft).toBe(true);
    expect(d.conditions).toEqual(['Por defecto']);
    expect(d.issuedDate).toBe('5 nov 2026');
    expect(d.validUntilDate).toBe('');
  });

  it('las condiciones salen una por renglón, sin vacíos', () => {
    expect(buildQuoteDocument({ ...entrada, quote: enviada }).conditions).toEqual([
      'Uno.',
      'Dos.',
      'Tres.',
    ]);
    expect(splitConditions('')).toEqual([]);
  });
});

describe('formatos [RN-22]', () => {
  it.each([
    ['2026-10-27', '27 oct 2026'],
    ['2026-01-05', '5 ene 2026'],
    ['2026-12-31', '31 dic 2026'],
  ])('%s → %s', (f, e) => {
    expect(formatDate(f)).toBe(e);
  });

  it('el teléfono se lee en grupos', () => {
    expect(formatPhone('5512345678')).toBe('55 1234 5678');
  });
});
