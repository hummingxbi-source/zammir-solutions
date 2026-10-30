import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { areaMm2, parseLength, type Millimeters } from './length';

const LIMITE = 10_000_000;

function mm(texto: string, unidad: 'cm' | 'm' = 'cm', limite = LIMITE): Millimeters {
  const r = parseLength(texto, unidad, limite);
  if (!r.ok) {
    throw new Error(`medida no válida en la prueba: ${texto} (${r.error.code})`);
  }
  return r.value;
}

describe('parseLength', () => {
  it.each([
    ['125.5', 'cm', 1255],
    ['1.255', 'm', 1255],
    ['125,5', 'cm', 1255],
    ['1,255', 'm', 1255],
    ['100', 'cm', 1000],
    ['1', 'm', 1000],
    ['0.1', 'cm', 1],
    ['0.001', 'm', 1],
    ['10.0', 'cm', 100],
    ['2.5', 'm', 2500],
    ['  83.5  ', 'cm', 835],
    ['007', 'cm', 70],
  ] as const)('%s %s → %i mm', (texto, unidad, esperado) => {
    expect(mm(texto, unidad)).toBe(esperado);
  });

  it('125.5 cm y 1.255 m son exactamente el mismo valor', () => {
    expect(mm('125.5', 'cm')).toBe(mm('1.255', 'm'));
  });

  it('no se equivoca con los números que en flotantes salen mal', () => {
    // 1.005 * 1000 = 1004.9999999999999 en flotantes
    expect(mm('1.005', 'm')).toBe(1005);
    // 4.35 * 100 = 434.99999999999994 en flotantes
    expect(mm('43.5', 'cm')).toBe(435);
  });

  it.each(['', '   ', 'abc', '12abc', '1.2.3', '.5', '5.', '1e3', '+5', '--5', '1 000'])(
    'rechaza "%s" por formato',
    (texto) => {
      const r = parseLength(texto, 'cm', LIMITE);
      expect(!r.ok && r.error.code).toBe('INVALID_FORMAT');
    },
  );

  it.each(['0', '0.0', '000', '-5', '-0.1', '-0'])('rechaza "%s" por no ser positiva', (texto) => {
    const r = parseLength(texto, 'cm', LIMITE);
    expect(!r.ok && r.error.code).toBe('NOT_POSITIVE');
  });

  it('rechaza más decimales de los que caben en un milímetro', () => {
    const cm = parseLength('125.55', 'cm', LIMITE);
    expect(!cm.ok && cm.error.code).toBe('SUB_MILLIMETER');
    const m = parseLength('1.2555', 'm', LIMITE);
    expect(!m.ok && m.error.code).toBe('SUB_MILLIMETER');
  });

  it('acepta justo el límite y rechaza un milímetro más', () => {
    expect(mm('1000', 'cm', 10_000)).toBe(10_000);
    const r = parseLength('1000.1', 'cm', 10_000);
    expect(!r.ok && r.error.code).toBe('TOO_LARGE');
  });

  it('rechaza números tan largos que no caben como enteros seguros', () => {
    const r = parseLength('9'.repeat(30), 'cm', Number.MAX_SAFE_INTEGER);
    expect(!r.ok && r.error.code).toBe('TOO_LARGE');
  });

  it('un número largo pero con ceros a la izquierda sí vale', () => {
    expect(mm('0000000000000000000012', 'cm')).toBe(120);
  });

  it('propiedad: cualquier cantidad de mm escrita en metros o en cm da los mismos mm', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9_999_999 }), (valor) => {
        const enMetros = `${String(Math.floor(valor / 1000))}.${String(valor % 1000).padStart(3, '0')}`;
        const enCm = `${String(Math.floor(valor / 10))}.${String(valor % 10)}`;
        expect(mm(enMetros, 'm')).toBe(valor);
        expect(mm(enCm, 'cm')).toBe(valor);
      }),
    );
  });
});

describe('areaMm2', () => {
  it('multiplica ancho por alto en mm² enteros', () => {
    const r = areaMm2(mm('100'), mm('150'));
    expect(r.ok && r.value).toBe(1_500_000);
  });

  it('pieza mínima: 1 mm × 1 mm', () => {
    const r = areaMm2(mm('0.1'), mm('0.1'));
    expect(r.ok && r.value).toBe(1);
  });

  it('pieza extrema pero válida: 10 m × 10 m', () => {
    const r = areaMm2(mm('10', 'm'), mm('10', 'm'));
    expect(r.ok && r.value).toBe(100_000_000);
  });

  it('si el área no cabe en un entero seguro lo dice', () => {
    const grande = mm('9'.repeat(8), 'cm', Number.MAX_SAFE_INTEGER);
    const r = areaMm2(grande, grande);
    expect(!r.ok && r.error.code).toBe('TOO_LARGE');
  });
});
