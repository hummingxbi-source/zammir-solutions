import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import { money } from '../../../shared-kernel/money/money';
import { borradorDePrueba, productoDePrueba } from '../contracts/catalog.contract';
import { createPriceRegistry, defaultRules } from './pricing/registry';
import { buildProduct, type ProductDraft } from './product';

const reglas = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) {
    throw new Error('registro');
  }
  return r.value;
})();

const id = asId<'Product'>('p-1');
const completo = productoDePrueba(id, asId<'Category'>('c-1'));
const base: ProductDraft = borradorDePrueba(asId<'Category'>('c-1'));

function error(cambios: Partial<ProductDraft>): string {
  const r = buildProduct(id, { ...base, ...cambios }, reglas);
  return r.ok ? 'sin error' : r.error.code;
}

describe('buildProduct', () => {
  it('acepta un producto completo y le asigna el identificador', () => {
    const r = buildProduct(id, base, reglas);
    expect(r.ok && r.value).toEqual(completo);
  });

  it('quita espacios sobrantes del nombre y del código; un código en blanco queda vacío', () => {
    const r = buildProduct(id, { ...base, name: '  Espejo  ', code: '  ESP-1 ' }, reglas);
    expect(r.ok && [r.value.name, r.value.code]).toEqual(['Espejo', 'ESP-1']);
    const blanco = buildProduct(id, { ...base, code: '   ' }, reglas);
    expect(blanco.ok && blanco.value.code).toBeNull();
  });

  it('exige nombre', () => {
    expect(error({ name: '   ' })).toBe('NAME_REQUIRED');
  });

  it('no acepta precio negativo, pero sí cero', () => {
    const negativo = money(-1);
    const cero = money(0);
    if (negativo.ok && cero.ok) {
      expect(error({ listPrice: negativo.value })).toBe('PRICE_NEGATIVE');
      expect(error({ listPrice: cero.value })).toBe('sin error');
    }
  });

  it.each([
    ['servicio por m²', { kind: 'SERVICE', chargeUnit: 'SQUARE_METER' }],
    ['pieza estándar por m²', { kind: 'STANDARD', chargeUnit: 'SQUARE_METER' }],
    ['a medida por servicio', { kind: 'CUSTOM', chargeUnit: 'SERVICE' }],
  ] as const)('rechaza %s', (_caso, cambio) => {
    expect(error({ ...cambio, ruleId: 'PIECE' })).toBe('KIND_UNIT_MISMATCH');
  });

  it('la regla de precio debe corresponder a la unidad de cobro', () => {
    expect(error({ ruleId: 'PIECE' })).toBe('RULE_UNIT_MISMATCH');
    expect(error({ chargeUnit: 'LINEAR_METER' })).toBe('RULE_UNIT_MISMATCH');
  });

  it('la regla de precio debe estar registrada', () => {
    expect(error({ ruleId: 'INEXISTENTE' })).toBe('RULE_NOT_REGISTERED');
  });

  it('detecta parámetros de regla inválidos al guardar, no al cotizar', () => {
    expect(error({ ruleParams: { descuento: 10 } })).toBe('RULE_PARAMS_INVALID');
    expect(error({ chargeUnit: 'LINEAR_METER', ruleId: 'LINEAR', ruleParams: {} })).toBe(
      'RULE_PARAMS_INVALID',
    );
  });

  it('acepta un metro lineal con su base definida (PD-25)', () => {
    expect(
      error({
        chargeUnit: 'LINEAR_METER',
        ruleId: 'LINEAR',
        ruleParams: { basis: 'PERIMETER' },
      }),
    ).toBe('sin error');
  });

  it('pieza estándar y servicio con sus reglas', () => {
    expect(error({ kind: 'STANDARD', chargeUnit: 'PIECE', ruleId: 'PIECE', ruleParams: {} })).toBe(
      'sin error',
    );
    expect(
      error({ kind: 'SERVICE', chargeUnit: 'SERVICE', ruleId: 'SERVICE', ruleParams: {} }),
    ).toBe('sin error');
  });

  it.each([
    [{ productServiceKey: '1234', unitKey: 'MTK', taxObject: '02' }],
    [{ productServiceKey: '01010101', unitKey: 'metro', taxObject: '02' }],
    [{ productServiceKey: '01010101', unitKey: 'MTK', taxObject: '2' }],
  ])('rechaza datos fiscales con formato inválido %#', (fiscal) => {
    expect(error({ fiscal })).toBe('FISCAL_INVALID');
  });

  it('acepta datos fiscales vacíos (por definir, PD-29)', () => {
    expect(error({ fiscal: { productServiceKey: null, unitKey: null, taxObject: null } })).toBe(
      'sin error',
    );
  });

  it.each([0, -3, 1.5])('rechaza una garantía de %s meses', (meses) => {
    expect(error({ warrantyMonths: meses })).toBe('WARRANTY_INVALID');
  });
});
