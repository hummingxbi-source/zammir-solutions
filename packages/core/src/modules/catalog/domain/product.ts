import type { CategoryId, ProductId } from '../../../shared-kernel/id';
import type { Millimeters } from '../../../shared-kernel/measure/length';
import { ZERO, type Money } from '../../../shared-kernel/money/money';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { PriceRegistry } from './pricing/registry';
import { MAX_SALE_UNIT_LENGTH } from './sale-unit';

/** Tipo de producto [RN-01]: a medida, pieza estándar o servicio. */
/** `EXTRA`: cargo extra que se agrega a una línea de vidrio (cantos, perforaciones, biselados) y se cobra con
 *  su medida; no se vende solo [RF-M1-09]. */
/** `BUNDLE`: paquete de varios productos ("cancel de baño" = vidrio + kit + tubo); al agregarlo se convierte
 *  en un renglón normal por componente [RF-M1-18, ADR-0048]. No se vende como un renglón propio. */
export type ProductKind = 'CUSTOM' | 'STANDARD' | 'SERVICE' | 'EXTRA' | 'BUNDLE';

/** Un componente de un paquete: qué producto y cuántos por cada paquete [RF-M1-18]. */
export interface BundleItem {
  readonly productId: ProductId;
  readonly quantity: number;
}

/** Cuántos componentes puede tener un paquete. */
export const MAX_BUNDLE_ITEMS = 20;

/** Unidad de cobro [RN-01]. */
export type ChargeUnit = 'SQUARE_METER' | 'LINEAR_METER' | 'PIECE' | 'SERVICE';

/** Datos que pide el CFDI por concepto [RN-28]. `null` = todavía sin definir (PD-29). */
export interface FiscalData {
  readonly productServiceKey: string | null;
  readonly unitKey: string | null;
  readonly taxObject: string | null;
}

export interface Category {
  readonly id: CategoryId;
  readonly name: string;
  readonly sortOrder: number;
  /** Valores fiscales que heredan los productos de la categoría. */
  readonly fiscalDefaults: FiscalData;
  /** Una categoría no se borra: se desactiva, y deja de ofrecerse para productos nuevos [RF-M1-08]. */
  readonly isActive: boolean;
}

/** Un producto del catálogo [RF-M1-01]. El precio incluye IVA y va en centavos [RN-06]. */
export interface Product {
  readonly id: ProductId;
  readonly code: string | null;
  readonly name: string;
  readonly categoryId: CategoryId;
  readonly kind: ProductKind;
  readonly chargeUnit: ChargeUnit;
  readonly listPrice: Money;
  readonly isTaxExempt: boolean;
  readonly isActive: boolean;
  /** Identificador de la regla de precio y sus parámetros guardados en datos [RN-02, ADR-0006]. */
  readonly ruleId: string;
  readonly ruleParams: unknown;
  readonly fiscal: FiscalData;
  readonly warrantyMonths: number | null;
  readonly warrantyText: string | null;
  /** Precio abierto [RF-M1-10, ADR-0048]: `listPrice` es de referencia y el precio se fija al cotizar o
   *  vender. Sin el campo, el precio es fijo. */
  readonly isOpenPrice?: boolean;
  /** Descripción opcional, de hasta 500 caracteres [RF-M1-13]. Sin el campo, no tiene. */
  readonly description?: string;
  /** Unidad de venta ("rollo", "par", "hora") de lo que se cobra por pieza o servicio [RF-M1-11]. Sin el
   *  campo, se lee como antes ("pieza" o "servicio"). */
  readonly saleUnitName?: string;
  /** Componentes del paquete; solo y siempre en un producto `BUNDLE` [RF-M1-18]. */
  readonly bundleItems?: readonly BundleItem[];
  /** Se vende con hasta 3 decimales (1.5 kg, 2.5 h): solo lo que se cobra por pieza o servicio y dice su
   *  unidad de venta [RF-M1-12, ADR-0048]. Sin el campo, la cantidad es entera. */
  readonly allowsDecimalQuantity?: boolean;
}

/** Largo máximo de la descripción de un producto [RF-M1-13]. */
export const MAX_DESCRIPTION_LENGTH = 500;

/** Lo que se captura para dar de alta un producto: todo menos el identificador. */
export type ProductDraft = Omit<Product, 'id'>;

/** Un cambio en el precio de lista: el historial no se modifica ni se borra [RF-M1-06, RN-19]. */
export interface PriceChange {
  readonly productId: ProductId;
  readonly oldPrice: Money;
  readonly newPrice: Money;
  readonly changedAt: Date;
}

