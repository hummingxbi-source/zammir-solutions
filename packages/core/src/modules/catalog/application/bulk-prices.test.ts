import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { sequentialIdGenerator } from '../../../shared-kernel/id';
import { money } from '../../../shared-kernel/money/money';
import { inMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { borradorDePrueba } from '../contracts/catalog.contract';
import { parseCsv } from '../domain/import/csv';
import { createPriceRegistry, defaultRules } from '../domain/pricing/registry';
import {
  applyCatalogUpdate,
  applyCategoryPrices,
  previewCatalogUpdate,
  previewCategoryPrices,
} from './bulk-prices';
import { inMemoryCatalog } from './in-memory-catalog';

const reglas = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) throw new Error('registro');
  return r.value;
})();
const pesos = (c: number) => {
  const r = money(c);
  if (!r.ok) throw new Error('monto');
  return r.value;
};
const admin = { role: 'ADMIN' } as const;
const cajero = { role: 'STAFF' } as const;

async function entorno() {
  const idGenerator = sequentialIdGenerator();
  const catalogo = inMemoryCatalog({
    idGenerator,
    clock: fixedClock(new Date('2026-11-27T18:00:00.000Z')),
    auditLog: inMemoryAuditLog(),
  });
  const categorias = await catalogo.listCategories();
  const herrajes = categorias.ok ? categorias.value.find((c) => c.name === 'Herrajes') : undefined;
  if (herrajes === undefined) throw new Error('herrajes');
  for (const [codigo, nombre, precio] of [
    ['BI-1', 'Bisagra', 45_50],
    ['JA-1', 'Jaladera', 120_00],
  ] as const) {
    await catalogo.create({
      id: idGenerator.newId<'Product'>(),
      ...borradorDePrueba(herrajes.id, {
        code: codigo,
        name: nombre,
        listPrice: pesos(precio),
        kind: 'STANDARD',
        chargeUnit: 'PIECE',
        ruleId: 'PIECE',
        ruleParams: {},
      }),
    });
  }
  return { deps: { products: catalogo, priceRules: reglas }, catalogo, herrajes };
}

async function precios(catalogo: Awaited<ReturnType<typeof entorno>>['catalogo']) {
  const lista = await catalogo.list();
  return lista.ok ? lista.value.map((p) => [p.code, p.listPrice]) : [];
}

describe('precios en bloque [RF-M1-15]', () => {
  it('el archivo para actualizar cambia los precios por código, con su historial', async () => {
    const { deps, catalogo } = await entorno();
    const filas = parseCsv('codigo,precio\nBI-1,50\nJA-1,125.50\n');
    const vista = await previewCatalogUpdate(deps, admin, filas);
    expect(vista.ok && vista.value.updates).toHaveLength(2);
    const r = await applyCatalogUpdate(deps, admin, filas);
    expect(r.ok && r.value).toHaveLength(2);
    expect(await precios(catalogo)).toEqual([
      ['BI-1', 50_00],
      ['JA-1', 125_50],
    ]);
    const lista = await catalogo.list();
    const bisagra = lista.ok ? lista.value[0] : undefined;
    const historial = await catalogo.priceHistory(bisagra?.id ?? ('' as never));
    expect(historial.ok && historial.value.map((c) => [c.oldPrice, c.newPrice])).toEqual([
      [45_50, 50_00],
    ]);
  });

  it('un archivo con errores no cambia nada y devuelve el análisis', async () => {
    const { deps, catalogo } = await entorno();
    const r = await applyCatalogUpdate(deps, admin, parseCsv('codigo,precio\nBI-1,50\nNO,1\n'));
    expect(!r.ok && r.error.code).toBe('IMPORT_INVALID');
    expect(await precios(catalogo)).toEqual([
      ['BI-1', 45_50],
      ['JA-1', 120_00],
    ]);
  });

  it('sube por porcentaje una categoría, redondeado al peso hacia arriba', async () => {
    const { deps, catalogo, herrajes } = await entorno();
    const vista = await previewCategoryPrices(deps, admin, herrajes.id, 800, 'UP');
    expect(vista.ok && vista.value.map((c) => [c.oldPrice, c.newPrice])).toEqual([
      [45_50, 50_00],
      [120_00, 130_00],
    ]);
    const r = await applyCategoryPrices(deps, admin, herrajes.id, 800, 'UP');
    expect(r.ok && r.value).toHaveLength(2);
    expect(await precios(catalogo)).toEqual([
      ['BI-1', 50_00],
      ['JA-1', 130_00],
    ]);
  });

  it('un porcentaje que no vale no cambia nada', async () => {
    const { deps, catalogo, herrajes } = await entorno();
    const r = await applyCategoryPrices(deps, admin, herrajes.id, 0, 'UP');
    expect(!r.ok && r.error.code).toBe('PERCENT_INVALID');
    expect(await precios(catalogo)).toEqual([
      ['BI-1', 45_50],
      ['JA-1', 120_00],
    ]);
  });

  it('solo un administrador', async () => {
    const { deps, herrajes } = await entorno();
    const filas = parseCsv('codigo,precio\nBI-1,50\n');
    const negado = { ok: false, error: { code: 'NOT_AUTHORIZED' } };
    expect(await previewCatalogUpdate(deps, cajero, filas)).toEqual(negado);
    expect(await applyCatalogUpdate(deps, cajero, filas)).toEqual(negado);
    expect(await previewCategoryPrices(deps, cajero, herrajes.id, 800, 'UP')).toEqual(negado);
    expect(await applyCategoryPrices(deps, { role: null }, herrajes.id, 800, 'UP')).toEqual(negado);
  });
});
