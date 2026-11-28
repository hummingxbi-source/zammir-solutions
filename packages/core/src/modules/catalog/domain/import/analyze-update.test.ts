import { describe, expect, it } from 'vitest';

import { asId } from '../../../../shared-kernel/id';
import { money, type Money } from '../../../../shared-kernel/money/money';
import { productoDePrueba } from '../../contracts/catalog.contract';
import { createPriceRegistry, defaultRules } from '../pricing/registry';
import type { Product } from '../product';
import { analyzeCatalogUpdate, catalogUpdateTemplate } from './analyze-update';
import { parseCsv } from './csv';

const reglas = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) throw new Error('registro');
  return r.value;
})();
const pesos = (c: number): Money => {
  const r = money(c);
  if (!r.ok) throw new Error('monto');
  return r.value;
};
const categoria = asId<'Category'>('c-1');
const producto = (id: string, codigo: string | null, precio: number, nombre = id): Product => ({
  ...productoDePrueba(asId<'Product'>(id), categoria),
  code: codigo,
  name: nombre,
  listPrice: pesos(precio),
});
const catalogo = [
  producto('p1', 'VC-6', 280_00, 'Vidrio claro 6 mm'),
  producto('p2', 'ES-4', 410_00, 'Espejo 4 mm'),
  producto('p3', null, 100_00, 'Sin código'),
];

function analizar(csv: string, productos: readonly Product[] = catalogo) {
  return analyzeCatalogUpdate(parseCsv(csv), { products: productos, priceRules: reglas });
}
function errores(csv: string): string[][] {
  return analizar(csv).rows.map((r) => r.errors.map((e) => `${e.column ?? '-'}:${e.code}`));
}

describe('actualizar productos por código [RF-M1-15]', () => {
  it('cambia precio, nombre y descripción de los que ya existen, sin importar mayúsculas del código', () => {
    const r = analizar(
      'codigo,nombre,precio,descripcion\nvc-6,,300,Para ventanas\nES-4,Espejo de 4 mm,,\n',
    );
    expect(r.valid).toBe(true);
    expect(
      r.updates.map((u) => [
        u.before.name,
        u.after.name,
        u.before.listPrice,
        u.after.listPrice,
        u.after.description,
      ]),
    ).toEqual([
      ['Vidrio claro 6 mm', 'Vidrio claro 6 mm', 280_00, 300_00, 'Para ventanas'],
      ['Espejo 4 mm', 'Espejo de 4 mm', 410_00, 410_00, undefined],
    ]);
    // El resto del producto no cambia.
    expect(r.updates[0]?.after.id).toBe('p1');
    expect(r.updates[0]?.after.ruleId).toBe(r.updates[0]?.before.ruleId);
  });

  it('basta la columna del código y una de las que cambian; una fila sin cambios no cuenta', () => {
    const r = analizar('Código,Precio\nVC-6,280.00\nES-4,415\n');
    expect(r.valid).toBe(true);
    expect(r.updates.map((u) => u.after.listPrice)).toEqual([415_00]);
    expect(r.rows.map((x) => x.update === null)).toEqual([true, false]);
  });

  it('sin código o sin nada que cambiar, el archivo no se puede usar', () => {
    expect(analizar('nombre,precio\nA,1\n').fileError).toBe('MISSING_COLUMNS');
    expect(analizar('codigo,categoria\nVC-6,Vidrio\n').fileError).toBe('NOTHING_TO_UPDATE');
    expect(analizar('').fileError).toBe('EMPTY_FILE');
    expect(analizar('codigo,precio\n,\n').fileError).toBe('EMPTY_FILE');
  });

  it('cada error se marca en su fila y columna, y con uno solo no se cambia nada', () => {
    const csv = [
      'codigo,precio,descripcion',
      'VC-6,300,',
      ',10,',
      'NO-EXISTE,10,',
      'ES-4,-1,',
      'vc-6,1.234,',
      'ES-4,abc,',
      `XX,,${'a'.repeat(501)}`,
    ].join('\n');
    expect(errores(csv)).toEqual([
      [],
      ['codigo:CODE_REQUIRED_IN_ROW'],
      ['codigo:CODE_NOT_IN_CATALOG'],
      ['precio:PRICE_NEGATIVE'],
      ['codigo:CODE_DUPLICATE_IN_FILE', 'precio:PRICE_TOO_MANY_DECIMALS'],
      ['codigo:CODE_DUPLICATE_IN_FILE', 'precio:PRICE_INVALID'],
      ['codigo:CODE_NOT_IN_CATALOG', 'descripcion:DESCRIPTION_TOO_LONG_IN_ROW'],
    ]);
    const r = analizar(csv);
    expect(r.valid).toBe(false);
    expect(r.updates).toEqual([]);
    expect(r.rows.map((x) => x.number)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it('el producto nuevo cumple las mismas reglas que uno editado a mano', () => {
    expect(errores('codigo,nombre\nVC-6," "\n')).toEqual([[]]);
    const roto = producto('p9', 'RT', 100, 'Roto');
    expect(
      analizar('codigo,precio\nRT,200\n', [{ ...roto, ruleParams: { minAreaMm2: -1 } }]).rows[0]
        ?.errors,
    ).toEqual([{ column: null, code: 'RULE_PARAMS_INVALID' }]);
  });

  it('la plantilla trae el catálogo de hoy con código, y se vuelve a leer sin cambios', () => {
    const plantilla = catalogUpdateTemplate([
      ...catalogo,
      { ...producto('p4', 'CM', 50_05, 'Con, coma'), description: 'Dice "hola"' },
    ]);
    expect(plantilla.startsWith(String.fromCharCode(0xfeff))).toBe(true);
    const filas = parseCsv(plantilla);
    expect(filas).toEqual([
      ['codigo', 'nombre', 'precio', 'descripcion'],
      ['VC-6', 'Vidrio claro 6 mm', '280.00', ''],
      ['ES-4', 'Espejo 4 mm', '410.00', ''],
      ['CM', 'Con, coma', '50.05', 'Dice "hola"'],
    ]);
    const r = analizar(plantilla, [
      ...catalogo,
      { ...producto('p4', 'CM', 50_05, 'Con, coma'), description: 'Dice "hola"' },
    ]);
    expect(r.valid).toBe(true);
    expect(r.updates).toEqual([]);
  });
});
