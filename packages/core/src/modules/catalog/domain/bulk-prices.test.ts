import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import { money, type Money } from '../../../shared-kernel/money/money';
import { productoDePrueba } from '../contracts/catalog.contract';
import { parsePercent, previewCategoryPriceChange } from './bulk-prices';
import type { Product } from './product';

const pesos = (c: number): Money => {
  const r = money(c);
  if (!r.ok) throw new Error('monto');
  return r.value;
};
const herrajes = asId<'Category'>('c-herrajes');
const vidrios = asId<'Category'>('c-vidrios');
const producto = (id: string, precio: number, cambios: Partial<Product> = {}): Product => ({
  ...productoDePrueba(asId<'Product'>(id), herrajes),
  name: id,
  listPrice: pesos(precio),
  ...cambios,
});

describe('porcentaje escrito [RF-M1-15]', () => {
  it('entiende enteros, signo, hasta dos decimales y el signo de por ciento', () => {
    expect(parsePercent('8')).toEqual({ ok: true, value: 800 });
    expect(parsePercent('+8')).toEqual({ ok: true, value: 800 });
    expect(parsePercent(' -5 ')).toEqual({ ok: true, value: -500 });
    expect(parsePercent('2.5')).toEqual({ ok: true, value: 250 });
    expect(parsePercent('2.25 %')).toEqual({ ok: true, value: 225 });
    expect(parsePercent('1000')).toEqual({ ok: true, value: 100_000 });
    expect(parsePercent('-99.99')).toEqual({ ok: true, value: -9_999 });
  });

  it('cero, texto, tres decimales o fuera de los límites no se aceptan', () => {
    for (const t of ['0', '0.00', '', 'ocho', '2.255', '-100', '1000.01', '1,5', '8 %%']) {
      expect(parsePercent(t)).toEqual({ ok: false, error: { code: 'PERCENT_INVALID' } });
    }
  });
});

describe('vista previa por categoría [RF-M1-15, D3]', () => {
  const catalogo = [
    producto('Bisagra', 45_50),
    producto('Jaladera', 120_00),
    producto('Inactiva', 10_00, { isActive: false }),
    producto('Vidrio', 280_00, { categoryId: vidrios }),
  ];

  it('solo cambia los activos de la categoría, redondeado al peso hacia arriba por omisión', () => {
    const r = previewCategoryPriceChange(catalogo, herrajes, 800);
    expect(r.ok && r.value.map((c) => [c.product.name, c.oldPrice, c.newPrice])).toEqual([
      ['Bisagra', 45_50, 50_00],
      ['Jaladera', 120_00, 130_00],
    ]);
  });

  it('respeta el redondeo pedido', () => {
    const abajo = previewCategoryPriceChange(catalogo, herrajes, 800, 'DOWN');
    expect(abajo.ok && abajo.value.map((c) => c.newPrice)).toEqual([49_00, 129_00]);
    const cerca = previewCategoryPriceChange(catalogo, herrajes, -500, 'NEAREST');
    expect(cerca.ok && cerca.value.map((c) => c.newPrice)).toEqual([43_00, 114_00]);
  });

  it('deja fuera lo que no cambiaría, y si nada cambia lo dice', () => {
    const r = previewCategoryPriceChange(
      [producto('Cero', 0), producto('Uno', 100_00)],
      herrajes,
      1,
    );
    expect(r.ok && r.value.map((c) => c.product.name)).toEqual(['Uno']);
    expect(previewCategoryPriceChange([producto('Cero', 0)], herrajes, 800)).toEqual({
      ok: false,
      error: { code: 'NOTHING_TO_CHANGE' },
    });
    expect(previewCategoryPriceChange(catalogo, asId<'Category'>('vacía'), 800)).toEqual({
      ok: false,
      error: { code: 'NOTHING_TO_CHANGE' },
    });
  });

  it('un porcentaje cero, fraccionario o de más de -100 % no se acepta; un precio que desborda tampoco', () => {
    const invalido = { ok: false, error: { code: 'PERCENT_INVALID' } };
    expect(previewCategoryPriceChange(catalogo, herrajes, 0)).toEqual(invalido);
    expect(previewCategoryPriceChange(catalogo, herrajes, 1.5)).toEqual(invalido);
    expect(previewCategoryPriceChange(catalogo, herrajes, -10_001)).toEqual(invalido);
    expect(
      previewCategoryPriceChange([producto('Enorme', Number.MAX_SAFE_INTEGER)], herrajes, 800),
    ).toEqual({ ok: false, error: { code: 'AMOUNT_INVALID' } });
  });
});
