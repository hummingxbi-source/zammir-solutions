import { describe, expect, it } from 'vitest';

import { asId } from '../../../../shared-kernel/id';
import { INITIAL_CATEGORIES } from '../initial-categories';
import { createPriceRegistry, defaultRules } from '../pricing/registry';
import type { Category } from '../product';
import { analyzeCatalogImport, IMPORT_COLUMNS, type ImportContext } from './analyze';
import { parseCsv } from './csv';
import { catalogImportTemplate } from './template';

const reglas = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) throw new Error('registro');
  return r.value;
})();

const categorias: Category[] = INITIAL_CATEGORIES.map((c, i) => ({
  id: asId<'Category'>(`cat-${String(i + 1)}`),
  name: c.name,
  sortOrder: i + 1,
  fiscalDefaults: c.fiscalDefaults,
}));

const contexto: ImportContext = {
  categories: categorias,
  existingCodes: ['YA-EXISTE'],
  priceRules: reglas,
};
const ENCABEZADO = IMPORT_COLUMNS.join(',');

function analizar(csv: string, ctx: ImportContext = contexto) {
  return analyzeCatalogImport(parseCsv(csv), ctx);
}

/** Una fila válida de vidrio por m²; `cambios` sobreescribe columnas por posición. */
function fila(cambios: Partial<Record<(typeof IMPORT_COLUMNS)[number], string>> = {}): string {
  const base: Record<(typeof IMPORT_COLUMNS)[number], string> = {
    codigo: 'VC-6',
    nombre: 'Vidrio claro de 6 mm',
    categoria: 'Vidrio claro / flotado',
    tipo: 'a medida',
    unidad: 'm²',
    precio: '280.00',
    exento: 'no',
    regla: '',
    base_metro_lineal: '',
    garantia_meses: '',
  };
  return IMPORT_COLUMNS.map((c) => cambios[c] ?? base[c]).join(',');
}

function errores(csv: string): string[][] {
  return analizar(csv).rows.map((r) => r.errors.map((e) => `${e.column ?? '-'}:${e.code}`));
}

describe('analyzeCatalogImport: archivo', () => {
  it('un archivo vacío o solo con encabezado no se puede importar', () => {
    expect(analizar('')).toMatchObject({ fileError: 'EMPTY_FILE', valid: false });
    expect(analizar(ENCABEZADO)).toMatchObject({ fileError: 'EMPTY_FILE', valid: false });
  });

  it('dice qué columnas obligatorias faltan', () => {
    const r = analizar('nombre,categoria\nVidrio,Espejo');
    expect(r).toMatchObject({
      fileError: 'MISSING_COLUMNS',
      missingColumns: ['tipo', 'unidad', 'precio'],
      valid: false,
    });
  });

  it('el orden de las columnas y los acentos o mayúsculas del encabezado no importan', () => {
    const csv = 'PRECIO,Categoría,Nombre,UNIDAD,Tipo\n280,Espejo,Espejo de 4 mm,m2,A medida';
    const r = analizar(csv);
    expect(r.valid).toBe(true);
    expect(r.rows[0]?.draft).toMatchObject({ name: 'Espejo de 4 mm', ruleId: 'AREA' });
  });

  it('las columnas opcionales pueden faltar', () => {
    const r = analizar('nombre,categoria,tipo,unidad,precio\nVidrio,Espejo,a medida,m2,280');
    expect(r.valid).toBe(true);
    expect(r.rows[0]?.draft).toMatchObject({
      code: null,
      isTaxExempt: false,
      warrantyMonths: null,
    });
  });
});

