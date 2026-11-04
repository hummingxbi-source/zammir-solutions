import { z } from 'zod';

import type { PortalDocumentRecord } from './portal-lookup';

const entero = z.number().int().nonnegative();

const fila = z.object({
  type: z.enum(['COUNTER_SALE', 'WORK_ORDER']),
  folio: z.string().min(1),
  id: z.string().min(1),
  cancelled: z.boolean(),
  totalCents: entero,
  paidCents: entero,
  settledAt: z.string().nullable(),
  invoiced: z.boolean(),
  lines: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int().positive(),
      lineTotalCents: entero,
    }),
  ),
});

/** Convierte lo que devuelve `portal_find_document` en un registro del portal. Si la base devuelve algo que
 *  no tiene la forma esperada se trata como "no hay documento": el portal nunca muestra datos a medias. */
export function parsePortalDocumentRow(valor: unknown): PortalDocumentRecord | null {
  const r = fila.safeParse(valor);
  return r.success ? r.data : null;
}
