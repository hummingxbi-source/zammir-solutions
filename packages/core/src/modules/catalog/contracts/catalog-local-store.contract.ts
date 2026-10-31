import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import { money, type Money } from '../../../shared-kernel/money/money';
import type { CatalogLocalStore, ReplicatedProduct } from '../application/replica';
import type { Category } from '../domain/product';

export function dineroDePrueba(centavos: number): Money {
  const r = money(centavos);
  if (!r.ok) {
    throw new Error('dinero de prueba inválido');
  }
  return r.value;
}

/** Un producto replicado de prueba. */
export function replicatedProduct(
  id: string,
  seq: number,
  extra: Partial<ReplicatedProduct> = {},
): ReplicatedProduct {
  return {
    id: asId<'Product'>(id),
    code: null,
    name: `Producto ${id}`,
    categoryId: asId<'Category'>('c-1'),
    kind: 'CUSTOM',
    chargeUnit: 'SQUARE_METER',
    listPrice: dineroDePrueba(10_000),
    isTaxExempt: false,
    ruleId: 'price.area',
    ruleParams: { merma: 0.1 },
    isActive: true,
    changeSeq: seq,
    ...extra,
  };
}

export function replicatedCategory(id: string, sortOrder: number): Category {
  return {
    id: asId<'Category'>(id),
    name: `Categoría ${id}`,
    sortOrder,
    fiscalDefaults: { productServiceKey: '01010101', unitKey: 'MTK', taxObject: '02' },
  };
}

/** Batería de contrato de CatalogLocalStore: la pasan la memoria y el almacén del navegador. */
export function catalogLocalStoreContract(
  nombre: string,
  crear: () => CatalogLocalStore | Promise<CatalogLocalStore>,
): void {
  describe(`contrato de CatalogLocalStore: ${nombre}`, () => {
    it('vacío: cursor en 0 y sin productos ni categorías', async () => {
      const s = await crear();
      expect(await s.cursor()).toBe(0);
      expect(await s.products()).toEqual([]);
      expect(await s.categories()).toEqual([]);
    });

    it('guarda productos tal cual y avanza el cursor al mayor número de cambio', async () => {
      const s = await crear();
      await s.applyProducts([replicatedProduct('a', 3), replicatedProduct('b', 7)]);
      expect(await s.cursor()).toBe(7);
      const guardados = await s.products();
      expect(guardados).toHaveLength(2);
      expect(guardados.find((p) => p.id === 'a')).toEqual(replicatedProduct('a', 3));
    });

    it('un cambio reemplaza al producto sin duplicarlo', async () => {
      const s = await crear();
      await s.applyProducts([replicatedProduct('a', 1)]);
      await s.applyProducts([replicatedProduct('a', 2, { listPrice: dineroDePrueba(12_500) })]);
      const guardados = await s.products();
      expect(guardados).toHaveLength(1);
      expect(guardados[0]?.listPrice).toBe(dineroDePrueba(12_500));
      expect(await s.cursor()).toBe(2);
    });

    it('el cursor nunca retrocede', async () => {
      const s = await crear();
      await s.applyProducts([replicatedProduct('a', 9)]);
      await s.applyProducts([replicatedProduct('b', 4)]);
      expect(await s.cursor()).toBe(9);
    });

    it('conserva los desactivados con su marca', async () => {
      const s = await crear();
      await s.applyProducts([replicatedProduct('a', 1, { isActive: false })]);
      expect((await s.products())[0]?.isActive).toBe(false);
    });

    it('reemplaza las categorías completas', async () => {
      const s = await crear();
      await s.replaceCategories([replicatedCategory('c-1', 1), replicatedCategory('c-2', 2)]);
      await s.replaceCategories([replicatedCategory('c-2', 2)]);
      expect((await s.categories()).map((c) => c.id)).toEqual(['c-2']);
    });
  });
}
