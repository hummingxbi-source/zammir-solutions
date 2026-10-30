import type { CategoryId, ProductId } from '../../../shared-kernel/id';
import type { Millimeters } from '../../../shared-kernel/measure/length';
import { ZERO, type Money } from '../../../shared-kernel/money/money';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { PriceRegistry } from './pricing/registry';

/** Tipo de producto [RN-01]: a medida, pieza estándar o servicio. */
export type ProductKind = 'CUSTOM' | 'STANDARD' | 'SERVICE';

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
}

/** Lo que se captura para dar de alta un producto: todo menos el identificador. */
export type ProductDraft = Omit<Product, 'id'>;

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
  | 'WARRANTY_INVALID';

export interface ProductError {
  readonly code: ProductErrorCode;
}

const UNIDADES_POR_TIPO: Record<ProductKind, readonly ChargeUnit[]> = {
  CUSTOM: ['SQUARE_METER', 'LINEAR_METER', 'PIECE'],
  STANDARD: ['PIECE'],
  SERVICE: ['SERVICE'],
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
  const code = borrador.code === null ? null : borrador.code.trim();
  return ok({ ...borrador, id, name, code: code === '' ? null : code });
}
