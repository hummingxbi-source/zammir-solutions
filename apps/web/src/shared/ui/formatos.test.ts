import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { formatearFecha, formatearPesos, normalizarTelefono } from './formatos';

describe('formatearPesos', () => {
  it.each([
    [123_450, '$1,234.50'],
    [0, '$0.00'],
    [5, '$0.05'],
    [100, '$1.00'],
    [99_999_999_99, '$99,999,999.99'],
    [-250_00, '-$250.00'],
    [1_000_00, '$1,000.00'],
  ])('%d centavos se muestran como %s', (centavos, esperado) => {
    expect(formatearPesos(centavos)).toBe(esperado);
  });

  it('rechaza valores que no son enteros seguros', () => {
    expect(() => formatearPesos(1.5)).toThrow(RangeError);
    expect(() => formatearPesos(Number.NaN)).toThrow(RangeError);
    expect(() => formatearPesos(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it('siempre termina con dos decimales (propiedad)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }), (centavos) => {
        expect(formatearPesos(centavos)).toMatch(/^-?\$\d{1,3}(,\d{3})*\.\d{2}$/);
      }),
    );
  });
});

describe('formatearFecha', () => {
  it('muestra día, mes abreviado y año', () => {
    expect(formatearFecha(new Date('2026-10-27T18:00:00Z'))).toBe('27 oct 2026');
    expect(formatearFecha(new Date('2026-01-05T18:00:00Z'))).toBe('5 ene 2026');
  });

  it('usa la hora de México, sin importar la zona del equipo [RN-17]', () => {
    // 05:30 UTC del 27 es todavía el 26 a las 23:30 en la Ciudad de México.
    expect(formatearFecha(new Date('2026-10-27T05:30:00Z'))).toBe('26 oct 2026');
    // 06:30 UTC del 1 de enero es aún el 31 de diciembre en México.
    expect(formatearFecha(new Date('2027-01-01T05:30:00Z'))).toBe('31 dic 2026');
  });

  it('rechaza una fecha inválida', () => {
    expect(() => formatearFecha(new Date('no es una fecha'))).toThrow(RangeError);
  });
});

describe('normalizarTelefono', () => {
  it('acepta 10 dígitos con espacios, guiones o paréntesis', () => {
    expect(normalizarTelefono('5512345678')).toEqual({ ok: true, value: '5512345678' });
    expect(normalizarTelefono('(55) 1234-5678')).toEqual({ ok: true, value: '5512345678' });
    expect(normalizarTelefono('55 1234 5678')).toEqual({ ok: true, value: '5512345678' });
  });

  it.each(['', '551234567', '55123456789', 'abcdefghij', '55-1234-567a'])(
    'rechaza "%s"',
    (texto) => {
      expect(normalizarTelefono(texto)).toEqual({
        ok: false,
        error: 'TELEFONO_DEBE_TENER_10_DIGITOS',
      });
    },
  );
});
