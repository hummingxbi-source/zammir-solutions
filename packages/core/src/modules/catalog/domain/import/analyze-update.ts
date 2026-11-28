import { parseMoney } from '../../../../shared-kernel/money/parse-money';
import type { PriceRegistry } from '../pricing/registry';
import {
  buildProduct,
  MAX_DESCRIPTION_LENGTH,
  type Product,
  type ProductErrorCode,
} from '../product';
import { importColumnName } from './analyze';

/** Columnas del archivo para actualizar productos que ya existen, por su código [RF-M1-15]. */
export const UPDATE_COLUMNS = ['codigo', 'nombre', 'precio', 'descripcion'] as const;

export type UpdateColumn = (typeof UPDATE_COLUMNS)[number];

export type UpdateErrorCode =
  | 'CODE_REQUIRED_IN_ROW'
  /** Ningún producto del catálogo tiene ese código: actualizar no da de alta. */
  | 'CODE_NOT_IN_CATALOG'
  | 'CODE_DUPLICATE_IN_FILE'
  | 'PRICE_INVALID'
  | 'PRICE_TOO_MANY_DECIMALS'
  | 'PRICE_NEGATIVE'
  | 'DESCRIPTION_TOO_LONG_IN_ROW'
  | ProductErrorCode;

export interface UpdateRowError {
  readonly column: UpdateColumn | null;
  readonly code: UpdateErrorCode;
}

/** Un producto antes y después del cambio. */
export interface ProductUpdate {
  readonly before: Product;
  readonly after: Product;
}

export interface UpdateRow {
  readonly number: number;
  /** `null` si la fila tiene errores o no cambia nada. */
  readonly update: ProductUpdate | null;
  readonly errors: readonly UpdateRowError[];
}

export type UpdateFileError =
  | 'EMPTY_FILE'
  /** Falta la columna "codigo". */
  | 'MISSING_COLUMNS'
  /** No hay ninguna columna que cambiar: nombre, precio o descripcion. */
  | 'NOTHING_TO_UPDATE';

export interface UpdateAnalysis {
  readonly fileError: UpdateFileError | null;
  readonly rows: readonly UpdateRow[];
  /** Solo lo que sí cambia, en el orden del archivo. */
  readonly updates: readonly ProductUpdate[];
  /** Todo o nada: válido solo si ninguna fila tiene errores y el archivo se pudo leer. */
  readonly valid: boolean;
}

export interface UpdateContext {
  readonly products: readonly Product[];
  readonly priceRules: PriceRegistry;
}

function vacio(fileError: UpdateFileError): UpdateAnalysis {
  return { fileError, rows: [], updates: [], valid: false };
}

/** Revisa un archivo para ACTUALIZAR productos que ya existen, buscándolos por su código, sin guardar nada
 *  [RF-M1-15, ADR-0048]. Cambia solo el nombre, el precio y la descripción; una celda vacía deja lo que ya
 *  tenía. Todo o nada, igual que el alta: con un solo error no se cambia ningún producto. Cada producto
 *  nuevo pasa otra vez por `buildProduct`, así cumple las mismas reglas que uno editado a mano. */
