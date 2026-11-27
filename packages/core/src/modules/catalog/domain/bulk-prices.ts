import type { CategoryId } from '../../../shared-kernel/id';
import {
  changeByPercentToPeso,
  type Money,
  type PesoRounding,
} from '../../../shared-kernel/money/money';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { Product } from './product';

/** Un cambio de precio en bloque, listo para la vista previa: antes y después [RF-M1-15]. */
export interface BulkPriceChange {
  readonly product: Product;
  readonly oldPrice: Money;
  readonly newPrice: Money;
}

export type BulkPriceErrorCode =
  /** El porcentaje no se entiende, es cero, o pasa de los límites (de -99.99 % a +1000 %). */
  | 'PERCENT_INVALID'
  /** Ningún producto activo de la categoría cambiaría de precio. */
  | 'NOTHING_TO_CHANGE'
  /** Algún precio nuevo no cabe en un monto válido. */
  | 'AMOUNT_INVALID';

export interface BulkPriceError {
  readonly code: BulkPriceErrorCode;
}

// Límites contra un error de dedo (escribir 80 en lugar de 8): no son una regla del negocio.
const MINIMO_BPS = -9_999;
const MAXIMO_BPS = 100_000;

/** Lee un porcentaje escrito ("8", "+8", "-5", "2.5", "2.25 %") y lo devuelve en puntos base (800, -500…).
 *  Con texto y enteros, sin flotantes. */
export function parsePercent(texto: string): Result<number, BulkPriceError> {
  const partes = /^([+-]?)(\d{1,4})(?:\.(\d{1,2}))?\s*%?$/.exec(texto.trim());
  if (partes === null) {
    return err({ code: 'PERCENT_INVALID' });
  }
  const valor = Number(partes[2]) * 100 + Number((partes[3] ?? '').padEnd(2, '0'));
  const bps = partes[1] === '-' ? -valor : valor;
  if (bps === 0 || bps < MINIMO_BPS || bps > MAXIMO_BPS) {
    return err({ code: 'PERCENT_INVALID' });
  }
  return ok(bps);
}

/** Lo que cambiaría al subir o bajar por porcentaje los precios de una categoría [RF-M1-15, ADR-0048]: solo
 *  sus productos activos, cada precio redondeado al peso como se pida (por omisión hacia arriba, D3), y solo
 *  los que sí cambian. No guarda nada: es la vista previa. */
export function previewCategoryPriceChange(
  productos: readonly Product[],
  categoria: CategoryId,
  puntosBase: number,
  redondeo: PesoRounding = 'UP',
): Result<readonly BulkPriceChange[], BulkPriceError> {
  if (!Number.isSafeInteger(puntosBase) || puntosBase === 0) {
    return err({ code: 'PERCENT_INVALID' });
  }
  const cambios: BulkPriceChange[] = [];
  for (const p of productos) {
    if (p.categoryId !== categoria || !p.isActive) continue;
    const nuevo = changeByPercentToPeso(p.listPrice, puntosBase, redondeo);
    if (!nuevo.ok) {
      return err({
        code: nuevo.error.code === 'NEGATIVE_RESULT' ? 'PERCENT_INVALID' : 'AMOUNT_INVALID',
      });
    }
    if (nuevo.value !== p.listPrice) {
      cambios.push({ product: p, oldPrice: p.listPrice, newPrice: nuevo.value });
    }
  }
  if (cambios.length === 0) {
    return err({ code: 'NOTHING_TO_CHANGE' });
  }
  return ok(cambios);
}
