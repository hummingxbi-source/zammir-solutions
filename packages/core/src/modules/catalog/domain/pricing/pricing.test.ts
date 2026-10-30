import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Millimeters } from '../../../../shared-kernel/measure/length';
import { money, type Money } from '../../../../shared-kernel/money/money';
import { err, ok } from '../../../../shared-kernel/result';
import { formatPriceDetail } from './detail';
import { createPriceRegistry, defaultRules, type PriceRegistry } from './registry';
import type { PriceInput, PriceResult, PriceRule } from './types';

function m(centavos: number): Money {
  const r = money(centavos);
  if (!r.ok) {
    throw new Error(`centavos no válidos: ${String(centavos)}`);
  }
  return r.value;
}

/** Medida de prueba en mm; las medidas reales salen de `parseLength`. */
function mm(valor: number): Millimeters {
  return valor as Millimeters;
}

function registro(): PriceRegistry {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) {
    throw new Error('el registro por omisión debe armarse');
  }
  return r.value;
}

function entrada(cambios: Partial<PriceInput> & { precio: number }): PriceInput {
  const { precio, ...resto } = cambios;
  return {
    unitPrice: m(precio),
    widthMm: null,
    heightMm: null,
    quantity: 1,
    displayUnit: 'm',
    ...resto,
  };
}

function calcular(regla: string, parametros: unknown, e: PriceInput): PriceResult {
  const r = registro().calculate(regla, parametros, e);
  if (!r.ok) {
    throw new Error(`se esperaba un importe: ${r.error.code}`);
  }
  return r.value;
}

function error(regla: string, parametros: unknown, e: PriceInput): string {
  const r = registro().calculate(regla, parametros, e);
  return r.ok ? 'sin error' : r.error.code;
}

