import { z } from 'zod';

import type { Millimeters } from '../../../../shared-kernel/measure/length';
import { multiply, type Money } from '../../../../shared-kernel/money/money';
import { err, ok, type Result } from '../../../../shared-kernel/result';
import { areaAmount, linearAmount } from '../../../../shared-kernel/tax/tax';
import type { PriceAdjustment, PriceError, PriceInput, PriceResult, PriceRule } from './types';

/** Define una regla: valida los parámetros con su esquema, la entrada de la línea, y entrega
 *  los parámetros ya tipados al cálculo. */
function defineRule<P>(
  id: string,
  esquema: z.ZodType<P>,
  calcular: (entrada: PriceInput, parametros: P) => Result<PriceResult, PriceError>,
): PriceRule {
  return {
    id,
    calculate(entrada, crudos) {
      const parametros = esquema.safeParse(crudos);
      if (!parametros.success) {
        return err({ code: 'PARAMS_INVALID' });
      }
      const medidasValidas = [entrada.widthMm, entrada.heightMm].every(
        (medida) => medida === null || (Number.isInteger(medida) && medida > 0),
      );
      if (
        !medidasValidas ||
        !Number.isInteger(entrada.quantity) ||
        entrada.quantity <= 0 ||
        entrada.unitPrice < 0
      ) {
        return err({ code: 'INPUT_INVALID' });
      }
      return calcular(entrada, parametros.data);
    },
  };
}

const enteroPositivo = z.number().int().positive();
// Un valor `null` o ausente significa "apagado": así llegan los pendientes de PD-02.
const medidaOpcional = enteroPositivo.nullish();
// Zod solo deja pasar enteros seguros, por eso el monto ya es válido; la marca solo existe al compilar.
const minimoOpcional = z
  .number()
  .int()
  .nonnegative()
  .transform((centavos) => centavos as Money)
  .nullish();

const paramsArea = z.strictObject({
  measureStepMm: medidaOpcional,
  minAreaMm2: medidaOpcional,
  minAmountCents: minimoOpcional,
});

const paramsLineal = z.strictObject({
  /** PD-25: largo capturado o perímetro. No tiene valor por omisión: lo define cada producto. */
  basis: z.enum(['LENGTH', 'PERIMETER']),
  measureStepMm: medidaOpcional,
  minAmountCents: minimoOpcional,
});

const paramsSinAjustes = z.strictObject({});

/** Sube una medida al siguiente múltiplo del paso (redondeo de medidas, PD-02). */
function subirAlPaso(medida: number, paso: number): number {
  return Math.ceil(medida / paso) * paso;
}

/** Aplica el mínimo por trabajo si el importe calculado queda por debajo. */
function conMinimo(
  calculado: Money,
  minimo: Money | null | undefined,
  ajustes: PriceAdjustment[],
): Money {
  if (minimo === null || minimo === undefined || calculado >= minimo) {
    return calculado;
  }
  ajustes.push({ kind: 'MIN_AMOUNT', minAmount: minimo, calculated: calculado });
  return minimo;
}

function ajustarPaso(paso: number | null | undefined, medida: number): number {
  return paso === null || paso === undefined ? medida : subirAlPaso(medida, paso);
}

/** Deja constancia de que las medidas se subieron al paso configurado. */
function anotarPaso(paso: number | null | undefined, ajustes: PriceAdjustment[]): void {
  if (paso !== null && paso !== undefined) {
    ajustes.push({ kind: 'MEASURE_STEP', stepMm: paso });
  }
}

function conAncho(entrada: PriceInput): Millimeters | null {
  return entrada.widthMm;
}

function conAnchoYAlto(entrada: PriceInput): { ancho: Millimeters; alto: Millimeters } | null {
  return entrada.widthMm === null || entrada.heightMm === null
    ? null
    : { ancho: entrada.widthMm, alto: entrada.heightMm };
}

// Con las entradas ya validadas, lo único que puede fallar en el cálculo es salirse del rango.
const FUERA_DE_RANGO: PriceError = { code: 'OUT_OF_RANGE' };