export type ProductErrorCode =
  | 'NAME_REQUIRED'
  | 'PRICE_NEGATIVE'
  /** El tipo no admite esa unidad de cobro (un servicio no se cobra por m², una pieza estándar sí por pieza). */
  | 'KIND_UNIT_MISMATCH'
  /** La regla de precio no corresponde a la unidad de cobro. */
  | 'RULE_UNIT_MISMATCH'
  | 'RULE_NOT_REGISTERED'
  | 'RULE_PARAMS_INVALID'
  | 'FISCAL_INVALID'
  | 'WARRANTY_INVALID'
  /** Un cargo extra copia su precio del catálogo a la pieza: no puede tener precio abierto. */
  | 'OPEN_PRICE_NOT_ALLOWED'
  | 'DESCRIPTION_TOO_LONG'
  /** La unidad de venta es solo para lo que se cobra por pieza o por servicio [RF-M1-11]. */
  | 'SALE_UNIT_NOT_ALLOWED'
  | 'SALE_UNIT_TOO_LONG'
  /** Con decimales solo se vende lo que se cobra por pieza o servicio, con su unidad de venta, y que no es
   *  cargo extra ni paquete [RF-M1-12]. */
  | 'DECIMAL_QUANTITY_NOT_ALLOWED'
  /** Un paquete necesita de 1 a 20 componentes distintos, cada uno con cantidad entera de 1 en adelante; y
   *  solo un paquete lleva componentes [RF-M1-18]. */
  | 'BUNDLE_ITEMS_INVALID';

export interface ProductError {
  readonly code: ProductErrorCode;
}

const UNIDADES_POR_TIPO: Record<ProductKind, readonly ChargeUnit[]> = {
  CUSTOM: ['SQUARE_METER', 'LINEAR_METER', 'PIECE'],
  STANDARD: ['PIECE'],
  SERVICE: ['SERVICE'],
  // m² por omisión (lo que dijo Luis); metro lineal y pieza para no tocar código si alguno se cobra distinto.
  EXTRA: ['SQUARE_METER', 'LINEAR_METER', 'PIECE'],
  // El paquete no se cobra solo: cada componente lleva su unidad. Se guarda como pieza para que la tabla valga.
  BUNDLE: ['PIECE'],
};

/** Unidad que cobra cada regla de hoy. Una regla nueva no declarada aquí no restringe la unidad. */
const UNIDAD_POR_REGLA: Readonly<Record<string, ChargeUnit>> = {
  AREA: 'SQUARE_METER',
  LINEAR: 'LINEAR_METER',
  PIECE: 'PIECE',
  SERVICE: 'SERVICE',
};

// Formatos del catálogo del SAT; los valores concretos se validan con el contador (PD-29).
const CLAVE_PRODUCTO = /^\d{8}$/;
const CLAVE_UNIDAD = /^[A-Z0-9]{2,3}$/;
const OBJETO_IMPUESTO = /^\d{2}$/;

/** Medida de prueba para comprobar que los parámetros de una regla son válidos sin calcular un precio real. */
const MEDIDA_DE_PRUEBA = 1000 as Millimeters;

/** Clave de producto o servicio del SAT: 8 dígitos [RF-M1-11]. */
export function isProductServiceKey(texto: string): boolean {
  return CLAVE_PRODUCTO.test(texto);
}

/** Clave de unidad del SAT: 2 o 3 letras mayúsculas o dígitos (H87, E48, KGM) [RF-M1-11]. */
export function isUnitKey(texto: string): boolean {
  return CLAVE_UNIDAD.test(texto);
}

/** Un paquete lleva de 1 a 20 componentes distintos con cantidad entera positiva; lo demás, ninguno. Que los
 *  componentes existan y se puedan vender lo revisa `checkBundleItems`, que conoce el catálogo. */
function componentesValidos(borrador: ProductDraft): boolean {
  const items = borrador.bundleItems ?? [];
  if (borrador.kind !== 'BUNDLE') {
    return items.length === 0;
  }
  return (
    items.length >= 1 &&
    items.length <= MAX_BUNDLE_ITEMS &&
    new Set(items.map((i) => i.productId)).size === items.length &&
    items.every((i) => Number.isSafeInteger(i.quantity) && i.quantity >= 1)
  );
}

/** Formato de las claves fiscales (vacías o con la forma del catálogo del SAT). */
export function fiscalDataIsValid(fiscal: FiscalData): boolean {
  return fiscalValido(fiscal);
}

function fiscalValido(fiscal: FiscalData): boolean {
  return (
    (fiscal.productServiceKey === null || CLAVE_PRODUCTO.test(fiscal.productServiceKey)) &&
    (fiscal.unitKey === null || CLAVE_UNIDAD.test(fiscal.unitKey)) &&
    (fiscal.taxObject === null || OBJETO_IMPUESTO.test(fiscal.taxObject))
  );
}