describe('regla por m² (AREA)', () => {
  it('1.20 m × 0.80 m a $280.00 da $268.80 y el detalle lo explica', () => {
    const r = calcular(
      'AREA',
      {},
      entrada({ precio: 28_000, widthMm: mm(1200), heightMm: mm(800) }),
    );
    expect(r.amount).toBe(26_880);
    expect(formatPriceDetail(r)).toBe('1.20 m × 0.80 m = 0.96 m² × $280.00 = $268.80');
  });

  it.each([
    ['L1', 85_000, 1000, 1500, 1, 127_500],
    ['L2', 92_000, 835, 1213, 3, 279_548],
    ['L3 (mitad de centavo sube)', 10_001, 500, 1000, 1, 5001],
  ])(
    '%s da el importe de la tabla de casos de oro',
    (_caso, precio, ancho, alto, cantidad, esperado) => {
      const r = calcular(
        'AREA',
        {},
        entrada({ precio, widthMm: mm(ancho), heightMm: mm(alto), quantity: cantidad }),
      );
      expect(r.amount).toBe(esperado);
      expect(r.adjustments).toEqual([]);
    },
  );

  it('el detalle en centímetros y con varias piezas muestra el área total exacta', () => {
    const r = calcular(
      'AREA',
      {},
      entrada({
        precio: 92_000,
        widthMm: mm(835),
        heightMm: mm(1213),
        quantity: 3,
        displayUnit: 'cm',
      }),
    );
    expect(formatPriceDetail(r)).toBe('83.5 cm × 121.3 cm × 3 = 3.038565 m² × $920.00 = $2,795.48');
  });

  it('en centímetros enteros no pone decimales', () => {
    const r = calcular(
      'AREA',
      {},
      entrada({ precio: 85_000, widthMm: mm(1000), heightMm: mm(1500), displayUnit: 'cm' }),
    );
    expect(formatPriceDetail(r)).toBe('100 cm × 150 cm = 1.50 m² × $850.00 = $1,275.00');
  });

  it('con los ajustes apagados (null o ausentes) calcula igual que sin parámetros', () => {
    const e = entrada({ precio: 92_000, widthMm: mm(835), heightMm: mm(1213), quantity: 3 });
    const base = calcular('AREA', {}, e).amount;
    const apagados = {
      measureStepMm: null,
      minAreaMm2: null,
      minAmountCents: null,
    };
    expect(calcular('AREA', apagados, e).amount).toBe(base);
  });

  it('redondeo de medidas: sube cada medida al múltiplo del paso', () => {
    const e = entrada({ precio: 92_000, widthMm: mm(835), heightMm: mm(1213) });
    const r = calcular('AREA', { measureStepMm: 50 }, e);
    // 850 × 1250 = 1 062 500 mm² → 92 000 × 1.0625 = 97 750
    expect(r.amount).toBe(97_750);
    expect(r.adjustments).toEqual([{ kind: 'MEASURE_STEP', stepMm: 50 }]);
    expect(formatPriceDetail(r)).toContain('(medidas subidas a múltiplos de 50 mm)');
  });

  it('varias notas se separan con punto y coma', () => {
    const e = entrada({ precio: 10_000, widthMm: mm(120), heightMm: mm(120) });
    const r = calcular('AREA', { measureStepMm: 100, minAreaMm2: 500_000 }, e);
    expect(formatPriceDetail(r)).toBe(
      '0.20 m × 0.20 m = 0.50 m² × $100.00 = $50.00 (medidas subidas a múltiplos de 100 mm; área mínima 0.50 m²)',
    );
  });

  it('una medida que ya es múltiplo del paso no cambia', () => {
    const e = entrada({ precio: 10_000, widthMm: mm(1000), heightMm: mm(1500) });
    expect(calcular('AREA', { measureStepMm: 50 }, e).amount).toBe(15_000);
  });

  it('área mínima cobrable: si la pieza es menor se cobra la mínima', () => {
    const e = entrada({ precio: 10_000, widthMm: mm(500), heightMm: mm(500) });
    const r = calcular('AREA', { minAreaMm2: 500_000 }, e);
    expect(r.amount).toBe(5000);
    expect(r.adjustments).toEqual([{ kind: 'MIN_AREA', minAreaMm2: 500_000 }]);
    expect(formatPriceDetail(r)).toBe(
      '0.50 m × 0.50 m = 0.50 m² × $100.00 = $50.00 (área mínima 0.50 m²)',
    );
  });

  it('área mínima: una pieza igual o mayor a la mínima no se ajusta', () => {
    const igual = entrada({ precio: 10_000, widthMm: mm(500), heightMm: mm(1000) });
    expect(calcular('AREA', { minAreaMm2: 500_000 }, igual).adjustments).toEqual([]);
    const mayor = entrada({ precio: 10_000, widthMm: mm(1000), heightMm: mm(1000) });
    expect(calcular('AREA', { minAreaMm2: 500_000 }, mayor).amount).toBe(10_000);
  });

  it('mínimo por trabajo: si el importe queda por debajo se cobra el mínimo', () => {
    const e = entrada({ precio: 28_000, widthMm: mm(1200), heightMm: mm(800) });
    const r = calcular('AREA', { minAmountCents: 30_000 }, e);
    expect(r.amount).toBe(30_000);
    expect(formatPriceDetail(r)).toBe(
      '1.20 m × 0.80 m = 0.96 m² × $280.00 = $300.00 (calculado $268.80; mínimo del trabajo $300.00)',
    );
  });

  it('mínimo por trabajo: igual o mayor al calculado no se ajusta', () => {
    const e = entrada({ precio: 28_000, widthMm: mm(1200), heightMm: mm(800) });
    expect(calcular('AREA', { minAmountCents: 26_880 }, e).adjustments).toEqual([]);
    expect(calcular('AREA', { minAmountCents: 100 }, e).amount).toBe(26_880);
  });

  it('con los tres ajustes encendidos se aplican en orden: medidas, área, mínimo', () => {
    const e = entrada({ precio: 10_000, widthMm: mm(120), heightMm: mm(120) });
    const r = calcular(
      'AREA',
      { measureStepMm: 100, minAreaMm2: 500_000, minAmountCents: 9000 },
      e,
    );
    // 200 × 200 = 40 000 mm² < 500 000 → área 500 000 → $50.00 < mínimo $90.00
    expect(r.amount).toBe(9000);
    expect(r.adjustments.map((a) => a.kind)).toEqual(['MEASURE_STEP', 'MIN_AREA', 'MIN_AMOUNT']);
  });

  it('un precio en cero da cero', () => {
    const e = entrada({ precio: 0, widthMm: mm(1000), heightMm: mm(1000) });
    expect(calcular('AREA', {}, e).amount).toBe(0);
  });
});

