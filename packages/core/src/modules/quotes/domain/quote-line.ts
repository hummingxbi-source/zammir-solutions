import type { LengthUnit, Millimeters } from '../../../shared-kernel/measure/length';
import { money, type Money } from '../../../shared-kernel/money/money';
import { err, ok, type Result } from '../../../shared-kernel/result';
import { splitTax } from '../../../shared-kernel/tax/tax';
import type { ProductId } from '../../../shared-kernel/id';
import { formatPriceDetail } from '../../catalog/domain/pricing/detail';
import type { PriceRegistry } from '../../catalog/domain/pricing/registry';
import type { LineExtra, QuoteLine } from './quote';

export type QuoteLineErrorCode =
  /** Medidas, cantidad o precio que la regla del producto no acepta. */
  | 'INPUT_INVALID'
  | 'RULE_NOT_REGISTERED'
  | 'PARAMS_INVALID'
  /** Un importe no cabe en un entero seguro, o el IVA no se pudo calcular. */
  | 'AMOUNT_INVALID'
  /** El precio ajustado no puede ser negativo ni mayor que el del catálogo. */
  | 'PRICE_INVALID'
  /** Un cargo extra por m² o metro lineal necesita una línea con medidas; o no es un cargo extra. */
  | 'EXTRA_INVALID';

export interface QuoteLineError {
  readonly code: QuoteLineErrorCode;
}

/** Lo que la cotización necesita de un producto del catálogo; un `SellableProduct` lo cumple. */
export interface QuoteProduct {
  readonly id: ProductId;
  readonly name: string;
  readonly chargeUnit: QuoteLine['chargeUnit'];
  readonly listPrice: Money;
  readonly isTaxExempt: boolean;
  readonly ruleId: string;
  readonly ruleParams: unknown;
  /** Precio abierto [RF-M1-10, ADR-0048]: el precio del catálogo es de referencia y se puede fijar más
   *  arriba al cotizar o vender. Sin el campo, el precio es fijo. */
  readonly isOpenPrice?: boolean;
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

/** Lo que define un cargo extra antes de calcularlo con la medida de la línea. */
type ExtraSinImporte = Omit<LineExtra, 'amountCents'>;

/** Calcula un cargo extra con SU regla y la medida de la línea: m² con el área de la pieza, metro lineal con su
 *  perímetro o largo, pieza con su propia cantidad [RF-M1-09]. Mismas funciones de redondeo que la línea. */
function calcularExtra(
  extra: ExtraSinImporte,
  entrada: LineInput,
  deps: LineDeps,
): Result<{ readonly extra: LineExtra; readonly detalle: string }, QuoteLineError> {
  const precio = aMoney(extra.unitPriceCents);
  if (!precio.ok) {
    return precio;
  }
  const porPieza = extra.chargeUnit === 'PIECE';
  if (
    !porPieza &&
    (entrada.widthMm === null || (extra.chargeUnit === 'SQUARE_METER' && entrada.heightMm === null))
  ) {
    return err({ code: 'EXTRA_INVALID' });
  }
  const calculo = deps.registry.calculate(extra.ruleId, extra.ruleParams, {
    unitPrice: precio.value,
    widthMm: porPieza ? null : (entrada.widthMm as Millimeters | null),
    heightMm: porPieza ? null : (entrada.heightMm as Millimeters | null),
    quantity: porPieza ? extra.quantity : entrada.quantity,
    displayUnit: entrada.displayUnit,
  });
  if (!calculo.ok) {
    return err({ code: 'EXTRA_INVALID' });
  }
  return ok({
    extra: { ...extra, amountCents: calculo.value.amount },
    detalle: `+ ${extra.name}: ${formatPriceDetail(calculo.value)}`,
  });
}

/** Calcula una línea con la regla de precio del producto, le suma sus cargos extra y desglosa su IVA. Es la
 *  única ruta por la que se arma una línea: pantalla, descuentos y duplicados usan esta misma función. Los
 *  extras se suman ANTES de separar el IVA, así base + IVA = total sigue valiendo al centavo [RF-M1-09]. */
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
    | 'extras'
    | 'isOpenPrice'
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
  const extras: LineExtra[] = [];
  const detalles: string[] = [];
  let importe: number = calculo.value.amount;
  for (const e of base.extras ?? []) {
    const r = calcularExtra(e, entrada, deps);
    if (!r.ok) {
      return r;
    }
    extras.push(r.value.extra);
    detalles.push(r.value.detalle);
    importe += r.value.extra.amountCents;
  }
  const total = money(importe);
  if (!total.ok) {
    return err({ code: 'AMOUNT_INVALID' });
  }
  const desglose = splitTax(total.value, deps.taxRateBps, base.isTaxExempt);
  if (!desglose.ok) {
    return err({ code: 'AMOUNT_INVALID' });
  }
  const detalle = formatPriceDetail(calculo.value);
  return ok({
    ...base,
    ...(extras.length === 0 ? {} : { extras }),
    id: entrada.id,
    unitPriceCents,
    widthMm: entrada.widthMm,
    heightMm: entrada.heightMm,
    quantity: entrada.quantity,
    displayUnit: entrada.displayUnit,
    baseCents: desglose.value.base,
    taxCents: desglose.value.tax,
    lineTotalCents: desglose.value.total,
    detail: detalles.length === 0 ? detalle : [detalle, ...detalles].join(' '),
  });
}

