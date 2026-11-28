import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import type { Money } from '../../../shared-kernel/money/money';
import { createPriceRegistry, defaultRules } from '../../catalog/domain/pricing/registry';
import {
  addLineExtra,
  buildQuoteLine,
  recalculateQuoteLine,
  removeLineExtra,
  repriceQuoteLine,
  type QuoteProduct,
} from './quote-line';

const registro = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) {
    throw new Error('registro');
  }
  return r.value;
})();
const deps = { registry: registro, taxRateBps: 1600 };

const pesos = (n: number) => n as Money;
const producto = (
  id: string,
  chargeUnit: QuoteProduct['chargeUnit'],
  precio: number,
  ruleId: string,
  ruleParams: unknown = {},
  kind = 'CUSTOM',
): QuoteProduct & { kind: string } => ({
  id: asId<'Product'>(id),
  name: id,
  chargeUnit,
  listPrice: pesos(precio),
  isTaxExempt: false,
  ruleId,
  ruleParams,
  kind,
});

const vidrio = producto('Vidrio claro 6 mm', 'SQUARE_METER', 28_000, 'AREA');
const canto = producto('Canto pulido', 'SQUARE_METER', 12_000, 'AREA', {}, 'EXTRA');
const cantoLineal = producto(
  'Canto lineal',
  'LINEAR_METER',
  5_000,
  'LINEAR',
  { basis: 'PERIMETER' },
  'EXTRA',
);
const perforacion = producto('Perforación', 'PIECE', 3_500, 'PIECE', {}, 'EXTRA');

function lineaDeVidrio(ancho = 1200, alto = 2000, cantidad = 1) {
  const r = buildQuoteLine(
    vidrio,
    { id: 'l1', widthMm: ancho, heightMm: alto, quantity: cantidad, displayUnit: 'cm' },
    deps,
  );
  if (!r.ok) {
    throw new Error('línea');
  }
  return r.value;
}