describe('regla por metro lineal (LINEAR)', () => {
  it('largo capturado: $90.00 el metro, 2.50 m → $225.00', () => {
    const r = calcular('LINEAR', { basis: 'LENGTH' }, entrada({ precio: 9000, widthMm: mm(2500) }));
    expect(r.amount).toBe(22_500);
    expect(formatPriceDetail(r)).toBe('2.50 m × $90.00 = $225.00');
  });

  it('largo capturado con varias piezas', () => {
    const r = calcular(
      'LINEAR',
      { basis: 'LENGTH' },
      entrada({ precio: 9000, widthMm: mm(2500), quantity: 2 }),
    );
    expect(r.amount).toBe(45_000);
    expect(formatPriceDetail(r)).toBe('2.50 m × 2 = 5.00 m × $90.00 = $450.00');
  });

  it('perímetro: 2 × (1.00 m + 0.50 m) = 3.00 m → $270.00', () => {
    const r = calcular(
      'LINEAR',
      { basis: 'PERIMETER' },
      entrada({ precio: 9000, widthMm: mm(1000), heightMm: mm(500) }),
    );
    expect(r.amount).toBe(27_000);
    expect(formatPriceDetail(r)).toBe('2 × (1.00 m + 0.50 m) = 3.00 m × $90.00 = $270.00');
  });

  it('el largo capturado ignora la segunda medida', () => {
    const r = calcular(
      'LINEAR',
      { basis: 'LENGTH' },
      entrada({ precio: 9000, widthMm: mm(1000), heightMm: mm(500) }),
    );
    expect(r.amount).toBe(9000);
  });

  it('mitad de centavo sube: 1 centavo el metro × 0.5 m', () => {
    const r = calcular('LINEAR', { basis: 'LENGTH' }, entrada({ precio: 1, widthMm: mm(500) }));
    expect(r.amount).toBe(1);
  });

  it('redondeo de medidas y mínimo también valen en metro lineal', () => {
    const r = calcular(
      'LINEAR',
      { basis: 'PERIMETER', measureStepMm: 100, minAmountCents: 50_000 },
      entrada({ precio: 9000, widthMm: mm(910), heightMm: mm(410) }),
    );
    // 1 000 × 500 → perímetro 3 000 mm → $270.00 < mínimo $500.00
    expect(r.amount).toBe(50_000);
    expect(r.adjustments.map((a) => a.kind)).toEqual(['MEASURE_STEP', 'MIN_AMOUNT']);
  });

  it('largo capturado con redondeo de medida', () => {
    const r = calcular(
      'LINEAR',
      { basis: 'LENGTH', measureStepMm: 100 },
      entrada({ precio: 9000, widthMm: mm(2410) }),
    );
    expect(r.amount).toBe(22_500);
  });

  it('la base es obligatoria y no tiene valor por omisión [PD-25]', () => {
    const e = entrada({ precio: 9000, widthMm: mm(1000), heightMm: mm(500) });
    expect(error('LINEAR', {}, e)).toBe('PARAMS_INVALID');
    expect(error('LINEAR', { basis: 'DIAGONAL' }, e)).toBe('PARAMS_INVALID');
  });

  it('exige las medidas que pide su base', () => {
    expect(error('LINEAR', { basis: 'LENGTH' }, entrada({ precio: 9000 }))).toBe('INPUT_INVALID');
    expect(
      error('LINEAR', { basis: 'PERIMETER' }, entrada({ precio: 9000, widthMm: mm(1000) })),
    ).toBe('INPUT_INVALID');
    expect(
      error('LINEAR', { basis: 'PERIMETER' }, entrada({ precio: 9000, heightMm: mm(1000) })),
    ).toBe('INPUT_INVALID');
  });
});

