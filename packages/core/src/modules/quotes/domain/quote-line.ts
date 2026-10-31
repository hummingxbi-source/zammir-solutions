import type { LengthUnit, Millimeters } from '../../../shared-kernel/measure/length';
import { money, type Money } from '../../../shared-kernel/money/money';
import { err, ok, type Result } from '../../../shared-kernel/result';
import { splitTax } from '../../../shared-kernel/tax/tax';
import type { SellableProduct } from '../../catalog/application/ports';
import { formatPriceDetail } from '../../catalog/domain/pricing/detail';
import type { PriceRegistry } from '../../catalog/domain/pricing/registry';
import type { QuoteLine } from './quote';

export type QuoteLineErrorCode =
  /** Medidas, cantidad o precio que la regla del producto no acepta. */
  | 'INPUT_INVALID'
  | 'RULE_NOT_REGISTERED'
  | 'PARAMS_INVALID'
  /** Un importe no cabe en un entero seguro, o el IVA no se pudo calcular. */
  | 'AMOUNT_INVALID'
  /** El precio ajustado no puede ser negativo ni mayor que el del catálogo. */
  | 'PRICE_INVALID';

export interface QuoteLineError {
  readonly code: QuoteLineErrorCode;
}

export interface LineInput {
  readonly id: string;
  /** Anchos y altos en mm enteros (ya convertidos con `parseLength`). */
  readonly widthMm: number | null;
  readonly heightMm: number | null;
  readonly quantity: number;
  /** Unidad en que la persona capturó; así se muestra el cálculo. */
  readonly displayUnit: LengthUnit;
}

export interface LineDeps {
  readonly registry: PriceRegistry;
  /** Tasa de IVA en puntos base (1600 = 16 %). */
  readonly taxRateBps: number;
}

function codigoDeLinea(codigo: string): QuoteLineErrorCode {
  return codigo === 'RULE_NOT_REGISTERED' || codigo === 'PARAMS_INVALID' ? codigo : 'INPUT_INVALID';
}

function aMoney(centavos: number): Result<Money, QuoteLineError> {
  const r = money(centavos);
  return r.ok ? r : err({ code: 'PRICE_INVALID' });
}

/** Calcula una línea con la regla de precio del producto y desglosa su IVA. Es la única ruta por la que
 *  se arma una línea: pantalla, descuentos y duplicados usan esta misma función. */
function calcularLinea(
  base: Pick<
    QuoteLine,
    | 'productId'
    | 'name'
    | 'chargeUnit'
    | 'ruleId'
    | 'ruleParams'
    | 'isTaxExempt'
    | 'catalogPriceCents'
  >,
  unitPriceCents: number,
  entrada: LineInput,
  deps: LineDeps,
): Result<QuoteLine, QuoteLineError> {
  const precio = aMoney(unitPriceCents);
  if (!precio.ok) {
    return precio;
  }
  const calculo = deps.registry.calculate(base.ruleId, base.ruleParams, {
    unitPrice: precio.value,
    widthMm: entrada.widthMm as Millimeters | null, // ya validadas en mm enteros por quien captura
    heightMm: entrada.heightMm as Millimeters | null,
    quantity: entrada.quantity,
    displayUnit: entrada.displayUnit,
  });
  if (!calculo.ok) {
    return err({ code: codigoDeLinea(calculo.error.code) });
  }
  const desglose = splitTax(calculo.value.amount, deps.taxRateBps, base.isTaxExempt);
  if (!desglose.ok) {
    return err({ code: 'AMOUNT_INVALID' });
  }
  return ok({
    ...base,
    id: entrada.id,
    unitPriceCents,
    widthMm: entrada.widthMm,
    heightMm: entrada.heightMm,
    quantity: entrada.quantity,
    displayUnit: entrada.displayUnit,
    baseCents: desglose.value.base,
    taxCents: desglose.value.tax,
    lineTotalCents: desglose.value.total,
    detail: formatPriceDetail(calculo.value),
  });
}

/** Arma una línea desde un producto del catálogo, con su precio del catálogo [RF-M2-02, RN-04]. */
export function buildQuoteLine(
  producto: SellableProduct,
  entrada: LineInput,
  deps: LineDeps,
): Result<QuoteLine, QuoteLineError> {
  return calcularLinea(
    {
      productId: producto.id,
      name: producto.name,
      chargeUnit: producto.chargeUnit,
      ruleId: producto.ruleId,
      ruleParams: producto.ruleParams,
      isTaxExempt: producto.isTaxExempt,
      catalogPriceCents: producto.listPrice,
    },
    producto.listPrice,
    entrada,
    deps,
  );
}

/** Recalcula una línea con otras medidas o cantidad, conservando su precio actual. */
export function recalculateQuoteLine(
  linea: QuoteLine,
  cambios: Partial<Pick<LineInput, 'widthMm' | 'heightMm' | 'quantity' | 'displayUnit'>>,
  deps: LineDeps,
): Result<QuoteLine, QuoteLineError> {
  return calcularLinea(
    linea,
    linea.unitPriceCents,
    {
      id: linea.id,
      widthMm: cambios.widthMm === undefined ? linea.widthMm : cambios.widthMm,
      heightMm: cambios.heightMm === undefined ? linea.heightMm : cambios.heightMm,
      quantity: cambios.quantity ?? linea.quantity,
      displayUnit: cambios.displayUnit ?? linea.displayUnit,
    },
    deps,
  );
}

/** Cambia el precio unitario de una línea (descuento o ajuste). Nunca negativo ni mayor que el del
 *  catálogo: un aumento no es un descuento y no se hace por aquí. El permiso lo valida el caso de uso. */
export function repriceQuoteLine(
  linea: QuoteLine,
  nuevoPrecioCents: number,
  deps: LineDeps,
): Result<QuoteLine, QuoteLineError> {
  if (
    !Number.isSafeInteger(nuevoPrecioCents) ||
    nuevoPrecioCents < 0 ||
    nuevoPrecioCents > linea.catalogPriceCents
  ) {
    return err({ code: 'PRICE_INVALID' });
  }
  return calcularLinea(
    linea,
    nuevoPrecioCents,
    {
      id: linea.id,
      widthMm: linea.widthMm,
      heightMm: linea.heightMm,
      quantity: linea.quantity,
      displayUnit: linea.displayUnit,
    },
    deps,
  );
}
