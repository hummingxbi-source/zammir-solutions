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
    expect(addLineExtra(pieza.value, canto, 1, deps).ok).toBe(false);
    expect(addLineExtra(pieza.value, perforacion, 1, deps).ok).toBe(true);
    expect(addLineExtra(lineaDeVidrio(), perforacion, 0, deps).ok).toBe(false);
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
