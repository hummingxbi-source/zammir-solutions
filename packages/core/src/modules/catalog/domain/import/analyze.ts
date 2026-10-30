import { asId } from '../../../../shared-kernel/id';
import { parseMoney } from '../../../../shared-kernel/money/parse-money';
import type { PriceRegistry } from '../pricing/registry';
import {
  buildProduct,
  type Category,
  type ChargeUnit,
  type ProductDraft,
  type ProductErrorCode,
  type ProductKind,
} from '../product';
import { normalizeSearchText } from '../search';

/** Columnas de la plantilla, en el orden en que se descargan. */
export const IMPORT_COLUMNS = [
  'codigo',
  'nombre',
  'categoria',
  'tipo',
  'unidad',
  'precio',
  'exento',
  'regla',
  'base_metro_lineal',
  'garantia_meses',
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

/** Sin estas columnas el archivo no se puede leer. */
export const REQUIRED_IMPORT_COLUMNS: readonly ImportColumn[] = [
  'nombre',
  'categoria',
  'tipo',
  'unidad',
  'precio',
];

export type ImportErrorCode =
  | 'NAME_REQUIRED_IN_ROW'
  | 'CATEGORY_UNKNOWN'
  | 'KIND_INVALID'
  | 'UNIT_INVALID'
  | 'PRICE_INVALID'
  | 'PRICE_TOO_MANY_DECIMALS'
  | 'PRICE_NEGATIVE'
  | 'EXEMPT_INVALID'
  | 'CODE_DUPLICATE_IN_FILE'
  | 'CODE_DUPLICATE_IN_CATALOG'
  | 'RULE_UNKNOWN'
  | 'LINEAR_BASIS_REQUIRED'
  | 'LINEAR_BASIS_INVALID'
  | 'WARRANTY_INVALID'
  | ProductErrorCode;

export interface ImportRowError {
  /** La columna que tiene el problema; `null` si es de la fila completa. */
  readonly column: ImportColumn | null;
  readonly code: ImportErrorCode;
}

export interface ImportRow {
  /** Número de fila en el archivo, contando el encabezado como la fila 1. */
  readonly number: number;
  /** El producto que saldría de esta fila; solo si la fila no tiene errores. */
  readonly draft: ProductDraft | null;
  readonly errors: readonly ImportRowError[];
}

export type ImportFileError = 'EMPTY_FILE' | 'MISSING_COLUMNS';

export interface ImportAnalysis {
  readonly fileError: ImportFileError | null;
  /** Columnas obligatorias que faltan en el encabezado. */
  readonly missingColumns: readonly string[];
  readonly rows: readonly ImportRow[];
  /** Se puede importar: archivo legible, al menos una fila y ninguna con errores. Es todo o nada. */
  readonly valid: boolean;
}

export interface ImportContext {
  readonly categories: readonly Category[];
  /** Códigos que ya existen en el catálogo. */
  readonly existingCodes: readonly string[];
  readonly priceRules: PriceRegistry;
}

const TIPOS: Readonly<Record<string, ProductKind>> = {
  'a medida': 'CUSTOM',
  medida: 'CUSTOM',
  'pieza estandar': 'STANDARD',
  estandar: 'STANDARD',
  servicio: 'SERVICE',
};

const UNIDADES: Readonly<Record<string, ChargeUnit>> = {
  'm²': 'SQUARE_METER',
  m2: 'SQUARE_METER',
  'metro cuadrado': 'SQUARE_METER',
  'metros cuadrados': 'SQUARE_METER',
  'metro lineal': 'LINEAR_METER',
  'metros lineales': 'LINEAR_METER',
  ml: 'LINEAR_METER',
  pieza: 'PIECE',
  servicio: 'SERVICE',
  visita: 'SERVICE',
};

const REGLA_POR_UNIDAD: Readonly<Record<ChargeUnit, string>> = {
  SQUARE_METER: 'AREA',
  LINEAR_METER: 'LINEAR',
  PIECE: 'PIECE',
  SERVICE: 'SERVICE',
};

const SI = new Set(['si', 's', '1', 'true', 'verdadero']);
const NO = new Set(['no', 'n', '0', 'false', 'falso', '']);

function nombreDeColumna(encabezado: string): string {
  return normalizeSearchText(encabezado).replace(/ /g, '_');
}

/** Revisa un archivo ya leído (filas de celdas) ANTES de guardar nada: cada fila con sus errores, para
 *  que la vista previa los muestre con su número de fila. Todo o nada: con un solo error, no se importa
 *  ninguna fila. Reutiliza `buildProduct`, así que un producto importado cumple las mismas reglas que uno
 *  capturado a mano. */
export function analyzeCatalogImport(
  filas: readonly (readonly string[])[],
  contexto: ImportContext,
): ImportAnalysis {
  const [encabezado, ...datos] = filas;
  if (encabezado === undefined) {
    return { fileError: 'EMPTY_FILE', missingColumns: [], rows: [], valid: false };
  }
  const indices = new Map<string, number>();
  encabezado.forEach((texto, i) => {
    const nombre = nombreDeColumna(texto);
    if (!indices.has(nombre)) indices.set(nombre, i);
  });
  const faltan = REQUIRED_IMPORT_COLUMNS.filter((c) => !indices.has(c));
  if (faltan.length > 0) {
    return { fileError: 'MISSING_COLUMNS', missingColumns: faltan, rows: [], valid: false };
  }
  if (datos.length === 0) {
    return { fileError: 'EMPTY_FILE', missingColumns: [], rows: [], valid: false };
  }

  const categoriasPorNombre = new Map(
    contexto.categories.map((c) => [normalizeSearchText(c.name), c]),
  );
  const codigosDelCatalogo = new Set(contexto.existingCodes.map((c) => c.trim().toLowerCase()));
  const codigosDelArchivo = new Set<string>();

  const rows = datos.map((celdas, posicion): ImportRow => {
    const numero = posicion + 2;
    const valor = (columna: ImportColumn): string => {
      const i = indices.get(columna);
      return (i === undefined ? '' : (celdas[i] ?? '')).trim();
    };
    const errores: ImportRowError[] = [];
    const falla = (column: ImportColumn | null, code: ImportErrorCode): void => {
      errores.push({ column, code });
    };

    const nombre = valor('nombre');
    if (nombre === '') falla('nombre', 'NAME_REQUIRED_IN_ROW');

    const categoria = categoriasPorNombre.get(normalizeSearchText(valor('categoria')));
    if (categoria === undefined) falla('categoria', 'CATEGORY_UNKNOWN');

    const tipo = TIPOS[normalizeSearchText(valor('tipo'))];
    if (tipo === undefined) falla('tipo', 'KIND_INVALID');

    const unidad = UNIDADES[normalizeSearchText(valor('unidad'))];
    if (unidad === undefined) falla('unidad', 'UNIT_INVALID');

    const precio = parseMoney(valor('precio'));
    if (!precio.ok) {
      falla(
        'precio',
        precio.error.code === 'TOO_MANY_DECIMALS' ? 'PRICE_TOO_MANY_DECIMALS' : 'PRICE_INVALID',
      );
    } else if (precio.value < 0) {
      falla('precio', 'PRICE_NEGATIVE');
    }

    const textoExento = normalizeSearchText(valor('exento'));
    const exento = SI.has(textoExento) ? true : NO.has(textoExento) ? false : null;
    if (exento === null) falla('exento', 'EXEMPT_INVALID');

    const codigo = valor('codigo');
    if (codigo !== '') {
      const clave = codigo.toLowerCase();
      if (codigosDelArchivo.has(clave)) falla('codigo', 'CODE_DUPLICATE_IN_FILE');
      else if (codigosDelCatalogo.has(clave)) falla('codigo', 'CODE_DUPLICATE_IN_CATALOG');
      codigosDelArchivo.add(clave);
    }

    const textoRegla = valor('regla');
    const reglaPedida = textoRegla === '' ? null : textoRegla.toUpperCase();
    if (reglaPedida !== null && !contexto.priceRules.has(reglaPedida))
      falla('regla', 'RULE_UNKNOWN');
    const regla = reglaPedida ?? (unidad === undefined ? null : REGLA_POR_UNIDAD[unidad]);

    // Metro lineal: la base (largo o perímetro) la define cada producto, sin valor por omisión [PD-25].
    let parametros: Record<string, unknown> = {};
    if (regla === 'LINEAR') {
      const base = normalizeSearchText(valor('base_metro_lineal'));
      if (base === '') falla('base_metro_lineal', 'LINEAR_BASIS_REQUIRED');
      else if (base === 'largo') parametros = { basis: 'LENGTH' };
      else if (base === 'perimetro') parametros = { basis: 'PERIMETER' };
      else falla('base_metro_lineal', 'LINEAR_BASIS_INVALID');
    }

    const textoGarantia = valor('garantia_meses');
    let garantia: number | null = null;
    if (textoGarantia !== '') {
      garantia = /^\d+$/.test(textoGarantia) ? Number(textoGarantia) : Number.NaN;
      if (!Number.isInteger(garantia) || garantia <= 0) falla('garantia_meses', 'WARRANTY_INVALID');
    }

    if (
      errores.length > 0 ||
      categoria === undefined ||
      tipo === undefined ||
      unidad === undefined ||
      !precio.ok ||
      exento === null ||
      regla === null
    ) {
      return { number: numero, draft: null, errors: errores };
    }

    // Las reglas del producto (tipo con unidad, regla con unidad, parámetros) son las de siempre.
    const borrador: ProductDraft = {
      code: codigo === '' ? null : codigo,
      name: nombre,
      categoryId: categoria.id,
      kind: tipo,
      chargeUnit: unidad,
      listPrice: precio.value,
      isTaxExempt: exento,
      isActive: true,
      ruleId: regla,
      ruleParams: parametros,
      fiscal: categoria.fiscalDefaults,
      warrantyMonths: garantia,
      warrantyText: null,
    };
    const construido = buildProduct(asId<'Product'>('importacion'), borrador, contexto.priceRules);
    if (!construido.ok) {
      return {
        number: numero,
        draft: null,
        errors: [{ column: null, code: construido.error.code }],
      };
    }
    // Se queda con lo normalizado por buildProduct (nombre y código sin espacios sobrantes).
    const p = construido.value;
    const normalizado: ProductDraft = {
      code: p.code,
      name: p.name,
      categoryId: p.categoryId,
      kind: p.kind,
      chargeUnit: p.chargeUnit,
      listPrice: p.listPrice,
      isTaxExempt: p.isTaxExempt,
      isActive: p.isActive,
      ruleId: p.ruleId,
      ruleParams: p.ruleParams,
      fiscal: p.fiscal,
      warrantyMonths: p.warrantyMonths,
      warrantyText: p.warrantyText,
    };
    return { number: numero, draft: normalizado, errors: [] };
  });

  return {
    fileError: null,
    missingColumns: [],
    rows,
    valid: rows.every((r) => r.errors.length === 0),
  };
}