/** Producto a medida por m²: `precio × ancho × alto × cantidad`. */
export const reglaPorArea: PriceRule = defineRule('AREA', paramsArea, (entrada, p) => {
  const medida = conAnchoYAlto(entrada);
  if (medida === null) {
    return err({ code: 'INPUT_INVALID' });
  }
  const ajustes: PriceAdjustment[] = [];
  anotarPaso(p.measureStepMm, ajustes);
  const ancho = ajustarPaso(p.measureStepMm, medida.ancho);
  const alto = ajustarPaso(p.measureStepMm, medida.alto);
  let area = ancho * alto;
  if (p.minAreaMm2 !== null && p.minAreaMm2 !== undefined && area < p.minAreaMm2) {
    area = p.minAreaMm2;
    ajustes.push({ kind: 'MIN_AREA', minAreaMm2: p.minAreaMm2 });
  }
  const calculado = areaAmount(entrada.unitPrice, area, entrada.quantity);
  if (!calculado.ok) {
    return err(FUERA_DE_RANGO);
  }
  return ok({
    amount: conMinimo(calculado.value, p.minAmountCents, ajustes),
    unitPrice: entrada.unitPrice,
    detail: {
      kind: 'AREA',
      widthMm: ancho,
      heightMm: alto,
      quantity: entrada.quantity,
      areaMm2: area,
      displayUnit: entrada.displayUnit,
    },
    adjustments: ajustes,
  });
});

/** Producto por metro lineal. La base (largo capturado o perímetro) la fija cada producto [PD-25]. */
export const reglaPorMetroLineal: PriceRule = defineRule('LINEAR', paramsLineal, (entrada, p) => {
  const ajustes: PriceAdjustment[] = [];
  anotarPaso(p.measureStepMm, ajustes);
  let ancho: number;
  let alto: number | null = null;
  if (p.basis === 'LENGTH') {
    const largo = conAncho(entrada);
    if (largo === null) {
      return err({ code: 'INPUT_INVALID' });
    }
    ancho = ajustarPaso(p.measureStepMm, largo);
  } else {
    const medida = conAnchoYAlto(entrada);
    if (medida === null) {
      return err({ code: 'INPUT_INVALID' });
    }
    ancho = ajustarPaso(p.measureStepMm, medida.ancho);
    alto = ajustarPaso(p.measureStepMm, medida.alto);
  }
  const largo = alto === null ? ancho : 2 * (ancho + alto);
  const calculado = linearAmount(entrada.unitPrice, largo, entrada.quantity);
  if (!calculado.ok) {
    return err(FUERA_DE_RANGO);
  }
  return ok({
    amount: conMinimo(calculado.value, p.minAmountCents, ajustes),
    unitPrice: entrada.unitPrice,
    detail: {
      kind: 'LINEAR',
      basis: p.basis,
      widthMm: ancho,
      heightMm: alto,
      lengthMm: largo,
      quantity: entrada.quantity,
      displayUnit: entrada.displayUnit,
    },
    adjustments: ajustes,
  });
});

function porUnidades(kind: 'PIECE' | 'SERVICE') {
  return (entrada: PriceInput): Result<PriceResult, PriceError> => {
    const importe = multiply(entrada.unitPrice, entrada.quantity);
    if (!importe.ok) {
      return err(FUERA_DE_RANGO);
    }
    return ok({
      amount: importe.value,
      unitPrice: entrada.unitPrice,
      detail: { kind, quantity: entrada.quantity },
      adjustments: [],
    });
  };
}

/** Pieza estándar: precio por pieza × cantidad. */
export const reglaPorPieza: PriceRule = defineRule('PIECE', paramsSinAjustes, porUnidades('PIECE'));

/** Servicio (visita o unidad): precio × cantidad. */
export const reglaDeServicio: PriceRule = defineRule(
  'SERVICE',
  paramsSinAjustes,
  porUnidades('SERVICE'),
);