describe('reglas por pieza (PIECE) y de servicio (SERVICE)', () => {
  it('L4: 3 piezas estándar a $450.00 dan $1,350.00', () => {
    const r = calcular('PIECE', {}, entrada({ precio: 45_000, quantity: 3 }));
    expect(r.amount).toBe(135_000);
    expect(formatPriceDetail(r)).toBe('3 × $450.00 = $1,350.00');
  });

  it('servicio: 2 visitas a $350.00', () => {
    const r = calcular('SERVICE', {}, entrada({ precio: 35_000, quantity: 2 }));
    expect(r.amount).toBe(70_000);
    expect(formatPriceDetail(r)).toBe('2 × $350.00 = $700.00');
    expect(r.detail.kind).toBe('SERVICE');
  });

  it('no aceptan parámetros que no conocen', () => {
    expect(error('PIECE', { measureStepMm: 50 }, entrada({ precio: 100 }))).toBe('PARAMS_INVALID');
    expect(error('SERVICE', { x: 1 }, entrada({ precio: 100 }))).toBe('PARAMS_INVALID');
  });
});

describe('errores tipados', () => {
  const buena = entrada({ precio: 10_000, widthMm: mm(1000), heightMm: mm(1000) });

  it.each([
    ['cantidad cero', { quantity: 0 }],
    ['cantidad negativa', { quantity: -1 }],
    ['cantidad con fracción', { quantity: 1.5 }],
    ['precio negativo', { unitPrice: m(-1) }],
    ['ancho cero', { widthMm: mm(0) }],
    ['ancho con fracción', { widthMm: mm(10.5) }],
    ['alto negativo', { heightMm: mm(-5) }],
    ['alto con fracción', { heightMm: mm(0.5) }],
  ])('entrada inválida (%s) en toda regla', (_caso, cambio) => {
    for (const regla of ['AREA', 'PIECE', 'SERVICE']) {
      expect(error(regla, {}, { ...buena, ...cambio })).toBe('INPUT_INVALID');
    }
    expect(error('LINEAR', { basis: 'PERIMETER' }, { ...buena, ...cambio })).toBe('INPUT_INVALID');
  });

  it('el área necesita ancho y alto', () => {
    expect(error('AREA', {}, { ...buena, widthMm: null })).toBe('INPUT_INVALID');
    expect(error('AREA', {}, { ...buena, heightMm: null })).toBe('INPUT_INVALID');
  });

  it.each([
    ['paso en cero', { measureStepMm: 0 }],
    ['paso negativo', { measureStepMm: -5 }],
    ['paso con fracción', { measureStepMm: 2.5 }],
    ['paso en texto', { measureStepMm: '50' }],
    ['área mínima en cero', { minAreaMm2: 0 }],
    ['mínimo negativo', { minAmountCents: -1 }],
    ['mínimo con fracción', { minAmountCents: 10.5 }],
    ['parámetro desconocido', { descuento: 10 }],
    ['parámetros que no son un objeto', 'hola'],
    ['parámetros nulos', null],
  ])('parámetros inválidos (%s)', (_caso, parametros) => {
    expect(error('AREA', parametros, buena)).toBe('PARAMS_INVALID');
  });

  it('el importe que no cabe en un entero seguro se avisa', () => {
    const enorme = entrada({
      precio: Number.MAX_SAFE_INTEGER,
      widthMm: mm(1_000_000),
      heightMm: mm(1_000_000),
      quantity: 1000,
    });
    expect(error('AREA', {}, enorme)).toBe('OUT_OF_RANGE');
    expect(error('LINEAR', { basis: 'LENGTH' }, enorme)).toBe('OUT_OF_RANGE');
    expect(error('PIECE', {}, entrada({ precio: Number.MAX_SAFE_INTEGER, quantity: 2 }))).toBe(
      'OUT_OF_RANGE',
    );
    expect(error('SERVICE', {}, entrada({ precio: Number.MAX_SAFE_INTEGER, quantity: 2 }))).toBe(
      'OUT_OF_RANGE',
    );
  });
});