describe('cargos extra ligados a la línea [RF-M1-09, ADR-0044]', () => {
  it('caso de aceptación: vidrio de 1.20 × 2.00 m con canto pulido por m² y dos perforaciones', () => {
    const base = lineaDeVidrio();
    // Vidrio: 2.40 m² × $280.00 = $672.00.
    expect(base.lineTotalCents).toBe(67_200);
    const conCanto = addLineExtra(base, canto, 1, deps);
    if (!conCanto.ok) {
      throw new Error('canto');
    }
    // Canto: 2.40 m² × $120.00 = $288.00.
    const conTodo = addLineExtra(conCanto.value, perforacion, 2, deps);
    if (!conTodo.ok) {
      throw new Error('perforación');
    }
    // Perforaciones: 2 × $35.00 = $70.00. Total: 672 + 288 + 70 = $1,030.00.
    expect(conTodo.value.lineTotalCents).toBe(103_000);
    expect(conTodo.value.baseCents + conTodo.value.taxCents).toBe(103_000);
    expect(conTodo.value.extras?.map((e) => [e.name, e.amountCents])).toEqual([
      ['Canto pulido', 28_800],
      ['Perforación', 7_000],
    ]);
    expect(conTodo.value.detail).toMatch(/\+ Canto pulido: .*\$288\.00/);
    expect(conTodo.value.detail).toMatch(/\+ Perforación: 2 × \$35\.00 = \$70\.00/);
  });

  it('el canto por metro lineal usa el perímetro de la pieza', () => {
    const r = addLineExtra(lineaDeVidrio(), cantoLineal, 1, deps);
    // Perímetro 2 × (1.20 + 2.00) = 6.40 m × $50.00 = $320.00.
    expect(r.ok && r.value.extras?.[0]?.amountCents).toBe(32_000);
  });

  it('al cambiar medidas o cantidad, los extras se recalculan con la nueva medida', () => {
    const con = addLineExtra(lineaDeVidrio(), canto, 1, deps);
    if (!con.ok) {
      throw new Error('canto');
    }
    const doble = recalculateQuoteLine(con.value, { quantity: 2 }, deps);
    expect(doble.ok && doble.value.extras?.[0]?.amountCents).toBe(57_600);
    expect(doble.ok && doble.value.lineTotalCents).toBe(2 * 67_200 + 57_600);
  });

  it('un descuento con PIN baja solo el precio de la pieza, no el de los extras', () => {
    const con = addLineExtra(lineaDeVidrio(), canto, 1, deps);
    if (!con.ok) {
      throw new Error('canto');
    }
    const r = repriceQuoteLine(con.value, 25_000, deps);
    // 2.40 × $250.00 = $600.00 + canto $288.00.
    expect(r.ok && r.value.lineTotalCents).toBe(60_000 + 28_800);
  });

  it('agregar el mismo extra lo reemplaza, y quitarlo deja la línea como estaba', () => {
    const base = lineaDeVidrio();
    const una = addLineExtra(base, perforacion, 2, deps);
    if (!una.ok) {
      throw new Error('una');
    }
    const otra = addLineExtra(una.value, perforacion, 4, deps);
    expect(otra.ok && otra.value.extras).toHaveLength(1);
    expect(otra.ok && otra.value.extras?.[0]?.amountCents).toBe(14_000);
    const sin = removeLineExtra(otra.ok ? otra.value : base, perforacion.id, deps);
    expect(sin.ok && sin.value).toEqual(base);
  });

  it('una línea sin extras no trae la llave, y su detalle los separa con un espacio', () => {
    const base = lineaDeVidrio();
    expect('extras' in base).toBe(false);
    const con = addLineExtra(base, perforacion, 2, deps);
    expect(con.ok && con.value.detail).toBe(`${base.detail} + Perforación: 2 × $35.00 = $70.00`);
  });

  it('quitar un extra deja los demás', () => {
    const conCanto = addLineExtra(lineaDeVidrio(), canto, 1, deps);
    if (!conCanto.ok) throw new Error('canto');
    const conTodo = addLineExtra(conCanto.value, perforacion, 2, deps);
    if (!conTodo.ok) throw new Error('perforación');
    const sinPerforacion = removeLineExtra(conTodo.value, perforacion.id, deps);
    expect(sinPerforacion.ok && sinPerforacion.value.extras?.map((e) => e.name)).toEqual([
      'Canto pulido',
    ]);
    expect(sinPerforacion.ok && sinPerforacion.value.lineTotalCents).toBe(
      conCanto.value.lineTotalCents,
    );
  });

  it('no se agrega algo que no es un cargo extra, ni un extra por m² a una pieza sin medidas, ni cantidad 0', () => {
    expect(addLineExtra(lineaDeVidrio(), vidrio, 1, deps)).toEqual({
      ok: false,
      error: { code: 'EXTRA_INVALID' },
    });
    const pieza = buildQuoteLine(
      producto('Chapa', 'PIECE', 11_600, 'PIECE'),
      { id: 'p', widthMm: null, heightMm: null, quantity: 1, displayUnit: 'cm' },
      deps,
    );
    if (!pieza.ok) {
      throw new Error('pieza');
    }
    const invalido = { ok: false, error: { code: 'EXTRA_INVALID' } };
    expect(addLineExtra(pieza.value, canto, 1, deps)).toEqual(invalido);
    expect(addLineExtra(pieza.value, perforacion, 1, deps).ok).toBe(true);
    expect(addLineExtra(lineaDeVidrio(), perforacion, 0, deps)).toEqual(invalido);
    expect(addLineExtra(lineaDeVidrio(), perforacion, 1.5, deps)).toEqual(invalido);
  });

  it('en un perfil por largo (sin alto) cabe un extra por metro lineal, pero no uno por m²', () => {
    const perfil = buildQuoteLine(
      producto('Perfil', 'LINEAR_METER', 9_000, 'LINEAR', { basis: 'LENGTH' }),
      { id: 'pf', widthMm: 2000, heightMm: null, quantity: 1, displayUnit: 'cm' },
      deps,
    );
    if (!perfil.ok) {
      throw new Error('perfil');
    }
    const porLargo = producto(
      'Corte',
      'LINEAR_METER',
      1_000,
      'LINEAR',
      { basis: 'LENGTH' },
      'EXTRA',
    );
    expect(addLineExtra(perfil.value, porLargo, 1, deps).ok).toBe(true);
    expect(addLineExtra(perfil.value, canto, 1, deps)).toEqual({
      ok: false,
      error: { code: 'EXTRA_INVALID' },
    });
  });

  it('propiedad: la línea con extras es la pieza más la suma de los extras, al centavo, y base + IVA = total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 3_000 }),
        fc.integer({ min: 100, max: 3_000 }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 50_000 }),
        fc.integer({ min: 1, max: 10 }),
        (ancho, alto, cantidad, precioCanto, perforaciones) => {
          const base = lineaDeVidrio(ancho, alto, cantidad);
          const c = addLineExtra(base, { ...canto, listPrice: pesos(precioCanto) }, 1, deps);
          if (!c.ok) {
            throw new Error('canto');
          }
          const p = addLineExtra(c.value, perforacion, perforaciones, deps);
          if (!p.ok) {
            throw new Error('perforación');
          }
          const extras = (p.value.extras ?? []).reduce((t, e) => t + e.amountCents, 0);
          expect(p.value.lineTotalCents).toBe(base.lineTotalCents + extras);
          expect(p.value.baseCents + p.value.taxCents).toBe(p.value.lineTotalCents);
          expect(p.value.extras?.[1]?.amountCents).toBe(perforaciones * 3_500);
        },
      ),
    );
  });
});

