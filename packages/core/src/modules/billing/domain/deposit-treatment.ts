/** Tratamiento fiscal de los anticipos [RN-27, RF-M10-18, PD-27]: `a` un solo CFDI por el total al liquidar la orden
 *  (por omisión) o `b` un CFDI por el anticipo y otro final relacionado con el primero. */
export type DepositTreatment = 'a' | 'b';

/** ¿Se puede facturar este documento con el tratamiento de anticipos configurado? Solo la opción (a) está construida:
 *  la (b) solo se construye si el contador la exige y Juanito lo aprueba [RN-27]. Las ventas de mostrador no llevan
 *  anticipo, así que siempre se pueden facturar. Sin ajuste, se usa la opción (a). */
export function supportsDepositTreatment(
  tratamiento: DepositTreatment | undefined,
  documento: 'COUNTER_SALE' | 'WORK_ORDER',
): boolean {
  return documento === 'COUNTER_SALE' || tratamiento !== 'b';
}

/** Lee el ajuste `deposit_tax_treatment` tal como viene de la configuración; cualquier valor raro se toma como la
 *  opción (a), que es la de por omisión. */
export function parseDepositTreatment(valor: unknown): DepositTreatment {
  return valor === 'b' ? 'b' : 'a';
}