describe('registro de reglas', () => {
  it('una regla que no está registrada devuelve un error tipado', () => {
    expect(error('INEXISTENTE', {}, entrada({ precio: 100 }))).toBe('RULE_NOT_REGISTERED');
  });

  it('conoce las cuatro reglas de hoy', () => {
    const r = registro();
    for (const id of ['AREA', 'LINEAR', 'PIECE', 'SERVICE']) {
      expect(r.has(id)).toBe(true);
    }
    expect(r.has('FIJA')).toBe(false);
  });

  const reglaFija: PriceRule = {
    id: 'FIJA',
    calculate: (e) =>
      ok({
        amount: m(777),
        unitPrice: e.unitPrice,
        detail: { kind: 'SERVICE', quantity: 1 },
        adjustments: [],
      }),
  };

  it('registrar una regla nueva no modifica ninguna de las existentes', () => {
    const antes = registro();
    const e = entrada({ precio: 28_000, widthMm: mm(1200), heightMm: mm(800) });
    const importeAntes = antes.calculate('AREA', {}, e);

    const despues = antes.register(reglaFija);
    expect(despues.ok).toBe(true);
    if (!despues.ok) {
      return;
    }
    expect(despues.value.has('FIJA')).toBe(true);
    expect(despues.value.calculate('FIJA', {}, e)).toEqual(
      ok(expect.objectContaining({ amount: 777 })),
    );
    // El registro anterior no cambió y las reglas de siempre dan lo mismo.
    expect(antes.has('FIJA')).toBe(false);
    expect(despues.value.calculate('AREA', {}, e)).toEqual(importeAntes);
    for (const id of ['LINEAR', 'PIECE', 'SERVICE']) {
      expect(despues.value.has(id)).toBe(true);
    }
  });

  it('no se puede registrar dos veces el mismo identificador ni reemplazar una regla', () => {
    const repetida = registro().register({ ...reglaFija, id: 'AREA' });
    expect(!repetida.ok && repetida.error.code).toBe('RULE_ALREADY_REGISTERED');
    const doble = createPriceRegistry([reglaFija, reglaFija]);
    expect(!doble.ok && doble.error.code).toBe('RULE_ALREADY_REGISTERED');
  });

  it('una regla nueva puede devolver su propio error', () => {
    const rota: PriceRule = { id: 'ROTA', calculate: () => err({ code: 'PARAMS_INVALID' }) };
    const r = registro().register(rota);
    expect(r.ok && r.value.calculate('ROTA', {}, entrada({ precio: 1 }))).toEqual(
      err({ code: 'PARAMS_INVALID' }),
    );
  });
});

describe('propiedades', () => {
  it('por m²: el importe es el entero más cercano al exacto (error ≤ medio centavo)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.integer({ min: 1, max: 4000 }),
        fc.integer({ min: 1, max: 4000 }),
        fc.integer({ min: 1, max: 20 }),
        (precio, ancho, alto, cantidad) => {
          const r = calcular(
            'AREA',
            {},
            entrada({ precio, widthMm: mm(ancho), heightMm: mm(alto), quantity: cantidad }),
          );
          const exacto = BigInt(precio) * BigInt(ancho) * BigInt(alto) * BigInt(cantidad);
          const dos = exacto * 2n - BigInt(r.amount) * 2_000_000n;
          expect(dos >= -1_000_000n && dos <= 1_000_000n).toBe(true);
        },
      ),
    );
  });

  it('por pieza: precio × cantidad exacto', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 1, max: 500 }),
        (precio, cantidad) => {
          expect(calcular('PIECE', {}, entrada({ precio, quantity: cantidad })).amount).toBe(
            precio * cantidad,
          );
        },
      ),
    );
  });

  it('con mínimo encendido el importe nunca baja del mínimo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 3000 }),
        fc.integer({ min: 0, max: 5_000_000 }),
        (precio, lado, minimo) => {
          const r = calcular(
            'AREA',
            { minAmountCents: minimo },
            entrada({ precio, widthMm: mm(lado), heightMm: mm(lado) }),
          );
          expect(r.amount).toBeGreaterThanOrEqual(minimo);
        },
      ),
    );
  });
});
