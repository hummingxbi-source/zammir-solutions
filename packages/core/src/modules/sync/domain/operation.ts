import { z } from 'zod';

import { err, ok, type Result } from '../../../shared-kernel/result';

/** Tipos de operación que la tablet manda al servidor [ADR-0016]. Cada caso de uso que cambia datos
 *  compartidos es un tipo; los demás cambios son solo locales. */
export const OPERATION_TYPES = [
  'IssueQuote',
  'MarkQuoteAccepted',
  'MarkQuoteRejected',
  'UpsertCustomer',
] as const;

export type OperationType = (typeof OPERATION_TYPES)[number];

/** Versión actual del formato de las cargas. El servidor acepta la actual y la anterior. */
export const CURRENT_SCHEMA_VERSION = 1;

const uuid = z.uuid();

/** El sobre de toda operación: lo que identifica, ordena y atribuye el cambio. La carga (`payload`)
 *  se valida aparte, según el tipo. */
export const operationEnvelopeSchema = z.object({
  opId: uuid,
  deviceId: uuid,
  seq: z.number().int().min(1),
  type: z.enum(OPERATION_TYPES),
  schemaVersion: z.number().int().min(1),
  userId: uuid,
  authorizedBy: uuid.nullable().optional(),
  clientCreatedAt: z.iso.datetime(),
  payload: z.unknown(),
});

export type OperationEnvelope = z.infer<typeof operationEnvelopeSchema>;

export type EnvelopeErrorCode = 'INVALID_ENVELOPE' | 'UNKNOWN_TYPE';

export interface EnvelopeError {
  readonly code: EnvelopeErrorCode;
  readonly problems: readonly string[];
}

/** Valida el sobre. Un tipo que no existe se distingue de un sobre mal formado: la tablet y el
 *  servidor lo tratan distinto (tipo desconocido = versión vieja o nueva de la aplicación). */
export function parseEnvelope(crudo: unknown): Result<OperationEnvelope, EnvelopeError> {
  if (typeof crudo === 'object' && crudo !== null && 'type' in crudo) {
    const tipo = (crudo as { readonly type: unknown }).type;
    if (typeof tipo === 'string' && !(OPERATION_TYPES as readonly string[]).includes(tipo)) {
      return err({ code: 'UNKNOWN_TYPE', problems: [`tipo ${tipo}`] });
    }
  }
  const r = operationEnvelopeSchema.safeParse(crudo);
  if (!r.success) {
    return err({
      code: 'INVALID_ENVELOPE',
      problems: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    });
  }
  return ok(r.data);
}

const entero = z.number().int();
const centavos = entero.min(0);

const quoteLineSchema = z
  .object({
    id: uuid,
    productId: uuid.nullable().optional(),
    name: z.string().trim().min(1),
    chargeUnit: z.enum(['SQUARE_METER', 'LINEAR_METER', 'PIECE', 'SERVICE']),
    unitPriceCents: centavos,
    catalogPriceCents: centavos.optional(),
    ruleId: z.string().min(1),
    ruleParams: z.unknown().optional(),
    widthMm: entero.min(1).nullable().optional(),
    heightMm: entero.min(1).nullable().optional(),
    quantity: entero.min(1),
    lineTotalCents: centavos,
    baseCents: centavos,
    taxCents: centavos,
    isTaxExempt: z.boolean().optional(),
    detail: z.string().optional(),
  })
  .refine((l) => l.lineTotalCents === l.baseCents + l.taxCents, {
    message: 'el importe de la línea no es base + IVA',
  });

/** Carga de `IssueQuote`: la instantánea completa de la cotización emitida, con importes ya
 *  calculados por el dominio. El servidor comprueba que sean consistentes [S2-03]. */
export const issueQuotePayloadSchema = z
  .object({
    id: uuid,
    tempFolio: z.string().regex(/^T[0-9]+-[0-9]+$/),
    publicCode: z.string().regex(/^[A-HJKMNP-Z2-9]{8}$/),
    customerId: uuid,
    siteAddress: z.string().nullable().optional(),
    issuedAt: z.iso.datetime(),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    conditionsText: z.string().min(1),
    privacyNoticeVersion: entero.min(1).nullable().optional(),
    subtotalCents: centavos,
    taxCents: centavos,
    totalCents: centavos,
    catalogVersion: entero.min(0).nullable().optional(),
    lines: z.array(quoteLineSchema).min(1),
  })
  .superRefine((q, ctx) => {
    if (q.totalCents !== q.subtotalCents + q.taxCents) {
      ctx.addIssue({ code: 'custom', message: 'el total no es subtotal + IVA' });
    }
    const base = q.lines.reduce((suma, l) => suma + l.baseCents, 0);
    const iva = q.lines.reduce((suma, l) => suma + l.taxCents, 0);
    if (base !== q.subtotalCents || iva !== q.taxCents) {
      ctx.addIssue({ code: 'custom', message: 'los totales no son la suma de las líneas' });
    }
  });

export type IssueQuotePayload = z.infer<typeof issueQuotePayloadSchema>;

export type OperationStatus = 'APPLIED' | 'TO_REVIEW';

/** Respuesta del servidor a una operación aplicada (o a su reenvío: el mismo resultado). */
export interface OperationApplied {
  readonly ok: true;
  readonly status: OperationStatus;
  readonly folio?: string;
  readonly documentId?: string;
  readonly reason?: string;
}

export type OperationRejectionCode =
  | 'OUT_OF_ORDER'
  | 'DEVICE_REVOKED'
  | 'UNKNOWN_TYPE'
  | 'INVALID_PAYLOAD'
  | 'INVALID_ENVELOPE'
  | 'TOTALS_MISMATCH';

/** Rechazo estructural: no se guardó nada. Todos detienen la cola de la tablet salvo `OUT_OF_ORDER`,
 *  que se corrige reenviando desde `expectedSeq`. */
export interface OperationRejected {
  readonly ok: false;
  readonly code: OperationRejectionCode;
  readonly expectedSeq?: number;
  readonly detail?: string;
}

export type OperationResult = OperationApplied | OperationRejected;

/** ¿Este rechazo es de los que detienen la cola del dispositivo? */
export function isStructuralRejection(r: OperationRejected): boolean {
  return r.code !== 'OUT_OF_ORDER';
}

/** Valida una operación completa: el sobre y, según el tipo, su carga. Es la comprobación que hace la
 *  cola de la tablet antes de guardar y la misma que hace el servidor al recibir. Los tipos cuya carga
 *  todavía no tiene esquema (se agregan con su historia) solo validan el sobre. */
export function parseOperation(crudo: unknown): Result<OperationEnvelope, EnvelopeError> {
  const sobre = parseEnvelope(crudo);
  if (!sobre.ok) {
    return sobre;
  }
  if (sobre.value.type === 'IssueQuote') {
    const carga = issueQuotePayloadSchema.safeParse(sobre.value.payload);
    if (!carga.success) {
      return err({
        code: 'INVALID_ENVELOPE',
        problems: carga.error.issues.map((i) => `payload.${i.path.join('.')}: ${i.message}`),
      });
    }
  }
  return sobre;
}
