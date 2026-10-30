import type { LengthUnit, Millimeters } from '../../../../shared-kernel/measure/length';
import type { Money } from '../../../../shared-kernel/money/money';
import type { Result } from '../../../../shared-kernel/result';

export type PriceErrorCode =
  /** La regla del producto no está registrada. */
  | 'RULE_NOT_REGISTERED'
  /** Ya hay una regla con ese identificador: registrar no reemplaza a las existentes. */
  | 'RULE_ALREADY_REGISTERED'
  /** Los parámetros guardados para la regla no son válidos. */
  | 'PARAMS_INVALID'
  /** Faltan medidas, la cantidad no es válida o el precio es negativo. */
  | 'INPUT_INVALID'
  /** El importe no cabe en un entero seguro. */
  | 'OUT_OF_RANGE';

export interface PriceError {
  readonly code: PriceErrorCode;
}

/** Lo que la regla recibe: el precio de catálogo del producto y lo que se captura en la línea. */
export interface PriceInput {
  /** Precio con IVA incluido en la unidad de cobro: por m², por metro, por pieza o por visita. */
  readonly unitPrice: Money;
  readonly widthMm: Millimeters | null;
  readonly heightMm: Millimeters | null;
  readonly quantity: number;
  /** Unidad en que la persona capturó y en que se muestra el cálculo [RN-04]. */
  readonly displayUnit: LengthUnit;
}

/** Ajustes opcionales que cambiaron el cálculo. Están apagados mientras no se definan [PD-02]. */
export type PriceAdjustment =
  | { readonly kind: 'MEASURE_STEP'; readonly stepMm: number }
  | { readonly kind: 'MIN_AREA'; readonly minAreaMm2: number }
  | { readonly kind: 'MIN_AMOUNT'; readonly minAmount: Money; readonly calculated: Money };

/** Cómo se llegó al importe, en datos; `formatPriceDetail` lo convierte en el texto que se muestra. */
export type PriceDetail =
  | {
      readonly kind: 'AREA';
      readonly widthMm: number;
      readonly heightMm: number;
      readonly quantity: number;
      /** Área de una pieza que se cobró (con ajustes), en mm². */
      readonly areaMm2: number;
      readonly displayUnit: LengthUnit;
    }
  | {
      readonly kind: 'LINEAR';
      readonly basis: 'LENGTH' | 'PERIMETER';
      readonly widthMm: number;
      readonly heightMm: number | null;
      readonly lengthMm: number;
      readonly quantity: number;
      readonly displayUnit: LengthUnit;
    }
  | { readonly kind: 'PIECE'; readonly quantity: number }
  | { readonly kind: 'SERVICE'; readonly quantity: number };

export interface PriceResult {
  readonly amount: Money;
  readonly unitPrice: Money;
  readonly detail: PriceDetail;
  readonly adjustments: readonly PriceAdjustment[];
}

/** Una regla de precio lista para usarse: recibe los parámetros tal como vienen de la base
 *  y los valida ella misma [ADR-0006]. */
export interface PriceRule {
  readonly id: string;
  calculate(input: PriceInput, rawParams: unknown): Result<PriceResult, PriceError>;
}
