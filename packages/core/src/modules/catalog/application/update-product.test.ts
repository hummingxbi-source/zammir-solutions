import { describe, expect, it, vi } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import { ok } from '../../../shared-kernel/result';
import { borradorDePrueba } from '../contracts/catalog.contract';
import { createPriceRegistry, defaultRules } from '../domain/pricing/registry';
import type { ProductAdmin } from './ports';
import { updateProduct } from './update-product';

const reglas = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) {
    throw new Error('registro');
  }
  return r.value;
})();

const id = asId<'Product'>('p-1');
const borrador = borradorDePrueba(asId<'Category'>('c-1'));

function admin() {
  const update = vi.fn((p: Parameters<ProductAdmin['update']>[0]) => Promise.resolve(ok(p)));
  const productos: ProductAdmin = {
    create: vi.fn(),
    update,
    priceHistory: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
  };
  return { productos, update };
}

describe('updateProduct', () => {
  it.each(['STAFF', 'DEVICE', null] as const)(
    '%s no puede editar el catálogo ni los precios',
    async (role) => {
      const { productos, update } = admin();
      const r = await updateProduct(
        { products: productos, priceRules: reglas },
        { role },
        id,
        borrador,
      );
      expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('un administrador guarda el producto validado con su identificador', async () => {
    const { productos, update } = admin();
    const r = await updateProduct(
      { products: productos, priceRules: reglas },
      { role: 'ADMIN' },
      id,
      { ...borrador, name: '  Nuevo nombre ' },
    );
    expect(r.ok && r.value).toEqual({ id, ...borrador, name: 'Nuevo nombre' });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('un cambio inválido no llega al almacén', async () => {
    const { productos, update } = admin();
    const r = await updateProduct(
      { products: productos, priceRules: reglas },
      { role: 'ADMIN' },
      id,
      { ...borrador, ruleParams: { descuento: 10 } },
    );
    expect(!r.ok && r.error.code).toBe('RULE_PARAMS_INVALID');
    expect(update).not.toHaveBeenCalled();
  });
});
