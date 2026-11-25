import type { AgingBucket } from '@zammir/core';

import { textos } from '../../../shared/i18n/textos';

const c = textos.reportes.cuentas;

/** Cómo se llama un tramo de antigüedad de las cuentas por cobrar. Con el umbral de 1 día los tramos son de un
 *  solo día ("Entregadas hoy", "1 día"); lo que no se ha entregado va aparte [ADR-0044]. */
export function etiquetaDeTramo(b: AgingBucket): string {
  if (b.notDelivered) {
    return c.porEntregar;
  }
  if (b.undated) {
    return c.sinFecha;
  }
  if (b.toDays === null) {
    return c.desde(b.fromDays ?? 0);
  }
  const desde = b.fromDays ?? 0;
  return desde === b.toDays ? c.dia(desde) : c.entre(desde, b.toDays);
}