describe('analyzeCatalogImport: filas válidas', () => {
  it('un archivo válido produce un producto por fila, con precio en centavos y datos fiscales de la categoría', () => {
    const r = analizar(
      `${ENCABEZADO}\n${fila()}\n${fila({ codigo: 'VT-9', nombre: 'Vidrio templado', categoria: 'Vidrio templado', precio: '"$1,234.56"', garantia_meses: '12' })}`,
    );
    expect(r.valid).toBe(true);
    expect(r.rows.map((x) => x.number)).toEqual([2, 3]);
    expect(r.rows[0]?.draft).toMatchObject({
      code: 'VC-6',
      listPrice: 28_000,
      chargeUnit: 'SQUARE_METER',
      kind: 'CUSTOM',
      ruleId: 'AREA',
      categoryId: 'cat-1',
      isActive: true,
      fiscal: { unitKey: 'MTK' },
    });
    expect(r.rows[1]?.draft).toMatchObject({
      listPrice: 123_456,
      warrantyMonths: 12,
      categoryId: 'cat-2',
    });
  });

  it('los acentos y la eñe se conservan en los nombres', () => {
    const r = analizar(`${ENCABEZADO}\n${fila({ nombre: 'Cristal Ñandú · decoración estándar' })}`);
    expect(r.rows[0]?.draft?.name).toBe('Cristal Ñandú · decoración estándar');
  });

  it('el tipo, la unidad y el exento se entienden de varias formas', () => {
    const filas = [
      fila({ codigo: 'A', tipo: 'A MEDIDA', unidad: 'm2', exento: 'sí' }),
      fila({ codigo: 'B', tipo: 'pieza estándar', unidad: 'pieza', exento: 'SI' }),
      fila({ codigo: 'C', tipo: 'servicio', unidad: 'visita', exento: '' }),
      fila({
        codigo: 'D',
        tipo: 'a medida',
        unidad: 'ml',
        base_metro_lineal: 'Perímetro',
        exento: 'No',
      }),
    ].join('\n');
    const r = analizar(`${ENCABEZADO}\n${filas}`);
    expect(r.valid).toBe(true);
    expect(r.rows.map((x) => x.draft?.isTaxExempt)).toEqual([true, true, false, false]);
    expect(r.rows.map((x) => x.draft?.ruleId)).toEqual(['AREA', 'PIECE', 'SERVICE', 'LINEAR']);
    expect(r.rows[3]?.draft?.ruleParams).toEqual({ basis: 'PERIMETER' });
  });

  it('metro lineal con base "largo"', () => {
    const r = analizar(
      `${ENCABEZADO}\n${fila({ unidad: 'metro lineal', base_metro_lineal: 'largo' })}`,
    );
    expect(r.rows[0]?.draft?.ruleParams).toEqual({ basis: 'LENGTH' });
  });

  it('una regla indicada a mano se respeta si existe', () => {
    const r = analizar(`${ENCABEZADO}\n${fila({ regla: 'area' })}`);
    expect(r.rows[0]?.draft?.ruleId).toBe('AREA');
  });

  it('quita espacios sobrantes del nombre y del código', () => {
    const r = analizar(`${ENCABEZADO}\n${fila({ codigo: '  VC-6  ', nombre: '  Vidrio  ' })}`);
    expect(r.rows[0]?.draft).toMatchObject({ code: 'VC-6', name: 'Vidrio' });
  });
});