export function analyzeCatalogUpdate(
  filas: readonly (readonly string[])[],
  contexto: UpdateContext,
): UpdateAnalysis {
  const [encabezado, ...todas] = filas;
  if (encabezado === undefined) {
    return vacio('EMPTY_FILE');
  }
  const indices = new Map<string, number>();
  encabezado.forEach((texto, i) => {
    const nombre = importColumnName(texto);
    if (!indices.has(nombre)) indices.set(nombre, i);
  });
  if (!indices.has('codigo')) {
    return vacio('MISSING_COLUMNS');
  }
  if (!['nombre', 'precio', 'descripcion'].some((c) => indices.has(c))) {
    return vacio('NOTHING_TO_UPDATE');
  }
  // Las filas vacías (las que deja Excel al final) no cuentan.
  const datos = todas
    .map((celdas, posicion) => ({ celdas, numero: posicion + 2 }))
    .filter(({ celdas }) => celdas.some((c) => c.trim() !== ''));
  if (datos.length === 0) {
    return vacio('EMPTY_FILE');
  }

  const porCodigo = new Map(
    contexto.products.flatMap((p) => (p.code === null ? [] : [[p.code.trim().toLowerCase(), p]])),
  );
  const vistos = new Set<string>();

  const rows = datos.map(({ celdas, numero }): UpdateRow => {
    const valor = (columna: UpdateColumn): string => {
      const i = indices.get(columna);
      return (i === undefined ? '' : (celdas[i] ?? '')).trim();
    };
    const errores: UpdateRowError[] = [];
    const falla = (column: UpdateColumn | null, code: UpdateErrorCode): void => {
      errores.push({ column, code });
    };

    const codigo = valor('codigo');
    const clave = codigo.toLowerCase();
    const antes = porCodigo.get(clave);
    if (codigo === '') falla('codigo', 'CODE_REQUIRED_IN_ROW');
    else if (vistos.has(clave)) falla('codigo', 'CODE_DUPLICATE_IN_FILE');
    else if (antes === undefined) falla('codigo', 'CODE_NOT_IN_CATALOG');
    vistos.add(clave);

    const textoPrecio = valor('precio');
    const precio = textoPrecio === '' ? null : parseMoney(textoPrecio);
    if (precio !== null && !precio.ok) {
      falla(
        'precio',
        precio.error.code === 'TOO_MANY_DECIMALS' ? 'PRICE_TOO_MANY_DECIMALS' : 'PRICE_INVALID',
      );
    } else if (precio !== null && precio.value < 0) {
      falla('precio', 'PRICE_NEGATIVE');
    }

    const descripcion = valor('descripcion');
    if (descripcion.length > MAX_DESCRIPTION_LENGTH) {
      falla('descripcion', 'DESCRIPTION_TOO_LONG_IN_ROW');
    }

    if (errores.length > 0 || antes === undefined || (precio !== null && !precio.ok)) {
      return { number: numero, update: null, errors: errores };
    }
    const nombre = valor('nombre');
    const despues = buildProduct(
      antes.id,
      {
        ...antes,
        ...(nombre === '' ? {} : { name: nombre }),
        ...(precio === null ? {} : { listPrice: precio.value }),
        ...(descripcion === '' ? {} : { description: descripcion }),
      },
      contexto.priceRules,
    );
    if (!despues.ok) {
      return { number: numero, update: null, errors: [{ column: null, code: despues.error.code }] };
    }
    const cambia =
      despues.value.name !== antes.name ||
      despues.value.listPrice !== antes.listPrice ||
      despues.value.description !== antes.description;
    return {
      number: numero,
      update: cambia ? { before: antes, after: despues.value } : null,
      errors: [],
    };
  });

  const valid = rows.every((r) => r.errors.length === 0);
  return {
    fileError: null,
    rows,
    updates: valid ? rows.flatMap((r) => (r.update === null ? [] : [r.update])) : [],
    valid,
  };
}

/** El archivo para actualizar, con el catálogo de hoy: se descarga, se cambian precios en Excel y se sube.
 *  Solo los productos con código, porque por él se encuentran. CSV UTF-8 con BOM, como la plantilla. */
export function catalogUpdateTemplate(productos: readonly Product[]): string {
  const celda = (texto: string): string =>
    /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  const pesos = (c: number): string =>
    `${String(Math.floor(c / 100))}.${String(c % 100).padStart(2, '0')}`;
  const filas = productos
    .filter((p) => p.code !== null)
    .map((p) => [p.code ?? '', p.name, pesos(p.listPrice), p.description ?? '']);
  return `${String.fromCharCode(0xfeff)}${[UPDATE_COLUMNS, ...filas]
    .map((f) => f.map(celda).join(','))
    .join('\r\n')}\r\n`;
}
