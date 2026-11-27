import type { ProductId } from '../../../shared-kernel/id';
import type { LengthUnit } from '../../../shared-kernel/measure/length';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { BundleItem, ChargeUnit, ProductKind } from './product';

/** Lo que un paquete necesita saber de cada componente: sirve un `Product` o un `SellableProduct`. */
export interface BundleComponent {
  readonly id: ProductId;
  readonly kind: ProductKind;
  readonly chargeUnit: ChargeUnit;
  readonly isActive?: boolean;
}

export type BundleErrorCode =
  /** Un componente ya no está en el catálogo (o no se ve en esta tablet). */
  | 'BUNDLE_COMPONENT_NOT_FOUND'
  /** Un componente es un paquete, un cargo extra o está desactivado: no se puede vender así. */
  | 'BUNDLE_COMPONENT_NOT_ALLOWED'
  /** Medidas o cantidad que no sirven para armar los renglones. */
  | 'BUNDLE_INPUT_INVALID';

export interface BundleError {
  readonly code: BundleErrorCode;
}

function midePieza(unidad: ChargeUnit): boolean {
  return unidad === 'SQUARE_METER' || unidad === 'LINEAR_METER';
}

/** Revisa los componentes de un paquete contra el catálogo antes de guardarlo [RF-M1-18]: que existan y que se
 *  vendan como renglón normal (ni paquete, porque no se anidan; ni cargo extra, porque va pegado a una pieza;
 *  ni desactivados). */
export function checkBundleItems(
  items: readonly BundleItem[],
  catalogo: readonly BundleComponent[],
): Result<null, BundleError> {
  const porId = new Map(catalogo.map((p) => [p.id, p]));
  for (const item of items) {
    const p = porId.get(item.productId);
    if (p === undefined) {
      return err({ code: 'BUNDLE_COMPONENT_NOT_FOUND' });
    }
    if (p.kind === 'BUNDLE' || p.kind === 'EXTRA' || p.isActive === false) {
      return err({ code: 'BUNDLE_COMPONENT_NOT_ALLOWED' });
    }
  }
  return ok(null);
}

/** Cómo se cobran los componentes que sí están en el catálogo: con eso la pantalla sabe qué medidas pedir
 *  (ancho y alto si alguno es por m²; ancho, y alto opcional, si alguno es por metro lineal). */
export function bundleChargeUnits(
  items: readonly BundleItem[],
  catalogo: readonly BundleComponent[],
): readonly ChargeUnit[] {
  const porId = new Map(catalogo.map((p) => [p.id, p]));
  return items.flatMap((i) => {
    const p = porId.get(i.productId);
    return p === undefined ? [] : [p.chargeUnit];
  });
}

/** ¿Hay que pedir medidas para agregar el paquete? Sí, si algún componente se cobra por m² o metro lineal. */
export function bundleNeedsMeasures(
  items: readonly BundleItem[],
  catalogo: readonly BundleComponent[],
): boolean {
  return bundleChargeUnits(items, catalogo).some(midePieza);
}

/** Lo que se captura una sola vez al agregar un paquete: cuántos paquetes y, si hace falta, las medidas. */
export interface BundleInput {
  readonly widthMm: number | null;
  readonly heightMm: number | null;
  readonly quantity: number;
  readonly displayUnit: LengthUnit;
}

/** Un renglón que sale del paquete: su producto y lo que se captura para él. */
export interface BundleLine<P extends BundleComponent> {
  readonly product: P;
  readonly input: BundleInput;
}

/** Convierte un paquete en renglones normales, uno por componente y en su orden [RF-M1-18, ADR-0048]: las
 *  medidas van solo a lo que se cobra por m² o metro lineal; la cantidad de cada uno es la suya por la de
 *  paquetes. No calcula precios: cada renglón se arma después con su propia regla, precio e IVA. */
export function expandBundle<P extends BundleComponent>(
  items: readonly BundleItem[],
  catalogo: readonly P[],
  entrada: BundleInput,
): Result<readonly BundleLine<P>[], BundleError> {
  if (!Number.isSafeInteger(entrada.quantity) || entrada.quantity < 1) {
    return err({ code: 'BUNDLE_INPUT_INVALID' });
  }
  const revision = checkBundleItems(items, catalogo);
  if (!revision.ok) {
    return revision;
  }
  const porId = new Map(catalogo.map((p) => [p.id, p]));
  const lineas: BundleLine<P>[] = [];
  for (const item of items) {
    const producto = porId.get(item.productId);
    if (producto === undefined) continue; // ya revisado arriba
    const cantidad = item.quantity * entrada.quantity;
    if (!Number.isSafeInteger(cantidad)) {
      return err({ code: 'BUNDLE_INPUT_INVALID' });
    }
    const conMedidas = midePieza(producto.chargeUnit);
    lineas.push({
      product: producto,
      input: {
        widthMm: conMedidas ? entrada.widthMm : null,
        heightMm: conMedidas ? entrada.heightMm : null,
        quantity: cantidad,
        displayUnit: entrada.displayUnit,
      },
    });
  }
  return ok(lineas);
}
