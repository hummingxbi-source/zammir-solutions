import { describe, expect, it, vi } from 'vitest';

import { asId, sequentialIdGenerator } from '../../../shared-kernel/id';
import { ok } from '../../../shared-kernel/result';
import { borradorDePrueba } from '../contracts/catalog.contract';
import { createPriceRegistry, defaultRules } from '../domain/pricing/registry';
import type { ProductDraft } from '../domain/product';
import { createProduct } from './create-product';
import type { ProductAdmin } from './ports';

const reglas = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) {
    throw new Error('registro');
  }
  return r.value;
})();

const borrador: ProductDraft = borradorDePrueba(asId<'Category'>('c-1'));

function admin() {
  const create = vi.fn((p: Parameters<ProductAdmin['create']>[0]) => Promise.resolve(ok(p)));
  const productos: ProductAdmin = {
    create,
    createMany: vi.fn(),
    update: vi.fn(),
    priceHistory: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
  };
  return { productos, create };
}

describe('createProduct', () => {
  it.each(['STAFF', 'DEVICE', null] as const)('%s no puede dar de alta productos', async (role) => {
    const { productos, create } = admin();
    const r = await createProduct(
      { products: productos, idGenerator: sequentialIdGenerator('p'), priceRules: reglas },
      { role },
      borrador,
    );
    expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
    expect(create).not.toHaveBeenCalled();
  });

  it('un administrador da de alta un producto válido con identificador nuevo', async () => {
    const { productos, create } = admin();
    const r = await createProduct(
      { products: productos, idGenerator: sequentialIdGenerator('p'), priceRules: reglas },
      { role: 'ADMIN' },
      borrador,
    );
    expect(r.ok && r.value.id).toBe('p-0001');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('un producto inválido no llega al almacén', async () => {
    const { productos, create } = admin();
    const r = await createProduct(
      { products: productos, idGenerator: sequentialIdGenerator('p'), priceRules: reglas },
      { role: 'ADMIN' },
      { ...borrador, name: ' ' },
    );
    expect(!r.ok && r.error.code).toBe('NAME_REQUIRED');
    expect(create).not.toHaveBeenCalled();
  });
});