describe('analyzeCatalogImport: errores por fila, con su número', () => {
  it.each([
    ['nombre en blanco', fila({ nombre: '' }), ['nombre:NAME_REQUIRED_IN_ROW']],
    ['categoría inexistente', fila({ categoria: 'Telas' }), ['categoria:CATEGORY_UNKNOWN']],
    ['tipo que no existe', fila({ tipo: 'regalo' }), ['tipo:KIND_INVALID']],
    ['unidad que no existe', fila({ unidad: 'litros' }), ['unidad:UNIT_INVALID']],
    ['precio negativo', fila({ precio: '-5' }), ['precio:PRICE_NEGATIVE']],
    ['precio con letras', fila({ precio: 'barato' }), ['precio:PRICE_INVALID']],
    ['precio vacío', fila({ precio: '' }), ['precio:PRICE_INVALID']],
    ['precio con tres decimales', fila({ precio: '280.505' }), ['precio:PRICE_TOO_MANY_DECIMALS']],
    ['exento que no se entiende', fila({ exento: 'quizá' }), ['exento:EXEMPT_INVALID']],
    ['regla que no existe', fila({ regla: 'MAGICA' }), ['regla:RULE_UNKNOWN']],
    [
      'metro lineal sin base',
      fila({ unidad: 'metro lineal' }),
      ['base_metro_lineal:LINEAR_BASIS_REQUIRED'],
    ],
    [
      'metro lineal con base rara',
      fila({ unidad: 'metro lineal', base_metro_lineal: 'diagonal' }),
      ['base_metro_lineal:LINEAR_BASIS_INVALID'],
    ],
    [
      'garantía con letras',
      fila({ garantia_meses: 'un año' }),
      ['garantia_meses:WARRANTY_INVALID'],
    ],
    ['garantía en cero', fila({ garantia_meses: '0' }), ['garantia_meses:WARRANTY_INVALID']],
    [
      'código que ya existe en el catálogo',
      fila({ codigo: 'ya-existe' }),
      ['codigo:CODE_DUPLICATE_IN_CATALOG'],
    ],
  ])('%s', (_caso, linea, esperado) => {
    expect(errores(`${ENCABEZADO}\n${linea}`)).toEqual([esperado]);
  });

  it('una pieza estándar cobrada por m² no cuadra (reglas del producto)', () => {
    expect(errores(`${ENCABEZADO}\n${fila({ tipo: 'pieza estándar', unidad: 'm²' })}`)).toEqual([
      ['-:KIND_UNIT_MISMATCH'],
    ]);
  });

  it('una regla que no corresponde a la unidad no cuadra', () => {
    expect(errores(`${ENCABEZADO}\n${fila({ regla: 'PIECE' })}`)).toEqual([
      ['-:RULE_UNIT_MISMATCH'],
    ]);
  });

  it('una fila con varios errores los reporta todos', () => {
    expect(
      errores(
        `${ENCABEZADO}\n${fila({ nombre: '', categoria: 'Telas', precio: '-1', exento: '??' })}`,
      ),
    ).toEqual([
      [
        'nombre:NAME_REQUIRED_IN_ROW',
        'categoria:CATEGORY_UNKNOWN',
        'precio:PRICE_NEGATIVE',
        'exento:EXEMPT_INVALID',
      ],
    ]);
  });

  it('el código repetido dentro del archivo se marca en la segunda fila, sin importar mayúsculas', () => {
    const r = analizar(
      `${ENCABEZADO}\n${fila({ codigo: 'DUP' })}\n${fila({ codigo: 'dup' })}\n${fila({ codigo: 'OTRO' })}`,
    );
    expect(r.rows.map((x) => x.errors.map((e) => e.code))).toEqual([
      [],
      ['CODE_DUPLICATE_IN_FILE'],
      [],
    ]);
  });

  it('varias filas sin código no cuentan como repetidas', () => {
    const r = analizar(`${ENCABEZADO}\n${fila({ codigo: '' })}\n${fila({ codigo: '' })}`);
    expect(r.valid).toBe(true);
  });

  it('el archivo es todo o nada: una sola fila mala deja todo sin importar, y las buenas conservan su producto', () => {
    const r = analizar(
      `${ENCABEZADO}\n${fila({ codigo: 'A' })}\n${fila({ codigo: 'B', precio: '-1' })}\n${fila({ codigo: 'C' })}`,
    );
    expect(r.valid).toBe(false);
    expect(r.rows.map((x) => x.number)).toEqual([2, 3, 4]);
    expect(r.rows.map((x) => x.draft !== null)).toEqual([true, false, true]);
  });

  it('los números de fila cuentan el encabezado como la fila 1', () => {
    const r = analizar(
      `${ENCABEZADO}\n${fila({ codigo: 'A' })}\n${fila({ codigo: 'B', categoria: 'Telas' })}`,
    );
    expect(r.rows.find((x) => x.errors.length > 0)?.number).toBe(3);
  });
});

describe('plantilla descargable', () => {
  it('empieza con BOM, trae el encabezado y se lee sin errores con sus ejemplos', () => {
    const plantilla = catalogImportTemplate();
    expect(plantilla.startsWith(String.fromCharCode(0xfeff))).toBe(true);
    expect(parseCsv(plantilla)[0]).toEqual([...IMPORT_COLUMNS]);
    const r = analizar(plantilla);
    expect(r.valid).toBe(true);
    expect(r.rows).toHaveLength(3);
  });

  it('los ejemplos conservan los acentos', () => {
    expect(catalogImportTemplate()).toContain('Instalación a domicilio (ejemplo)');
    expect(catalogImportTemplate()).toContain('m²');
  });

  it('una celda con coma o comillas sale entre comillas', () => {
    // El encabezado y los ejemplos no las necesitan, pero el lector debe devolver lo mismo que se escribió.
    const filas = parseCsv(catalogImportTemplate());
    expect(filas.every((f) => f.length === IMPORT_COLUMNS.length)).toBe(true);
  });
});
