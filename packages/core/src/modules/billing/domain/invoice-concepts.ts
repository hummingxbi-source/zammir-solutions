import { err, ok, type Result } from '../../../shared-kernel/result';
import { unitValueMicros, type CfdiConcept, type TaxObject } from './invoice';

/** Una línea de la venta u orden con lo que hace falta para facturarla: el importe sin IVA y el IVA ya
 *  separados por el módulo de dinero [RN-05], y las claves fiscales del producto o de su categoría. */
export interface InvoiceSourceLine {
  readonly name: string;
  readonly quantity: number;
  readonly baseCents: number;
  readonly taxCents: number;
  readonly lineTotalCents: number;
  readonly productServiceKey: string | null;
  readonly unitKey: string | null;
  readonly taxObject: string | null;
}

export type InvoiceConceptsError =
  /** No hay nada que facturar. */
  | { readonly code: 'NO_LINES' }
  /** A estas líneas (posición, desde 1) les faltan las claves del SAT: el catálogo aún no las tiene (PD-29). */
  | { readonly code: 'FISCAL_DATA_MISSING'; readonly positions: readonly number[] }
  /** En estas líneas, base más IVA no da el total de la línea: algo se guardó mal y no se factura. */
  | { readonly code: 'LINE_TOTAL_MISMATCH'; readonly positions: readonly number[] };

function esObjetoDeImpuesto(valor: string | null): valor is TaxObject {
  return valor === '01' || valor === '02' || valor === '03';
}

/** Convierte las líneas de una venta u orden en los conceptos del CFDI. Nunca inventa una clave del SAT: si a
 *  una línea le falta alguna, no se factura hasta que el catálogo la tenga (PD-29). El IVA y el importe sin IVA
 *  son los que ya se guardaron con la venta, no se recalculan [ADR-0011]. */
export function buildInvoiceConcepts(
  lineas: readonly InvoiceSourceLine[],
): Result<readonly CfdiConcept[], InvoiceConceptsError> {
  if (lineas.length === 0) {
    return err({ code: 'NO_LINES' });
  }
  const desbalanceadas = lineas
    .map((l, i) => (l.baseCents + l.taxCents === l.lineTotalCents ? 0 : i + 1))
    .filter((p) => p > 0);
  if (desbalanceadas.length > 0) {
    return err({ code: 'LINE_TOTAL_MISMATCH', positions: desbalanceadas });
  }
  const sinClaves = lineas
    .map((l, i) =>
      l.productServiceKey === null ||
      l.unitKey === null ||
      l.productServiceKey.trim() === '' ||
      l.unitKey.trim() === '' ||
      !esObjetoDeImpuesto(l.taxObject)
        ? i + 1
        : 0,
    )
    .filter((p) => p > 0);
  if (sinClaves.length > 0) {
    return err({ code: 'FISCAL_DATA_MISSING', positions: sinClaves });
  }
  return ok(
    lineas.map((l) => ({
      productServiceKey: l.productServiceKey ?? '',
      unitKey: l.unitKey ?? '',
      description: l.name,
      quantity: l.quantity,
      unitValueMicros: unitValueMicros(l.baseCents, l.quantity),
      amountCents: l.baseCents,
      taxObject: esObjetoDeImpuesto(l.taxObject) ? l.taxObject : '02',
      taxCents: l.taxCents,
    })),
  );
}
