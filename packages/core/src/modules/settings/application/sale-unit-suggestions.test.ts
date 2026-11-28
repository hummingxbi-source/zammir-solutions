import { describe, expect, it } from 'vitest';

import { SALE_UNIT_SUGGESTIONS } from '../../catalog/domain/sale-unit';
import {
  inMemorySaleUnitSuggestions,
  parseSaleUnitSuggestions,
  readSaleUnitSuggestions,
  saveSaleUnitSuggestions,
} from './sale-unit-suggestions';

describe('unidades de venta sugeridas [RF-M1-11, PP-40]', () => {
  it('una por renglón, sin espacios, sin vacíos y sin repetir aunque cambien las mayúsculas', () => {
    expect(parseSaleUnitSuggestions(' rollo \n\nkilo\r\nRollo\npar\n')).toEqual([
      'rollo',
      'kilo',
      'par',
    ]);
    expect(parseSaleUnitSuggestions('')).toEqual([]);
  });

  it('una unidad de más de 20 caracteres o más de 50 unidades no se aceptan', () => {
    expect(parseSaleUnitSuggestions('a'.repeat(20))).toEqual(['a'.repeat(20)]);
    expect(parseSaleUnitSuggestions('a'.repeat(21))).toBeNull();
    const cincuenta = Array.from({ length: 50 }, (_, i) => `u${String(i)}`).join('\n');
    expect(parseSaleUnitSuggestions(cincuenta)).toHaveLength(50);
    expect(parseSaleUnitSuggestions(`${cincuenta}\nextra`)).toBeNull();
  });

  it('lo que llega de la base se revisa', () => {
    expect(readSaleUnitSuggestions(['rollo', 'kilo'])).toEqual(['rollo', 'kilo']);
    expect(readSaleUnitSuggestions('rollo')).toBeNull();
    expect(readSaleUnitSuggestions(['rollo', 3])).toBeNull();
    expect(readSaleUnitSuggestions(null)).toBeNull();
  });

  it('solo un administrador la cambia, y se guarda ya limpia', async () => {
    const store = inMemorySaleUnitSuggestions();
    expect(store.current()).toEqual(SALE_UNIT_SUGGESTIONS);
    expect(await saveSaleUnitSuggestions(store, { role: 'STAFF' }, 'galón')).toEqual({
      ok: false,
      error: { code: 'NOT_AUTHORIZED' },
    });
    expect(await saveSaleUnitSuggestions(store, { role: 'ADMIN' }, 'a'.repeat(21))).toEqual({
      ok: false,
      error: { code: 'INVALID' },
    });
    expect(store.current()).toEqual(SALE_UNIT_SUGGESTIONS);
    const r = await saveSaleUnitSuggestions(store, { role: 'ADMIN' }, 'galón\n cartucho \ngalón');
    expect(r).toEqual({ ok: true, value: ['galón', 'cartucho'] });
    expect(store.current()).toEqual(['galón', 'cartucho']);
    expect(await store.read()).toEqual({ ok: true, value: ['galón', 'cartucho'] });
  });
});