describe('errores de la regla de precio en la línea', () => {
  const entrada = {
    id: 'l8',
    widthMm: 1000,
    heightMm: 1000,
    quantity: 1,
    displayUnit: 'cm',
  } as const;

  it('la regla que no existe, los parámetros malos y la medida que pasa del máximo llegan tal cual', () => {
    expect(buildQuoteLine(producto('X', 'SQUARE_METER', 100, 'NO_EXISTE'), entrada, deps)).toEqual({
      ok: false,
      error: { code: 'RULE_NOT_REGISTERED' },
    });
    expect(
      buildQuoteLine(producto('X', 'SQUARE_METER', 100, 'AREA', { minAreaMm2: -1 }), entrada, deps),
    ).toEqual({ ok: false, error: { code: 'PARAMS_INVALID' } });
    expect(
      buildQuoteLine(
        producto('X', 'SQUARE_METER', 100, 'AREA', { maxWidthMm: 999 }),
        entrada,
        deps,
      ),
    ).toEqual({ ok: false, error: { code: 'MEASURE_TOO_LARGE' } });
    expect(
      buildQuoteLine(
        producto('X', 'SQUARE_METER', 100, 'AREA'),
        { ...entrada, widthMm: null },
        deps,
      ),
    ).toEqual({ ok: false, error: { code: 'INPUT_INVALID' } });
  });

  it('el precio ajustado puede ser cero o igual al del catálogo, nunca negativo ni mayor', () => {
    const linea = lineaDeVidrio();
    expect(repriceQuoteLine(linea, 0, deps).ok).toBe(true);
    expect(repriceQuoteLine(linea, linea.catalogPriceCents, deps).ok).toBe(true);
    expect(repriceQuoteLine(linea, -1, deps).ok).toBe(false);
    expect(repriceQuoteLine(linea, linea.catalogPriceCents + 1, deps).ok).toBe(false);
  });
});

