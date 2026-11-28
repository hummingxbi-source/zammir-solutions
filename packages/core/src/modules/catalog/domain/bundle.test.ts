import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import {
  bundleChargeUnits,
  bundleNeedsMeasures,
  checkBundleItems,
  expandBundle,
  type BundleComponent,
} from './bundle';

const c = (
  id: string,
  kind: BundleComponent['kind'],
  chargeUnit: BundleComponent['chargeUnit'],
  isActive = true,
): BundleComponent => ({ id: asId<'Product'>(id), kind, chargeUnit, isActive });

const templado = c('templado', 'CUSTOM', 'SQUARE_METER');
const kit = c('kit', 'STANDARD', 'PIECE');
const tubo = c('tubo', 'CUSTOM', 'LINEAR_METER');
const instalacion = c('instalacion', 'SERVICE', 'SERVICE');
const catalogo = [templado, kit, tubo, instalacion];
const item = (p: BundleComponent, quantity = 1) => ({ productId: p.id, quantity });

describe('paquetes [RF-M1-18]', () => {
  it('se convierte en un renglón por componente, en su orden; las medidas van solo a lo que se mide', () => {
    const r = expandBundle(
      [item(templado), item(kit, 2), item(tubo), item(instalacion)],
      catalogo,
      {
        widthMm: 1200,
        heightMm: 1900,
        quantity: 1,
        displayUnit: 'cm',
      },
    );
    expect(
      r.ok &&
        r.value.map((l) => [l.product.id, l.input.widthMm, l.input.heightMm, l.input.quantity]),
    ).toEqual([
      ['templado', 1200, 1900, 1],
      ['kit', null, null, 2],
      ['tubo', 1200, 1900, 1],
      ['instalacion', null, null, 1],
    ]);
    expect(r.ok && r.value.every((l) => l.input.displayUnit === 'cm')).toBe(true);
  });

  it('con varios paquetes, la cantidad de cada componente se multiplica', () => {
    const r = expandBundle([item(templado), item(kit, 2)], catalogo, {
      widthMm: 1000,
      heightMm: 1000,
      quantity: 3,
      displayUnit: 'm',
    });
    expect(r.ok && r.value.map((l) => l.input.quantity)).toEqual([3, 6]);
  });

  it('dice cómo se cobra cada componente que está en el catálogo', () => {
    expect(
      bundleChargeUnits(
        [item(templado), item(kit), { productId: asId<'Product'>('no'), quantity: 1 }],
        catalogo,
      ),
    ).toEqual(['SQUARE_METER', 'PIECE']);
  });

  it('pide medidas solo si algún componente se cobra por m² o metro lineal', () => {
    expect(bundleNeedsMeasures([item(templado), item(kit)], catalogo)).toBe(true);
    expect(bundleNeedsMeasures([item(tubo)], catalogo)).toBe(true);
    expect(bundleNeedsMeasures([item(kit), item(instalacion)], catalogo)).toBe(false);
    expect(bundleNeedsMeasures([{ productId: asId<'Product'>('no'), quantity: 1 }], catalogo)).toBe(
      false,
    );
  });

  it('un componente que falta, o que es paquete, cargo extra o está desactivado, no deja armarlo', () => {
    const entrada = { widthMm: null, heightMm: null, quantity: 1, displayUnit: 'cm' } as const;
    expect(
      expandBundle([{ productId: asId<'Product'>('no'), quantity: 1 }], catalogo, entrada),
    ).toEqual({
      ok: false,
      error: { code: 'BUNDLE_COMPONENT_NOT_FOUND' },
    });
    for (const malo of [
      c('otro-paquete', 'BUNDLE', 'PIECE'),
      c('canto', 'EXTRA', 'SQUARE_METER'),
      c('viejo', 'STANDARD', 'PIECE', false),
    ]) {
      expect(checkBundleItems([item(malo)], [...catalogo, malo])).toEqual({
        ok: false,
        error: { code: 'BUNDLE_COMPONENT_NOT_ALLOWED' },
      });
    }
    // Sin la marca de activo (como en la tablet, que solo baja lo que se vende), se toma como activo.
    const enTablet = { id: kit.id, kind: kit.kind, chargeUnit: kit.chargeUnit };
    expect(checkBundleItems([item(kit)], [enTablet])).toEqual({ ok: true, value: null });
  });

  it('una cantidad de paquetes que no es entera positiva, o que desborda, no se acepta', () => {
    const base = { widthMm: null, heightMm: null, displayUnit: 'cm' } as const;
    for (const quantity of [0, -1, 1.5]) {
      expect(expandBundle([item(kit)], catalogo, { ...base, quantity })).toEqual({
        ok: false,
        error: { code: 'BUNDLE_INPUT_INVALID' },
      });
    }
    expect(
      expandBundle([item(kit, Number.MAX_SAFE_INTEGER)], catalogo, { ...base, quantity: 2 }),
    ).toEqual({ ok: false, error: { code: 'BUNDLE_INPUT_INVALID' } });
  });
});
