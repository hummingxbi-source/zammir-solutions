import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import {
  createPriceRegistry,
  createProduct,
  defaultRules,
  fixedClock,
  inMemoryAuditLog,
  inMemoryCatalog,
  money,
  sequentialIdGenerator,
  type ImportCatalogDeps,
  type ProductDraft,
} from '@zammir/core';

import { uuidIdGenerator } from '../shared/infra/uuid-id-generator';
import { Catalogo } from '../modules/catalog/ui/Catalogo';

/** Muestra del Catálogo SOLO para desarrollo (`/muestras/catalogo`), con productos de ejemplo en memoria. */
async function armar(): Promise<ImportCatalogDeps | null> {
  const catalogo = inMemoryCatalog({
    idGenerator: uuidIdGenerator,
    clock: fixedClock(new Date()),
    auditLog: inMemoryAuditLog(),
  });
  const reglas = createPriceRegistry(defaultRules);
  if (!reglas.ok) {
    return null;
  }
  const deps: ImportCatalogDeps = {
    products: catalogo,
    categories: catalogo,
    idGenerator: sequentialIdGenerator('p'),
    priceRules: reglas.value,
  };
  const categorias = await catalogo.listCategories();
  if (!categorias.ok) {
    return null;
  }
  const ejemplos: readonly [number, string, string, number, ProductDraft['chargeUnit']][] = [
    [0, 'VC-6', 'Vidrio claro 6 mm', 28_000, 'SQUARE_METER'],
    [0, 'VC-9', 'Vidrio claro 9 mm', 39_500, 'SQUARE_METER'],
    [1, 'ES-4', 'Espejo 4 mm', 41_000, 'SQUARE_METER'],
    [1, 'MA-1', 'Marco de madera', 11_600, 'PIECE'],
    [2, 'AL-L', 'Perfil de aluminio', 9_500, 'LINEAR_METER'],
  ];
  for (const [indice, codigo, nombre, centavos, unidad] of ejemplos) {
    const categoria = categorias.value[indice % categorias.value.length];
    const precio = money(centavos);
    if (categoria === undefined || !precio.ok) {
      continue;
    }
    await createProduct(
      deps,
      { role: 'ADMIN' },
      {
        code: codigo,
        name: nombre,
        categoryId: categoria.id,
        kind: unidad === 'PIECE' ? 'STANDARD' : 'CUSTOM',
        chargeUnit: unidad,
        listPrice: precio.value,
        isTaxExempt: false,
        isActive: codigo !== 'VC-9',
        ruleId: unidad === 'SQUARE_METER' ? 'AREA' : unidad === 'LINEAR_METER' ? 'LINEAR' : 'PIECE',
        ruleParams: unidad === 'LINEAR_METER' ? { basis: 'LENGTH' } : {},
        fiscal: categoria.fiscalDefaults,
        warrantyMonths: null,
        warrantyText: null,
      },
    );
  }
  return deps;
}

export function MuestraDelCatalogo(): ReactElement {
  const [deps, setDeps] = useState<ImportCatalogDeps | null>(null);
  useEffect(() => {
    void armar().then(setDeps);
  }, []);
  if (deps === null) {
    return <p role="status">Armando la muestra…</p>;
  }
  return <Catalogo deps={deps} actor={{ role: 'ADMIN' }} />;
}
