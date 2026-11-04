import { describe, expect, it } from 'vitest';

import { parsePortalDocumentRow } from './portal-row';

const buena = {
  type: 'WORK_ORDER',
  id: 'e2000000-0000-0000-0000-000000000001',
  folio: 'OT-2026-0001',
  cancelled: false,
  totalCents: 100_000,
  paidCents: 100_000,
  settledAt: '2026-11-03T18:00:00.000Z',
  invoiced: false,
  paymentMethods: ['TRANSFER'],
  lines: [
    {
      name: 'Cancel de baño',
      quantity: 2,
      lineTotalCents: 100_000,
      baseCents: 86_207,
      taxCents: 13_793,
      productServiceKey: '01010101',
      unitKey: 'MTK',
      taxObject: '02',
    },
  ],
};

describe('lectura de lo que devuelve la base al portal', () => {
  it('acepta un documento completo', () => {
    expect(parsePortalDocumentRow(buena)).toEqual(buena);
  });

  it('acepta una orden aún sin fecha de liquidación', () => {
    expect(parsePortalDocumentRow({ ...buena, settledAt: null })?.settledAt).toBeNull();
  });

  it.each([
    ['nada', null],
    ['un texto', 'hola'],
    ['sin tipo válido', { ...buena, type: 'QUOTE' }],
    ['con un importe negativo', { ...buena, totalCents: -1 }],
    ['con centavos fraccionarios', { ...buena, paidCents: 10.5 }],
    ['sin conceptos en lista', { ...buena, lines: 'x' }],
    [
      'con un concepto sin cantidad',
      { ...buena, lines: [{ name: 'a', quantity: 0, lineTotalCents: 1 }] },
    ],
    ['sin el campo de facturada', { ...buena, invoiced: undefined }],
  ])('si viene %s, no hay documento', (_nombre, valor) => {
    expect(parsePortalDocumentRow(valor)).toBeNull();
  });
});
