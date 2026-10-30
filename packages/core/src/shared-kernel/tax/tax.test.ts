import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { money, multiply, type Money } from '../money/money';
import { areaLineTotal, computeDeposit, splitDocumentTax, splitTax } from './tax';

const TASA = 1600; // 16 %, como la deja la migración de configuración
const ANTICIPO = 5000; // 50 %

function m(centavos: number): Money {
  const r = money(centavos);
  if (!r.ok) {
    throw new Error(`centavos no válidos en la prueba: ${String(centavos)}`);
  }
  return r.value;
}

function linea(precio: number, ancho: number, alto: number, cantidad: number): number {
  const r = areaLineTotal(m(precio), ancho, alto, cantidad);
  if (!r.ok) {
    throw new Error(`línea no válida: ${r.error.code}`);
  }
  return r.value;
}

function desglose(total: number, tasa = TASA, exento = false) {
  const r = splitTax(m(total), tasa, exento);
  if (!r.ok) {
    throw new Error(`desglose no válido: ${r.error.code}`);
  }
  return {
    base: r.value.base as number,
    tax: r.value.tax as number,
    total: r.value.total as number,
  };
}

// Tabla de docs/calidad/CASOS_DE_ORO_DINERO.md. Si el código y la tabla no coinciden, gana la tabla.
describe('casos de oro: líneas (L1 a L4)', () => {
  it('L1 pieza exacta', () => {
    expect(linea(85_000, 1000, 1500, 1)).toBe(127_500);
  });
  it('L2 medidas con fracción', () => {
    expect(linea(92_000, 835, 1213, 3)).toBe(279_548);
  });
  it('L3 mitad exacta de centavo: 5 000.5 sube a 5 001', () => {
    expect(linea(10_001, 500, 1000, 1)).toBe(5001);
  });
  it('L4 pieza estándar, 3 unidades: precio por pieza × cantidad', () => {
    const r = multiply(m(45_000), 3);
    expect(r.ok && r.value).toBe(135_000);
  });
});

describe('casos de oro: desglose de IVA por línea (T1 a T6)', () => {
  it.each([
    ['T1', 127_500, 109_914, 17_586],
    ['T2', 279_548, 240_990, 38_558],
    ['T3', 5001, 4311, 690],
    ['T4', 135_000, 116_379, 18_621],
    ['T6 mínimo', 1, 1, 0],
  ])('%s', (_caso, total, base, iva) => {
    expect(desglose(total)).toEqual({ base, tax: iva, total });
  });

  it('T5 exento: IVA cero y base igual al total', () => {
    expect(desglose(10_000, TASA, true)).toEqual({ base: 10_000, tax: 0, total: 10_000 });
  });
});

describe('casos de oro: documentos completos (D1 y D2)', () => {
  function documento(totales: number[]) {
    const r = splitDocumentTax(
      totales.map((t) => ({ total: m(t), exempt: false })),
      TASA,
    );
    if (!r.ok) {
      throw new Error(`documento no válido: ${r.error.code}`);
    }
    return r.value;
  }

  it('D1: siete líneas dan subtotal 61 237, IVA 9 799 y total 71 036', () => {
    const d = documento([10_037, 10_074, 10_111, 10_148, 10_185, 10_222, 10_259]);
    expect([d.base, d.tax, d.total]).toEqual([61_237, 9799, 71_036]);
    expect(d.lines.map((l) => [l.base, l.tax])).toEqual([
      [8653, 1384],
      [8684, 1390],
      [8716, 1395],
      [8748, 1400],
      [8780, 1405],
      [8812, 1410],
      [8844, 1415],
    ]);
  });

  it('D2: tres líneas de 5 centavos dan subtotal 12, IVA 3 y total 15', () => {
    const d = documento([5, 5, 5]);
    expect([d.base, d.tax, d.total]).toEqual([12, 3, 15]);
  });
});