/** Valida un producto antes de guardarlo y lo normaliza (nombre y código sin espacios sobrantes).
 *  Una regla de precio con parámetros que no valen se detecta aquí, no al cotizar. */
export function buildProduct(
  id: ProductId,
  borrador: ProductDraft,
  reglas: PriceRegistry,
): Result<Product, ProductError> {
  const name = borrador.name.trim();
  if (name === '') {
    return err({ code: 'NAME_REQUIRED' });
  }
  if (borrador.listPrice < 0) {
    return err({ code: 'PRICE_NEGATIVE' });
  }
  if (!UNIDADES_POR_TIPO[borrador.kind].includes(borrador.chargeUnit)) {
    return err({ code: 'KIND_UNIT_MISMATCH' });
  }
  if (borrador.isOpenPrice === true && (borrador.kind === 'EXTRA' || borrador.kind === 'BUNDLE')) {
    return err({ code: 'OPEN_PRICE_NOT_ALLOWED' });
  }
  if (!componentesValidos(borrador)) {
    return err({ code: 'BUNDLE_ITEMS_INVALID' });
  }
  if (!reglas.has(borrador.ruleId)) {
    return err({ code: 'RULE_NOT_REGISTERED' });
  }
  const unidadDeLaRegla = UNIDAD_POR_REGLA[borrador.ruleId];
  if (unidadDeLaRegla !== undefined && unidadDeLaRegla !== borrador.chargeUnit) {
    return err({ code: 'RULE_UNIT_MISMATCH' });
  }
  const prueba = reglas.calculate(borrador.ruleId, borrador.ruleParams, {
    unitPrice: ZERO,
    widthMm: MEDIDA_DE_PRUEBA,
    heightMm: MEDIDA_DE_PRUEBA,
    quantity: 1,
    displayUnit: 'm',
  });
  if (!prueba.ok && prueba.error.code === 'PARAMS_INVALID') {
    return err({ code: 'RULE_PARAMS_INVALID' });
  }
  if (!fiscalValido(borrador.fiscal)) {
    return err({ code: 'FISCAL_INVALID' });
  }
  if (
    borrador.warrantyMonths !== null &&
    (!Number.isInteger(borrador.warrantyMonths) || borrador.warrantyMonths <= 0)
  ) {
    return err({ code: 'WARRANTY_INVALID' });
  }
  const descripcion = borrador.description?.trim() ?? '';
  if (descripcion.length > MAX_DESCRIPTION_LENGTH) {
    return err({ code: 'DESCRIPTION_TOO_LONG' });
  }
  const unidadDeVenta = borrador.saleUnitName?.trim() ?? '';
  if (
    unidadDeVenta !== '' &&
    borrador.chargeUnit !== 'PIECE' &&
    borrador.chargeUnit !== 'SERVICE'
  ) {
    return err({ code: 'SALE_UNIT_NOT_ALLOWED' });
  }
  if (unidadDeVenta.length > MAX_SALE_UNIT_LENGTH) {
    return err({ code: 'SALE_UNIT_TOO_LONG' });
  }
  if (
    borrador.allowsDecimalQuantity === true &&
    ((borrador.chargeUnit !== 'PIECE' && borrador.chargeUnit !== 'SERVICE') ||
      unidadDeVenta === '' ||
      borrador.kind === 'EXTRA' ||
      borrador.kind === 'BUNDLE')
  ) {
    return err({ code: 'DECIMAL_QUANTITY_NOT_ALLOWED' });
  }
  const code = borrador.code === null ? null : borrador.code.trim();
  // Una descripción o unidad en blanco no se guarda: el producto queda sin el campo, igual que uno de antes.
  const resto = Object.fromEntries(
    Object.entries(borrador).filter(
      ([campo]) =>
        campo !== 'description' &&
        campo !== 'saleUnitName' &&
        campo !== 'bundleItems' &&
        campo !== 'allowsDecimalQuantity',
    ),
  ) as unknown as ProductDraft;
  return ok({
    ...resto,
    id,
    name,
    code: code === '' ? null : code,
    ...(descripcion === '' ? {} : { description: descripcion }),
    ...(unidadDeVenta === '' ? {} : { saleUnitName: unidadDeVenta }),
    ...(borrador.kind === 'BUNDLE' ? { bundleItems: borrador.bundleItems ?? [] } : {}),
    ...(borrador.allowsDecimalQuantity === true ? { allowsDecimalQuantity: true } : {}),
  });
}