describe('unidad de venta [RF-M1-11]', () => {
  const felpa = {
    ...producto('Felpa', 'PIECE', 4_500, 'PIECE', {}, 'STANDARD'),
    saleUnitName: 'rollo',
  };
  const armar = (p: QuoteProduct, cantidad: number) => {
    const r = buildQuoteLine(
      p,
      { id: 'l7', widthMm: null, heightMm: null, quantity: cantidad, displayUnit: 'cm' },
      deps,
    );
    if (!r.ok) {
      throw new Error('línea');
    }
    return r.value;
  };

  it('la línea copia la unidad y el detalle la dice con la cantidad; el importe no cambia', () => {
    const dos = armar(felpa, 2);
    expect(dos.saleUnitName).toBe('rollo');
    expect(dos.detail).toBe('2 rollos × $45.00 = $90.00');
    expect(dos.lineTotalCents).toBe(9_000);
    expect(armar(felpa, 1).detail).toBe('1 rollo × $45.00 = $45.00');
  });

  it('sin unidad, la línea queda como antes', () => {
    const sin = armar(producto('Jaladera', 'PIECE', 4_500, 'PIECE', {}, 'STANDARD'), 2);
    expect('saleUnitName' in sin).toBe(false);
    expect(sin.detail).toBe('2 × $45.00 = $90.00');
  });

  it('al cambiar la cantidad o el precio se conserva la unidad', () => {
    const tres = recalculateQuoteLine(armar(felpa, 2), { quantity: 3 }, deps);
    expect(tres.ok && tres.value.detail).toBe('3 rollos × $45.00 = $135.00');
    const rebajada = repriceQuoteLine(armar(felpa, 2), 4_000, deps);
    expect(rebajada.ok && rebajada.value.detail).toBe('2 rollos × $40.00 = $80.00');
  });
});

describe('precio abierto [RF-M1-10, ADR-0048]', () => {
  const reparacion = {
    ...producto('Reparación de ventana', 'SERVICE', 50_000, 'SERVICE'),
    isOpenPrice: true,
  };
  const servicioFijo = producto('Visita', 'SERVICE', 50_000, 'SERVICE');
  const armar = (p: QuoteProduct) => {
    const r = buildQuoteLine(
      p,
      { id: 'l9', widthMm: null, heightMm: null, quantity: 2, displayUnit: 'cm' },
      deps,
    );
    if (!r.ok) {
      throw new Error('línea');
    }
    return r.value;
  };

  it('la línea de un producto con precio abierto lo recuerda; la de uno fijo no trae la marca', () => {
    expect(armar(reparacion).isOpenPrice).toBe(true);
    expect('isOpenPrice' in armar(servicioFijo)).toBe(false);
  });

  it('en un producto con precio abierto el precio puede quedar arriba de la referencia y recalcula', () => {
    const r = repriceQuoteLine(armar(reparacion), 80_000, deps);
    expect(r.ok && r.value.unitPriceCents).toBe(80_000);
    expect(r.ok && r.value.catalogPriceCents).toBe(50_000);
    expect(r.ok && r.value.lineTotalCents).toBe(160_000);
    expect(r.ok && r.value.isOpenPrice).toBe(true);
  });

  it('en un producto de precio fijo el precio nunca sube de la referencia', () => {
    const r = repriceQuoteLine(armar(servicioFijo), 50_001, deps);
    expect(!r.ok && r.error.code).toBe('PRICE_INVALID');
  });

  it('el precio abierto tampoco puede ser negativo ni fraccionario', () => {
    expect(repriceQuoteLine(armar(reparacion), -1, deps).ok).toBe(false);
    expect(repriceQuoteLine(armar(reparacion), 100.5, deps).ok).toBe(false);
  });

  it('al cambiar la cantidad se conserva el precio fijado y la marca', () => {
    const fijado = repriceQuoteLine(armar(reparacion), 80_000, deps);
    if (!fijado.ok) {
      throw new Error('precio');
    }
    const r = recalculateQuoteLine(fijado.value, { quantity: 3 }, deps);
    expect(r.ok && r.value.lineTotalCents).toBe(240_000);
    expect(r.ok && r.value.isOpenPrice).toBe(true);
  });
});
