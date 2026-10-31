import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  checkTransition,
  displayStatus,
  QUOTE_TRANSITIONS,
  quoteTotals,
  validUntil,
  type QuoteLine,
  type QuoteStatus,
} from './quote';

const ESTADOS: readonly QuoteStatus[] = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'];

describe('transiciones de estado', () => {
  const validas: readonly (readonly [QuoteStatus, QuoteStatus])[] = [
    ['DRAFT', 'SENT'],
    ['SENT', 'ACCEPTED'],
    ['SENT', 'REJECTED'],
  ];

  it.each(validas)('%s → %s es válida', (de, a) => {
    expect(checkTransition(de, a)).toEqual({ ok: true, value: a });
  });

  it('las otras 13 combinaciones se rechazan con error tipado', () => {
    let rechazadas = 0;
    for (const de of ESTADOS) {
      for (const a of ESTADOS) {
        if (validas.some(([x, y]) => x === de && y === a)) {
          continue;
        }
        const r = checkTransition(de, a);
        expect(r).toEqual({ ok: false, error: { code: 'INVALID_TRANSITION', from: de, to: a } });
        rechazadas += 1;
      }
    }
    expect(rechazadas).toBe(13);
  });

  it('aceptada y rechazada son finales', () => {
    expect(QUOTE_TRANSITIONS.ACCEPTED).toEqual([]);
    expect(QUOTE_TRANSITIONS.REJECTED).toEqual([]);
  });
});

describe('validUntil', () => {
  it('suma los días a la fecha de emisión en hora de México', () => {
    expect(validUntil(new Date('2026-10-30T18:00:00.000Z'), 15)).toBe('2026-11-14');
  });

  it('emitir a las 23:30 en México (ya es el día siguiente en UTC) cuenta desde el día de México', () => {
    expect(validUntil(new Date('2026-10-31T05:30:00.000Z'), 15)).toBe('2026-11-14');
  });

  it('cruza el fin de año', () => {
    expect(validUntil(new Date('2026-12-25T18:00:00.000Z'), 15)).toBe('2027-01-09');
  });
});

describe('displayStatus (vencida se deriva del reloj)', () => {
  const enviada = { status: 'SENT' as const, validUntil: '2026-11-14' };

  it('hasta el último segundo del último día de vigencia (hora de México) sigue vigente', () => {
    // 2026-11-14 23:59:59 en México = 2026-11-15T05:59:59Z
    expect(displayStatus(enviada, new Date('2026-11-15T05:59:59.000Z'))).toBe('SENT');
  });

  it('un segundo después ya está vencida', () => {
    expect(displayStatus(enviada, new Date('2026-11-15T06:00:00.000Z'))).toBe('EXPIRED');
  });

  it('el día de la emisión y los intermedios están vigentes', () => {
    expect(displayStatus(enviada, new Date('2026-10-30T18:00:00.000Z'))).toBe('SENT');
    expect(displayStatus(enviada, new Date('2026-11-01T12:00:00.000Z'))).toBe('SENT');
  });

  it('solo las enviadas vencen: aceptada, rechazada y borrador conservan su estado', () => {
    const tarde = new Date('2027-06-01T12:00:00.000Z');
    expect(displayStatus({ status: 'ACCEPTED', validUntil: '2026-11-14' }, tarde)).toBe('ACCEPTED');
    expect(displayStatus({ status: 'REJECTED', validUntil: '2026-11-14' }, tarde)).toBe('REJECTED');
    expect(displayStatus({ status: 'DRAFT', validUntil: null }, tarde)).toBe('DRAFT');
  });

  it('una enviada sin vigencia registrada no vence', () => {
    expect(
      displayStatus({ status: 'SENT', validUntil: null }, new Date('2030-01-01T00:00:00.000Z')),
    ).toBe('SENT');
  });
});

function linea(base: number, iva: number): QuoteLine {
  return {
    id: 'l',
    productId: null,
    name: 'x',
    chargeUnit: 'PIECE',
    unitPriceCents: base + iva,
    catalogPriceCents: base + iva,
    ruleId: 'PIECE',
    ruleParams: {},
    widthMm: null,
    heightMm: null,
    quantity: 1,
    displayUnit: 'cm',
    baseCents: base,
    taxCents: iva,
    lineTotalCents: base + iva,
    isTaxExempt: false,
    detail: '',
  };
}

describe('quoteTotals', () => {
  it('sin líneas todo es cero', () => {
    expect(quoteTotals([])).toEqual({ subtotalCents: 0, taxCents: 0, totalCents: 0 });
  });

  it('suma bases e IVA línea por línea y el total es su suma', () => {
    expect(quoteTotals([linea(10_000, 1_600), linea(46_345, 7_415)])).toEqual({
      subtotalCents: 56_345,
      taxCents: 9_015,
      totalCents: 65_360,
    });
  });

  it('propiedad: el total siempre es subtotal + IVA y es la suma de los totales de las líneas', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 0, max: 200_000 })),
          {
            maxLength: 30,
          },
        ),
        (pares) => {
          const lineas = pares.map(([b, i]) => linea(b, i));
          const t = quoteTotals(lineas);
          return (
            t.totalCents === t.subtotalCents + t.taxCents &&
            t.totalCents === lineas.reduce((s, l) => s + l.lineTotalCents, 0)
          );
        },
      ),
    );
  });
});
