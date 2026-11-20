import { describe, expect, it } from 'vitest';

import {
  inMemoryAgingThreshold,
  MAX_AGING_THRESHOLD_DAYS,
  parseAgingThreshold,
  saveAgingThreshold,
} from './aging-threshold';

describe('umbral de antigüedad de las cuentas por cobrar', () => {
  it('acepta enteros de 1 a 365 y nada más', () => {
    expect(parseAgingThreshold('10')).toBe(10);
    expect(parseAgingThreshold(' 1 ')).toBe(1);
    expect(parseAgingThreshold(String(MAX_AGING_THRESHOLD_DAYS))).toBe(365);
    for (const malo of ['', '0', '366', '-3', '2.5', '1e2', 'diez', '1000', '10 días']) {
      expect(parseAgingThreshold(malo), malo).toBeNull();
    }
  });

  it('un administrador lo guarda', async () => {
    const tienda = inMemoryAgingThreshold(10);
    const r = await saveAgingThreshold(tienda, { role: 'ADMIN' }, '15');
    expect(r).toEqual({ ok: true, value: 15 });
    expect(tienda.current()).toBe(15);
  });

  it('quien no es administrador no lo cambia', async () => {
    const tienda = inMemoryAgingThreshold(10);
    for (const role of ['STAFF', null]) {
      const r = await saveAgingThreshold(tienda, { role }, '15');
      expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
    }
    expect(tienda.current()).toBe(10);
  });

  it('un valor inválido no se guarda', async () => {
    const tienda = inMemoryAgingThreshold(10);
    const r = await saveAgingThreshold(tienda, { role: 'ADMIN' }, '0');
    expect(!r.ok && r.error.code).toBe('INVALID');
    expect(tienda.current()).toBe(10);
  });
});
