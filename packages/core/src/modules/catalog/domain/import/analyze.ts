import { asId } from '../../../../shared-kernel/id';
import { parseMoney } from '../../../../shared-kernel/money/parse-money';
import {
  adjustmentFieldsFor,
  paramsWithAdjustments,
  parseAdjustmentTexts,
  type AdjustmentField,
  type AdjustmentTextErrorCode,
} from '../pricing/adjustments';
import type { PriceRegistry } from '../pricing/registry';
import {
  buildProduct,
  isProductServiceKey,
  isUnitKey,
  MAX_DESCRIPTION_LENGTH,
  type Category,
  type ChargeUnit,
  type ProductDraft,
  type ProductErrorCode,
  type ProductKind,
} from '../product';
import { MAX_SALE_UNIT_LENGTH } from '../sale-unit';
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
  'precio_abierto',
  'descripcion',
  'redondeo_mm',
  'area_minima_m2',
  'minimo_por_trabajo',
  'ancho_maximo_mm',
  'alto_maximo_mm',
  'unidad_venta',
  'clave_sat',
  'clave_unidad_sat',
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

/** Columna de cada ajuste del cobro [RF-M1-14]. Opcionales: vacías o ausentes, el ajuste está apagado. */
const COLUMNA_DE_AJUSTE: Readonly<Record<AdjustmentField, ImportColumn>> = {
  measureStepMm: 'redondeo_mm',
  minAreaMm2: 'area_minima_m2',
  minAmountCents: 'minimo_por_trabajo',
  maxWidthMm: 'ancho_maximo_mm',
  maxHeightMm: 'alto_maximo_mm',
};
const CAMPOS_DE_AJUSTE = Object.keys(COLUMNA_DE_AJUSTE) as AdjustmentField[];

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
  | 'OPEN_PRICE_INVALID'
  | 'DESCRIPTION_TOO_LONG_IN_ROW'
  | 'CODE_DUPLICATE_IN_FILE'
  | 'CODE_DUPLICATE_IN_CATALOG'
  | 'RULE_UNKNOWN'
  | 'LINEAR_BASIS_REQUIRED'
  | 'LINEAR_BASIS_INVALID'
  | 'WARRANTY_INVALID'
  /** Un ajuste del cobro que la regla del producto no admite (por ejemplo, área mínima en una pieza). */
  | 'ADJUSTMENT_NOT_ALLOWED'
  /** Claves del SAT con otro formato: 8 dígitos para el producto, 2 o 3 letras o dígitos para la unidad. */
  | 'SAT_KEY_INVALID'
  | 'SAT_UNIT_KEY_INVALID'
  | AdjustmentTextErrorCode
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
  // Cantos, perforaciones, biselados: se agregan a una línea de vidrio [RF-M1-09].
  extra: 'EXTRA',
  'cargo extra': 'EXTRA',
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

/** Nombre de una columna del archivo, sin acentos, mayúsculas ni espacios ("Código" → "codigo"). */
export function importColumnName(encabezado: string): string {
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
    const nombre = importColumnName(texto);
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

    // Precio abierto [RF-M1-10]: columna opcional; vacía o ausente, el precio es fijo.
    const textoAbierto = normalizeSearchText(valor('precio_abierto'));
    const abierto = SI.has(textoAbierto) ? true : NO.has(textoAbierto) ? false : null;
    if (abierto === null) falla('precio_abierto', 'OPEN_PRICE_INVALID');

    // Descripción [RF-M1-13]: opcional, de hasta 500 caracteres.
    const descripcion = valor('descripcion');
    if (descripcion.length > MAX_DESCRIPTION_LENGTH)
      falla('descripcion', 'DESCRIPTION_TOO_LONG_IN_ROW');

    // Unidad de venta [RF-M1-11]: opcional, solo por pieza o servicio.
    const unidadDeVenta = valor('unidad_venta');
    if (unidadDeVenta !== '' && unidad !== undefined && unidad !== 'PIECE' && unidad !== 'SERVICE')
      falla('unidad_venta', 'SALE_UNIT_NOT_ALLOWED');
    else if (unidadDeVenta.length > MAX_SALE_UNIT_LENGTH)
      falla('unidad_venta', 'SALE_UNIT_TOO_LONG');

    // Claves del SAT por producto [RF-M1-11]: vacías, se heredan de la categoría.
    const claveSat = valor('clave_sat');
    if (claveSat !== '' && !isProductServiceKey(claveSat)) falla('clave_sat', 'SAT_KEY_INVALID');
    const claveUnidad = valor('clave_unidad_sat').toUpperCase();
    if (claveUnidad !== '' && !isUnitKey(claveUnidad))
      falla('clave_unidad_sat', 'SAT_UNIT_KEY_INVALID');

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

    // Ajustes del cobro [RF-M1-14]: los que la regla admite se convierten; uno que no admite es un error.
    if (regla !== null) {
      const basis = parametros.basis === 'PERIMETER' ? 'PERIMETER' : 'LENGTH';
      const admitidos = adjustmentFieldsFor(regla, regla === 'LINEAR' ? basis : null);
      const textos = Object.fromEntries(
        CAMPOS_DE_AJUSTE.map((campo) => [campo, valor(COLUMNA_DE_AJUSTE[campo])]),
      ) as Record<AdjustmentField, string>;
      for (const campo of CAMPOS_DE_AJUSTE) {
        if (textos[campo] !== '' && !admitidos.includes(campo))
          falla(COLUMNA_DE_AJUSTE[campo], 'ADJUSTMENT_NOT_ALLOWED');
      }
      const ajustes = parseAdjustmentTexts(textos, admitidos);
      for (const e of ajustes.errors) falla(COLUMNA_DE_AJUSTE[e.field], e.code);
      parametros = paramsWithAdjustments(regla, parametros, ajustes.adjustments);
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
      abierto === null ||
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
      fiscal: {
        ...categoria.fiscalDefaults,
        ...(claveSat === '' ? {} : { productServiceKey: claveSat }),
        ...(claveUnidad === '' ? {} : { unitKey: claveUnidad }),
      },
      warrantyMonths: garantia,
      warrantyText: null,
      ...(abierto ? { isOpenPrice: true } : {}),
      ...(descripcion === '' ? {} : { description: descripcion }),
      ...(unidadDeVenta === '' ? {} : { saleUnitName: unidadDeVenta }),
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
      ...(p.isOpenPrice === true ? { isOpenPrice: true } : {}),
      ...(p.description === undefined ? {} : { description: p.description }),
      ...(p.saleUnitName === undefined ? {} : { saleUnitName: p.saleUnitName }),
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
