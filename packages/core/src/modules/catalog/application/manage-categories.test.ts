import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId, sequentialIdGenerator } from '../../../shared-kernel/id';
import { inMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { productoDePrueba } from '../contracts/catalog.contract';
import {
  buildCategory,
  categoryNameTaken,
  nextSortOrder,
  sortCategories,
} from '../domain/category';
import type { Category } from '../domain/product';
import { inMemoryCatalog } from './in-memory-catalog';
import { createCategory, moveCategory, updateCategory } from './manage-categories';

const admin = { role: 'ADMIN' as const };
const cajero = { role: 'STAFF' as const };
const fiscal = { productServiceKey: '01010101', unitKey: 'H87', taxObject: '02' };

function entorno() {
  const catalogo = inMemoryCatalog({
    idGenerator: sequentialIdGenerator('c'),
    clock: fixedClock(new Date('2026-11-25T12:00:00.000Z')),
    auditLog: inMemoryAuditLog(),
  });
  return {
    catalogo,
    deps: { categories: catalogo, products: catalogo, idGenerator: sequentialIdGenerator('n') },
  };
}

describe('dominio de categorías [RF-M1-08]', () => {
  const id = asId<'Category'>('x');
  const base = { name: 'Vitrales', sortOrder: 12, fiscalDefaults: fiscal, isActive: true };

  it('limpia el nombre y valida orden y claves', () => {
    expect(buildCategory(id, { ...base, name: '  Canceles   comerciales ' })).toMatchObject({
      ok: true,
      value: { name: 'Canceles comerciales' },
    });
    expect(buildCategory(id, { ...base, name: '   ' })).toEqual({
      ok: false,
      error: { code: 'INVALID_NAME' },
    });
    expect(buildCategory(id, { ...base, name: 'x'.repeat(61) }).ok).toBe(false);
    expect(buildCategory(id, { ...base, sortOrder: 0 }).ok).toBe(false);
    expect(buildCategory(id, { ...base, sortOrder: 1.5 }).ok).toBe(false);
    expect(buildCategory(id, { ...base, fiscalDefaults: { ...fiscal, unitKey: 'metro' } })).toEqual(
      { ok: false, error: { code: 'INVALID_FISCAL' } },
    );
  });

  it('un nombre se considera repetido sin acentos ni mayúsculas, salvo el de la misma categoría', () => {
    const lista = [{ id: asId<'Category'>('a'), name: 'Acrílico' }];
    expect(categoryNameTaken('acrilico', lista)).toBe(true);
    expect(categoryNameTaken('ACRÍLICO ', lista)).toBe(true);
    expect(categoryNameTaken('Acrílico', lista, asId<'Category'>('a'))).toBe(false);
    expect(categoryNameTaken('Vitrales', lista)).toBe(false);
  });

  it('la nueva va al final, y se ordena por orden y luego por nombre', () => {
    expect(nextSortOrder([])).toBe(1);
    expect(nextSortOrder([{ sortOrder: 3 }, { sortOrder: 11 }])).toBe(12);
    expect(
      sortCategories([
        { sortOrder: 2, name: 'B' },
        { sortOrder: 1, name: 'Z' },
        { sortOrder: 2, name: 'A' },
      ]).map((c) => c.name),
    ).toEqual(['Z', 'A', 'B']);
  });
});

describe('administrar categorías [RF-M1-08, ADR-0044]', () => {
  it('un administrador agrega una categoría al final; un cajero no', async () => {
    const { deps } = entorno();
    expect(
      await createCategory(deps, cajero, { name: 'Vitrales', fiscalDefaults: fiscal }),
    ).toEqual({
      ok: false,
      error: { code: 'NOT_AUTHORIZED' },
    });
    const r = await createCategory(deps, admin, { name: ' Vitrales ', fiscalDefaults: fiscal });
    expect(r.ok && r.value).toMatchObject({ name: 'Vitrales', sortOrder: 12, isActive: true });
    expect(await createCategory(deps, admin, { name: 'VITRALES', fiscalDefaults: fiscal })).toEqual(
      { ok: false, error: { code: 'CATEGORY_NAME_TAKEN' } },
    );
    expect(await createCategory(deps, admin, { name: 'espejo', fiscalDefaults: fiscal })).toEqual({
      ok: false,
      error: { code: 'CATEGORY_NAME_TAKEN' },
    });
  });

  it('se renombra; no se desactiva con productos activos; sí cuando ya no los tiene', async () => {
    const { deps, catalogo } = entorno();
    const creada = await createCategory(deps, admin, { name: 'Vitrales', fiscalDefaults: fiscal });
    if (!creada.ok) {
      throw new Error('alta');
    }
    const c: Category = creada.value;
    expect((await updateCategory(deps, admin, { ...c, name: 'Vitrales y emplomados' })).ok).toBe(
      true,
    );
    const producto = productoDePrueba(asId<'Product'>('p1'), c.id);
    await catalogo.create(producto);
    expect(await updateCategory(deps, admin, { ...c, isActive: false })).toEqual({
      ok: false,
      error: { code: 'CATEGORY_IN_USE' },
    });
    await catalogo.update({ ...producto, isActive: false });
    const r = await updateCategory(deps, admin, { ...c, isActive: false });
    expect(r.ok && r.value.isActive).toBe(false);
    expect(await updateCategory(deps, cajero, c)).toEqual({
      ok: false,
      error: { code: 'NOT_AUTHORIZED' },
    });
    expect(await updateCategory(deps, admin, { ...c, id: asId<'Category'>('no-existe') })).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('sube y baja una categoría un lugar; en la orilla no pasa nada', async () => {
    const { deps } = entorno();
    const lista = await deps.categories.listCategories();
    const ordenadas = lista.ok ? sortCategories(lista.value) : [];
    const segunda = ordenadas[1];
    if (segunda === undefined) {
      throw new Error('categorías');
    }
    const r = await moveCategory(deps, admin, segunda.id, 'UP');
    expect(r.ok && sortCategories(r.value)[0]?.id).toBe(segunda.id);
    const primera = await moveCategory(deps, admin, segunda.id, 'UP');
    expect(primera.ok && sortCategories(primera.value)[0]?.id).toBe(segunda.id);
    expect((await moveCategory(deps, cajero, segunda.id, 'DOWN')).ok).toBe(false);
  });
});
