import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { sequentialIdGenerator } from '../../../shared-kernel/id';
import { inMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { parseCsv } from '../domain/import/csv';
import { catalogImportTemplate } from '../domain/import/template';
import { createPriceRegistry, defaultRules } from '../domain/pricing/registry';
import { inMemoryCatalog } from './in-memory-catalog';
import { importCatalog, previewCatalogImport, type ImportCatalogDeps } from './import-catalog';

const ENCABEZADO =
  'codigo,nombre,categoria,tipo,unidad,precio,exento,regla,base_metro_lineal,garantia_meses';

function entorno(): ImportCatalogDeps {
  const catalogo = inMemoryCatalog({
    idGenerator: sequentialIdGenerator('c'),
    clock: fixedClock(new Date('2026-10-30T12:00:00.000Z')),
    auditLog: inMemoryAuditLog(),
  });
  const reglas = createPriceRegistry(defaultRules);
  if (!reglas.ok) throw new Error('registro');
  return {
    products: catalogo,
    categories: catalogo,
    idGenerator: sequentialIdGenerator('p'),
    priceRules: reglas.value,
  };
}

const VALIDO = `${ENCABEZADO}\nA-1,Vidrio claro,Vidrio claro / flotado,a medida,m2,280,no,,,\nA-2,Espejo,Espejo,a medida,m2,350.50,no,,,6`;

describe('importCatalog', () => {
  it('un archivo válido deja todos los productos en el catálogo', async () => {
    const deps = entorno();
    const r = await importCatalog(deps, { role: 'ADMIN' }, parseCsv(VALIDO));
    expect(r.ok && r.value.map((p) => [p.id, p.code, p.listPrice])).toEqual([
      ['p-0001', 'A-1', 28_000],
      ['p-0002', 'A-2', 35_050],
    ]);
    const lista = await deps.products.list();
    expect(lista.ok && lista.value).toHaveLength(2);
  });

  it('la plantilla descargable, con sus ejemplos, se importa tal cual', async () => {
    const deps = entorno();
    const r = await importCatalog(deps, { role: 'ADMIN' }, parseCsv(catalogImportTemplate()));
    expect(r.ok && r.value).toHaveLength(3);
  });

  it('todo o nada: con una fila mala no se importa ninguna y se devuelve el detalle', async () => {
    const deps = entorno();
    const csv = `${VALIDO}\nA-3,Malo,Telas,a medida,m2,-5,no,,,`;
    const r = await importCatalog(deps, { role: 'ADMIN' }, parseCsv(csv));
    expect(!r.ok && r.error.code).toBe('IMPORT_INVALID');
    if (!r.ok && r.error.code === 'IMPORT_INVALID') {
      expect(r.error.analysis.rows[2]?.errors.map((e) => e.code)).toEqual([
        'CATEGORY_UNKNOWN',
        'PRICE_NEGATIVE',
      ]);
    }
    const lista = await deps.products.list();
    expect(lista.ok && lista.value).toEqual([]);
  });

  it('un código que ya existe en el catálogo se detecta antes de guardar', async () => {
    const deps = entorno();
    await importCatalog(deps, { role: 'ADMIN' }, parseCsv(VALIDO));
    const r = await importCatalog(deps, { role: 'ADMIN' }, parseCsv(VALIDO));
    expect(!r.ok && r.error.code).toBe('IMPORT_INVALID');
    if (!r.ok && r.error.code === 'IMPORT_INVALID') {
      expect(r.error.analysis.rows.flatMap((f) => f.errors.map((e) => e.code))).toEqual([
        'CODE_DUPLICATE_IN_CATALOG',
        'CODE_DUPLICATE_IN_CATALOG',
      ]);
    }
    const lista = await deps.products.list();
    expect(lista.ok && lista.value).toHaveLength(2);
  });

  it('un archivo sin las columnas obligatorias no se importa', async () => {
    const r = await importCatalog(entorno(), { role: 'ADMIN' }, parseCsv('nombre\nVidrio'));
    expect(!r.ok && r.error.code).toBe('IMPORT_INVALID');
  });

  it.each(['STAFF', 'DEVICE', null] as const)(
    '%s no puede importar ni revisar el catálogo',
    async (role) => {
      const deps = entorno();
      const importado = await importCatalog(deps, { role }, parseCsv(VALIDO));
      expect(!importado.ok && importado.error.code).toBe('NOT_AUTHORIZED');
      const vista = await previewCatalogImport(deps, { role }, parseCsv(VALIDO));
      expect(!vista.ok && vista.error.code).toBe('NOT_AUTHORIZED');
      const lista = await deps.products.list();
      expect(lista.ok && lista.value).toEqual([]);
    },
  );
});

describe('previewCatalogImport', () => {
  it('muestra los errores con su fila y no guarda nada', async () => {
    const deps = entorno();
    const csv = `${ENCABEZADO}\nA-1,Bien,Espejo,a medida,m2,100,no,,,\nA-2,,Espejo,a medida,m2,100,no,,,`;
    const r = await previewCatalogImport(deps, { role: 'ADMIN' }, parseCsv(csv));
    expect(r.ok && r.value.valid).toBe(false);
    expect(r.ok && r.value.rows.map((f) => [f.number, f.errors.map((e) => e.code)])).toEqual([
      [2, []],
      [3, ['NAME_REQUIRED_IN_ROW']],
    ]);
    const lista = await deps.products.list();
    expect(lista.ok && lista.value).toEqual([]);
  });
});
