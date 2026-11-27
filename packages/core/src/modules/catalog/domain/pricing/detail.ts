import type { LengthUnit } from '../../../../shared-kernel/measure/length';
import { formatMoney } from '../../../../shared-kernel/money/money';
import { saleUnitFor } from '../sale-unit';
import { readAdjustments } from './adjustments';
import type { PriceAdjustment, PriceResult } from './types';

/** Número con `escala` unidades por entero, solo con aritmética de enteros: 1255 mm en metros es
 *  `1.255`. Quita ceros finales pero deja al menos `minDecimales`. */
function decimal(valor: number, escala: number, decimales: number, minDecimales: number): string {
  const enteros = Math.floor(valor / escala);
  const fraccion = String(valor % escala)
    .padStart(decimales, '0')
    .replace(/0+$/, '')
    .padEnd(minDecimales, '0');
  return fraccion === '' ? String(enteros) : `${String(enteros)}.${fraccion}`;
}

/** La cifra de una longitud en la unidad que se usa, sin la unidad. */
function cifra(mm: number, unidad: LengthUnit): string {
  return unidad === 'm' ? decimal(mm, 1000, 3, 2) : decimal(mm, 10, 1, 0);
}

function longitud(mm: number, unidad: LengthUnit): string {
  return `${cifra(mm, unidad)} ${unidad}`;
}

function metros(mm: number): string {
  return `${decimal(mm, 1000, 3, 2)} m`;
}

function metrosCuadrados(mm2: number): string {
  return `${decimal(mm2, 1_000_000, 6, 2)} m²`;
}

function nota(ajuste: PriceAdjustment): string {
  switch (ajuste.kind) {
    case 'MEASURE_STEP':
      return `medidas subidas a múltiplos de ${String(ajuste.stepMm)} mm`;
    case 'MIN_AREA':
      return `área mínima ${metrosCuadrados(ajuste.minAreaMm2)}`;
    case 'MIN_AMOUNT':
      return `calculado ${formatMoney(ajuste.calculated)}; mínimo del trabajo ${formatMoney(ajuste.minAmount)}`;
  }
}

/** El cálculo a la vista, con las unidades claras [RN-04]. Ejemplo:
 *  `1.20 m × 0.80 m = 0.96 m² × $280.00 = $268.80`. Con unidad de venta, la cantidad la dice:
 *  `2 rollos × $45.00 = $90.00` [RF-M1-11]. */
export function formatPriceDetail(resultado: PriceResult, unidadDeVenta?: string): string {
  const { detail, unitPrice, amount } = resultado;
  const precio = formatMoney(unitPrice);
  const importe = formatMoney(amount);
  let texto: string;
  switch (detail.kind) {
    case 'AREA': {
      const medidas = `${longitud(detail.widthMm, detail.displayUnit)} × ${longitud(detail.heightMm, detail.displayUnit)}`;
      const total = metrosCuadrados(detail.areaMm2 * detail.quantity);
      texto =
        detail.quantity === 1
          ? `${medidas} = ${total} × ${precio} = ${importe}`
          : `${medidas} × ${String(detail.quantity)} = ${total} × ${precio} = ${importe}`;
      break;
    }
    case 'LINEAR': {
      const captura =
        detail.heightMm === null
          ? metros(detail.lengthMm)
          : `2 × (${metros(detail.widthMm)} + ${metros(detail.heightMm)}) = ${metros(detail.lengthMm)}`;
      texto =
        detail.quantity === 1
          ? `${captura} × ${precio} = ${importe}`
          : `${captura} × ${String(detail.quantity)} = ${metros(detail.lengthMm * detail.quantity)} × ${precio} = ${importe}`;
      break;
    }
    case 'PIECE':
    case 'SERVICE':
      texto =
        unidadDeVenta === undefined
          ? `${String(detail.quantity)} × ${precio} = ${importe}`
          : `${String(detail.quantity)} ${saleUnitFor(detail.quantity, unidadDeVenta)} × ${precio} = ${importe}`;
      break;
  }
  const notas = resultado.adjustments.map(nota);
  return notas.length === 0 ? texto : `${texto} (${notas.join('; ')})`;
}

/** La medida máxima del producto para avisarla al capturar, en la unidad que se usa: "180 × 260 cm",
 *  "ancho 180 cm" o "largo 610 cm". `null` si no tiene [RF-M1-14]. */
export function formatMaxMeasure(ruleParams: unknown, unidad: LengthUnit): string | null {
  const { maxWidthMm: ancho, maxHeightMm: alto } = readAdjustments(ruleParams);
  const porLargo = (ruleParams as { basis?: unknown } | null)?.basis === 'LENGTH';
  if (porLargo) {
    return ancho === null ? null : `largo ${longitud(ancho, unidad)}`;
  }
  if (ancho !== null && alto !== null) {
    return `${cifra(ancho, unidad)} × ${longitud(alto, unidad)}`;
  }
  if (ancho !== null) return `ancho ${longitud(ancho, unidad)}`;
  if (alto !== null) return `alto ${longitud(alto, unidad)}`;
  return null;
}