/** Agrega a la línea un cargo extra del catálogo (cantos, perforaciones, biselados) [RF-M1-09, ADR-0044]. El
 *  precio se copia del catálogo; `cantidad` solo cuenta si el extra se cobra por pieza. Si ya estaba, se
 *  reemplaza. */
export function addLineExtra(
  linea: QuoteLine,
  extra: QuoteProduct & { readonly kind?: string },
  cantidad: number,
  deps: LineDeps,
): Result<QuoteLine, QuoteLineError> {
  if (extra.kind !== undefined && extra.kind !== 'EXTRA') {
    return err({ code: 'EXTRA_INVALID' });
  }
  if (extra.chargeUnit === 'SERVICE' || !Number.isSafeInteger(cantidad) || cantidad < 1) {
    return err({ code: 'EXTRA_INVALID' });
  }
  const otros = (linea.extras ?? []).filter((e) => e.productId !== extra.id);
  return calcularLinea(
    {
      ...linea,
      extras: [
        ...otros,
        {
          productId: extra.id,
          name: extra.name,
          chargeUnit: extra.chargeUnit,
          unitPriceCents: extra.listPrice,
          ruleId: extra.ruleId,
          ruleParams: extra.ruleParams,
          quantity: cantidad,
          amountCents: 0,
        },
      ],
    },
    linea.unitPriceCents,
    lineaComoEntrada(linea),
    deps,
  );
}

/** Quita un cargo extra de la línea y la vuelve a calcular. */
export function removeLineExtra(
  linea: QuoteLine,
  productId: ProductId,
  deps: LineDeps,
): Result<QuoteLine, QuoteLineError> {
  const extras = (linea.extras ?? []).filter((e) => e.productId !== productId);
  // Sin extras, la línea queda sin el campo, igual que una línea que nunca tuvo.
  const sinExtras: QuoteLine = Object.fromEntries(
    Object.entries(linea).filter(([campo]) => campo !== 'extras'),
  ) as unknown as QuoteLine;
  return calcularLinea(
    extras.length === 0 ? sinExtras : { ...sinExtras, extras },
    linea.unitPriceCents,
    lineaComoEntrada(linea),
    deps,
  );
}

function lineaComoEntrada(linea: QuoteLine): LineInput {
  return {
    id: linea.id,
    widthMm: linea.widthMm,
    heightMm: linea.heightMm,
    quantity: linea.quantity,
    displayUnit: linea.displayUnit,
  };
}

/** Arma una línea desde un producto del catálogo, con su precio del catálogo [RF-M2-02, RN-04]. */
export function buildQuoteLine(
  producto: QuoteProduct,
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
      ...(producto.isOpenPrice === true ? { isOpenPrice: true } : {}),
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

/** Cambia el precio unitario de una línea (descuento o ajuste). Nunca negativo. Solo sube del precio del
 *  catálogo si el producto tiene precio abierto [RF-M1-10, ADR-0048]. El permiso lo valida el caso de uso. */
export function repriceQuoteLine(
  linea: QuoteLine,
  nuevoPrecioCents: number,
  deps: LineDeps,
): Result<QuoteLine, QuoteLineError> {
  if (
    !Number.isSafeInteger(nuevoPrecioCents) ||
    nuevoPrecioCents < 0 ||
    (nuevoPrecioCents > linea.catalogPriceCents && linea.isOpenPrice !== true)
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