describe('casos de oro: anticipo (A1 y A2)', () => {
  function anticipo(total: number, bps = ANTICIPO) {
    const r = computeDeposit(m(total), bps);
    if (!r.ok) {
      throw new Error(`anticipo no válido: ${r.error.code}`);
    }
    return { deposit: r.value.deposit as number, balance: r.value.balance as number };
  }

  it('A1 127 500 al 50 %: anticipo 63 750 y saldo 63 750', () => {
    expect(anticipo(127_500)).toEqual({ deposit: 63_750, balance: 63_750 });
  });

  it('A2 12 345 al 50 %: 6 172.5 sube a 6 173 y el saldo es la resta, 6 172', () => {
    expect(anticipo(12_345)).toEqual({ deposit: 6173, balance: 6172 });
  });

  it('0 % no pide anticipo y 100 % pide todo', () => {
    expect(anticipo(12_345, 0)).toEqual({ deposit: 0, balance: 12_345 });
    expect(anticipo(12_345, 10_000)).toEqual({ deposit: 12_345, balance: 0 });
  });

  it('un total en cero da anticipo cero', () => {
    expect(anticipo(0)).toEqual({ deposit: 0, balance: 0 });
  });

  it('un monto exacto no se redondea hacia arriba de más', () => {
    expect(anticipo(200)).toEqual({ deposit: 100, balance: 100 });
  });

  it('rechaza porcentajes fuera de 0 a 100 % o no enteros', () => {
    for (const bps of [-1, 10_001, 5000.5, Number.NaN]) {
      const r = computeDeposit(m(100), bps);
      expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
    }
  });

  it('rechaza un total negativo', () => {
    const r = computeDeposit(m(-1), ANTICIPO);
    expect(!r.ok && r.error.code).toBe('NEGATIVE_TOTAL');
  });
});

