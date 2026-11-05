import { describe, expect, it } from 'vitest';

import { parseDepositTreatment, supportsDepositTreatment } from './deposit-treatment';

describe('tratamiento de anticipos [RN-27]', () => {
  it('la opción (a), o sin ajuste, factura una orden por el total al liquidar', () => {
    expect(supportsDepositTreatment('a', 'WORK_ORDER')).toBe(true);
    expect(supportsDepositTreatment(undefined, 'WORK_ORDER')).toBe(true);
  });

  it('la opción (b) no está construida: una orden no se factura con ella', () => {
    expect(supportsDepositTreatment('b', 'WORK_ORDER')).toBe(false);
  });

  it('una venta de mostrador no lleva anticipo: se factura con cualquier opción', () => {
    expect(supportsDepositTreatment('a', 'COUNTER_SALE')).toBe(true);
    expect(supportsDepositTreatment('b', 'COUNTER_SALE')).toBe(true);
  });

  it('el ajuste se lee como (a) salvo que diga (b)', () => {
    expect(parseDepositTreatment('b')).toBe('b');
    expect(parseDepositTreatment('a')).toBe('a');
    expect(parseDepositTreatment(null)).toBe('a');
    expect(parseDepositTreatment('c')).toBe('a');
    expect(parseDepositTreatment(undefined)).toBe('a');
  });
});
