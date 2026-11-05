import { z } from 'zod';

import type { StampRequest } from '../domain/invoice';

const entero = z.number().int().nonnegative();

const concepto = z.object({
  productServiceKey: z.string(),
  unitKey: z.string(),
  description: z.string(),
  quantity: z.number().positive(),
  unitValueMicros: z.number().nonnegative(),
  amountCents: entero,
  taxObject: z.enum(['01', '02', '03']),
  taxCents: entero,
});

const solicitud = z.object({
  requestId: z.string().min(1),
  paymentForm: z.enum(['01', '03']),
  paymentMethod: z.literal('PUE'),
  recipient: z.object({
    rfc: z.string(),
    name: z.string(),
    fiscalZip: z.string(),
    regime: z.string(),
    cfdiUse: z.string(),
  }),
  concepts: z.array(concepto),
  // En JSON la fecha viaja como texto ISO.
  issuedAt: z.string().refine((t) => !Number.isNaN(new Date(t).getTime())),
  relatedUuid: z.string().optional(),
});

/** Lo que se le mandó al PAC, tal como se guardó en la base (JSON), de vuelta a una solicitud de timbrado. Si lo
 *  guardado no tiene la forma esperada devuelve `null`: una solicitud que no se puede reconstruir no se reintenta
 *  a ciegas [RF-M10-15]. */
export function parseStampSnapshot(valor: unknown): StampRequest | null {
  const r = solicitud.safeParse(valor);
  if (!r.success) {
    return null;
  }
  const { issuedAt, relatedUuid, ...resto } = r.data;
  return {
    ...resto,
    issuedAt: new Date(issuedAt),
    ...(relatedUuid === undefined ? {} : { relatedUuid }),
  };
}