describe('areaLineTotal: validación', () => {
  it.each([
    ['ancho cero', 0, 1000, 1],
    ['ancho negativo', -1, 1000, 1],
    ['ancho con fracción', 10.5, 1000, 1],
    ['alto cero', 1000, 0, 1],
    ['alto negativo', 1000, -1, 1],
    ['alto con fracción', 1000, 10.5, 1],
    ['cantidad cero', 1000, 1000, 0],
    ['cantidad negativa', 1000, 1000, -2],
    ['cantidad con fracción', 1000, 1000, 1.5],
  ])('rechaza %s', (_caso, ancho, alto, cantidad) => {
    const r = areaLineTotal(m(1000), ancho, alto, cantidad);
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('rechaza un precio negativo', () => {
    const r = areaLineTotal(m(-1), 1000, 1000, 1);
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('un precio en cero da una línea en cero', () => {
    expect(linea(0, 1000, 1000, 1)).toBe(0);
  });

  it('cuando el importe no cabe en un entero seguro lo dice', () => {
    const r = areaLineTotal(m(Number.MAX_SAFE_INTEGER), 1_000_000, 1_000_000, 1000);
    expect(!r.ok && r.error.code).toBe('OUT_OF_RANGE');
  });

  it('calcula bien con números cuyo producto rebasa los flotantes', () => {
    // 9e15 × 1e6 × 1 / 1e6: el numerador (9e21) no cabe en un double sin perder dígitos.
    expect(linea(9_000_000_000_000_000, 1000, 1000, 1)).toBe(9_000_000_000_000_000);
  });

  it('redondea la mitad hacia arriba y no hacia el par', () => {
    // 0.5 → 1 ; 1.5 → 2 ; 2.5 → 3
    expect(linea(1, 500, 1000, 1)).toBe(1);
    expect(linea(3, 500, 1000, 1)).toBe(2);
    expect(linea(5, 500, 1000, 1)).toBe(3);
  });

  it('justo por debajo de la mitad baja', () => {
    expect(linea(10_000, 499, 1000, 1)).toBe(4990);
    expect(linea(1, 499, 1000, 1)).toBe(0);
  });
});

describe('splitTax: otras tasas, exentos y validación', () => {
  it('si no se dice que es exento, la línea lleva IVA', () => {
    const r = splitTax(m(11_600), TASA);
    expect(r.ok && r.value.tax).toBe(1600);
  });

  it('usa la tasa que se le da, sin tocar código', () => {
    // 8 % (frontera): 10 800 → base 10 000, IVA 800
    expect(desglose(10_800, 800)).toEqual({ base: 10_000, tax: 800, total: 10_800 });
    // 0 %: todo es base
    expect(desglose(5000, 0)).toEqual({ base: 5000, tax: 0, total: 5000 });
  });

  it('un total en cero se desglosa en ceros', () => {
    expect(desglose(0)).toEqual({ base: 0, tax: 0, total: 0 });
  });

  it('rechaza una tasa negativa o no entera', () => {
    for (const tasa of [-1, 1600.5, Number.NaN]) {
      const r = splitTax(m(100), tasa);
      expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
    }
  });

  it('rechaza un total negativo, también si es exento', () => {
    const gravado = splitTax(m(-100), TASA);
    expect(!gravado.ok && gravado.error.code).toBe('NEGATIVE_TOTAL');
    const exento = splitTax(m(-100), TASA, true);
    expect(!exento.ok && exento.error.code).toBe('NEGATIVE_TOTAL');
  });

  it('con el máximo seguro no pierde ni un centavo', () => {
    const d = desglose(Number.MAX_SAFE_INTEGER);
    expect(d.base + d.tax).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('splitDocumentTax', () => {
  it('mezcla de exentos y gravados: las sumas coinciden con el total', () => {
    const r = splitDocumentTax(
      [
        { total: m(11_600), exempt: false },
        { total: m(10_000), exempt: true },
        { total: m(5001), exempt: false },
      ],
      TASA,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.total).toBe(11_600 + 10_000 + 5001);
      expect((r.value.base as number) + (r.value.tax as number)).toBe(r.value.total);
      expect(r.value.lines[1]).toEqual({ base: 10_000, tax: 0, total: 10_000 });
      expect(r.value.tax).toBe(1600 + 0 + 690);
    }
  });

  it('un documento sin líneas da ceros', () => {
    const r = splitDocumentTax([], TASA);
    expect(r.ok && [r.value.base, r.value.tax, r.value.total]).toEqual([0, 0, 0]);
  });

  it('propaga el error de una línea', () => {
    const r = splitDocumentTax([{ total: m(-1), exempt: false }], TASA);
    expect(!r.ok && r.error.code).toBe('NEGATIVE_TOTAL');
  });

  it('propaga una tasa inválida', () => {
    const r = splitDocumentTax([{ total: m(100), exempt: false }], -5);
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
  });

  it('si el total del documento no cabe en un entero seguro lo dice', () => {
    const r = splitDocumentTax(
      [
        { total: m(Number.MAX_SAFE_INTEGER), exempt: false },
        { total: m(1), exempt: false },
      ],
      TASA,
    );
    expect(!r.ok && r.error.code).toBe('OUT_OF_RANGE');
  });
});

describe('propiedades', () => {
  const total = fc.integer({ min: 0, max: 1_000_000_000_000 });
  const tasa = fc.integer({ min: 0, max: 5000 });

  it('base + IVA = total, al centavo, para cualquier línea', () => {
    fc.assert(
      fc.property(total, tasa, fc.boolean(), (t, r, exento) => {
        const d = desglose(t, r, exento);
        expect(d.base + d.tax).toBe(t);
        expect(d.base).toBeGreaterThanOrEqual(0);
        expect(d.tax).toBeGreaterThanOrEqual(0);
        if (exento || r === 0) {
          expect(d.tax).toBe(0);
        }
      }),
    );
  });

  it('subtotal + IVA = total en un documento con cualquier mezcla de líneas', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ t: fc.integer({ min: 0, max: 100_000_000 }), e: fc.boolean() }), {
          maxLength: 30,
        }),
        tasa,
        (lineas, r) => {
          const doc = splitDocumentTax(
            lineas.map((l) => ({ total: m(l.t), exempt: l.e })),
            r,
          );
          expect(doc.ok).toBe(true);
          if (doc.ok) {
            expect((doc.value.base as number) + (doc.value.tax as number)).toBe(doc.value.total);
            expect(doc.value.total).toBe(lineas.reduce((a, l) => a + l.t, 0));
          }
        },
      ),
    );
  });

  it('la base es la entera más cercana al cociente exacto (error menor o igual a medio centavo)', () => {
    fc.assert(
      fc.property(total, (t) => {
        const d = desglose(t);
        // |base − t·100/116| ≤ 1/2  ⇔  |100·t − 116·base| ≤ 58 (en enteros)
        expect(Math.abs(10_000 * t - 11_600 * d.base)).toBeLessThanOrEqual(5800);
      }),
    );
  });

  it('anticipo + saldo = total, anticipo ≥ porcentaje exacto y menos de un centavo de más', () => {
    fc.assert(
      fc.property(total, fc.integer({ min: 0, max: 10_000 }), (t, bps) => {
        const r = computeDeposit(m(t), bps);
        expect(r.ok).toBe(true);
        if (r.ok) {
          const anticipo = r.value.deposit as number;
          expect(anticipo + (r.value.balance as number)).toBe(t);
          expect(anticipo * 10_000).toBeGreaterThanOrEqual(t * bps);
          expect(anticipo * 10_000 - t * bps).toBeLessThan(10_000);
        }
      }),
    );
  });

  it('el importe de una línea por área es el entero más cercano al exacto', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 1, max: 20 }),
        (precio, ancho, alto, cantidad) => {
          const importe = linea(precio, ancho, alto, cantidad);
          const exacto = BigInt(precio) * BigInt(ancho) * BigInt(alto) * BigInt(cantidad);
          const diferencia = exacto * 2n - BigInt(importe) * 2_000_000n;
          // |exacto − importe·1e6| ≤ 500 000  (medio centavo)
          expect(diferencia >= -1_000_000n && diferencia <= 1_000_000n).toBe(true);
        },
      ),
    );
  });
});
