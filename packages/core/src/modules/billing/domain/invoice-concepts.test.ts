import { describe, expect, it } from 'vitest';

import { validateStampRequest, unitValueMicros, type StampRequest } from './invoice';
import { buildInvoiceConcepts, type InvoiceSourceLine } from './invoice-concepts';

const linea = (c: Partial<InvoiceSourceLine> = {}): InvoiceSourceLine => ({
  name: 'Vidrio claro 6 mm',
  quantity: 2,
  baseCents: 50_000,
  taxCents: 8_000,
  lineTotalCents: 58_000,
  productServiceKey: '30171500',
  unitKey: 'MTK',
  taxObject: '02',
  ...c,
});

const receptor = {
  rfc: 'XAXX010101000',
  name: 'CLIENTE DE PRUEBA',
  fiscalZip: '55900',
  regime: '616',
  cfdiUse: 'S01',
};

describe('valor unitario en millonésimas de peso', () => {
  it('cantidad por valor unitario vuelve al importe aunque el precio por unidad no sea de centavos', () => {
    expect(unitValueMicros(50_000, 2)).toBe(250_000_000);
    // 3 piezas con $100.00 sin IVA: $33.333333 cada una.
    expect(unitValueMicros(10_000, 3)).toBe(33_333_333);
    expect(Math.round((3 * 33_333_333) / 10_000)).toBe(10_000);
  });

  it('cuadra para cualquier cantidad y cualquier importe razonables', () => {
    for (let cantidad = 1; cantidad <= 60; cantidad += 1) {
      for (const importe of [1, 99, 100, 101, 1_999, 10_000, 123_457, 9_999_999]) {
        const micros = unitValueMicros(importe, cantidad);
        expect(Math.round((cantidad * micros) / 10_000)).toBe(importe);
      }
    }
  });
});

describe('conceptos del CFDI a partir de las líneas', () => {
  it('arma un concepto por línea con el importe sin IVA, el IVA ya guardado y las claves del SAT', () => {
    const r = buildInvoiceConcepts([linea()]);
    expect(r).toEqual({
      ok: true,
      value: [
        {
          productServiceKey: '30171500',
          unitKey: 'MTK',
          description: 'Vidrio claro 6 mm',
          quantity: 2,
          unitValueMicros: 250_000_000,
          amountCents: 50_000,
          taxObject: '02',
          taxCents: 8_000,
        },
      ],
    });
  });

  it('lo que arma es una solicitud de timbrado válida', () => {
    const r = buildInvoiceConcepts([
      linea(),
      linea({
        name: 'Chapa',
        quantity: 3,
        baseCents: 10_000,
        taxCents: 1_600,
        lineTotalCents: 11_600,
      }),
    ]);
    if (!r.ok) {
      throw new Error('no armó');
    }
    const solicitud: StampRequest = {
      requestId: 'solicitud-1',
      paymentForm: '01',
      paymentMethod: 'PUE',
      recipient: receptor,
      concepts: r.value,
      issuedAt: new Date('2026-11-03T18:00:00.000Z'),
    };
    expect(validateStampRequest(solicitud).ok).toBe(true);
  });

  it('con cantidades con decimales la factura lleva la cantidad tal cual y sigue cuadrando [RF-M1-12]', () => {
    // 1.5 kg a $85.00 = $127.50 con IVA ($109.91 + $17.59) y 0.333 kg a $10.00 = $3.33 ($2.87 + $0.46).
    const r = buildInvoiceConcepts([
      linea({
        name: 'Vinil',
        quantity: 1.5,
        baseCents: 10_991,
        taxCents: 1_759,
        lineTotalCents: 12_750,
      }),
      linea({ name: 'Felpa', quantity: 0.333, baseCents: 287, taxCents: 46, lineTotalCents: 333 }),
    ]);
    if (!r.ok) throw new Error('no armó');
    expect(r.value.map((c) => c.quantity)).toEqual([1.5, 0.333]);
    const solicitud: StampRequest = {
      requestId: 'solicitud-2',
      paymentForm: '01',
      paymentMethod: 'PUE',
      recipient: receptor,
      concepts: r.value,
      issuedAt: new Date('2026-11-03T18:00:00.000Z'),
    };
    expect(validateStampRequest(solicitud).ok).toBe(true);
  });

  it('el valor unitario cuadra con cualquier cantidad de hasta 3 decimales razonable', () => {
    for (const milesimas of [1, 125, 333, 1_255, 1_500, 2_005, 9_999, 123_457, 9_999_999]) {
      const cantidad = milesimas / 1000;
      for (const importe of [1, 99, 101, 10_000, 123_457, 9_999_999]) {
        const micros = unitValueMicros(importe, cantidad);
        expect(Math.round((cantidad * micros) / 10_000)).toBe(importe);
      }
    }
  });

  it('un producto exento lleva objeto de impuesto 02 con IVA cero', () => {
    const r = buildInvoiceConcepts([
      linea({ taxCents: 0, lineTotalCents: 50_000, taxObject: '02' }),
    ]);
    expect(r.ok && r.value[0]?.taxCents).toBe(0);
    expect(r.ok && r.value[0]?.taxObject).toBe('02');
  });

  it('sin líneas no hay nada que facturar', () => {
    expect(buildInvoiceConcepts([])).toEqual({ ok: false, error: { code: 'NO_LINES' } });
  });

  it('nunca inventa claves: a la línea que le falten, no se factura y dice cuáles', () => {
    const r = buildInvoiceConcepts([
      linea(),
      linea({ productServiceKey: null }),
      linea({ unitKey: ' ' }),
      linea({ taxObject: null }),
      linea({ taxObject: '99' }),
      linea({ productServiceKey: '' }),
    ]);
    expect(r).toEqual({
      ok: false,
      error: { code: 'FISCAL_DATA_MISSING', positions: [2, 3, 4, 5, 6] },
    });
  });

  it('si base más IVA no da el total de la línea, no se factura', () => {
    const r = buildInvoiceConcepts([linea(), linea({ lineTotalCents: 58_001 })]);
    expect(r).toEqual({ ok: false, error: { code: 'LINE_TOTAL_MISMATCH', positions: [2] } });
  });
});
