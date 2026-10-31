import { z } from 'zod';

import { err, ok, type Result } from '../../../shared-kernel/result';

/** Tipos de operación que la tablet manda al servidor [ADR-0016]. Cada caso de uso que cambia datos
 *  compartidos es un tipo; los demás cambios son solo locales. */
export const OPERATION_TYPES = [
  'IssueQuote',
  'MarkQuoteAccepted',
  'MarkQuoteRejected',
  'UpsertCustomer',
  'CreateWorkOrder',
  'UpdateWorkOrder',
  'AdvanceWorkOrder',
  'DeliverWorkOrder',
  'CancelWorkOrder',
  'RegisterPayment',
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

/** Carga de `UpsertCustomer`: alta o corrección de un cliente hecha en la tablet. Nunca lleva datos
 *  fiscales: esos solo los captura un administrador en línea [RNF-06]. */
export const upsertCustomerPayloadSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1),
  phone: z.string().regex(/^\d{10}$/),
  email: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  privacyNoticeVersion: entero.min(1).nullable().optional(),
});

export type UpsertCustomerPayload = z.infer<typeof upsertCustomerPayloadSchema>;

/** Carga de `CreateWorkOrder`: la orden completa, con líneas y totales congelados de la cotización
 *  aceptada (o capturados a mano) y el anticipo exigido ya calculado [S3-01, ADR-0011]. */
export const createWorkOrderPayloadSchema = z
  .object({
    id: uuid,
    tempFolio: z.string().regex(/^T[0-9]+-[0-9]+$/),
    publicCode: z.string().regex(/^[A-HJKMNP-Z2-9]{8}$/),
    customerId: uuid,
    quoteId: uuid.nullable().optional(),
    siteAddress: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    issuedAt: z.iso.datetime(),
    depositPercentBps: entero.min(0).max(10_000),
    depositRequiredCents: centavos,
    subtotalCents: centavos,
    taxCents: centavos,
    totalCents: centavos,
    lines: z.array(quoteLineSchema).min(1),
  })
  .superRefine((o, ctx) => {
    if (o.totalCents !== o.subtotalCents + o.taxCents) {
      ctx.addIssue({ code: 'custom', message: 'el total no es subtotal + IVA' });
    }
    const base = o.lines.reduce((suma, l) => suma + l.baseCents, 0);
    const iva = o.lines.reduce((suma, l) => suma + l.taxCents, 0);
    if (base !== o.subtotalCents || iva !== o.taxCents) {
      ctx.addIssue({ code: 'custom', message: 'los totales no son la suma de las líneas' });
    }
    if (o.depositRequiredCents > o.totalCents) {
      ctx.addIssue({ code: 'custom', message: 'el anticipo exigido es mayor que el total' });
    }
  });

export type CreateWorkOrderPayload = z.infer<typeof createWorkOrderPayloadSchema>;

/** Carga de `UpdateWorkOrder`: parche por campo (responsables, fecha estimada, notas) [S3-02]. */
export const updateWorkOrderPayloadSchema = z.object({
  id: uuid,
  patch: z
    .object({
      measuredBy: uuid.nullable().optional(),
      builtBy: uuid.nullable().optional(),
      installedBy: uuid.nullable().optional(),
      estimatedDeliveryDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      notes: z.string().nullable().optional(),
    })
    .refine((p) => Object.keys(p).length > 0, { message: 'el parche está vacío' }),
});

export type UpdateWorkOrderPayload = z.infer<typeof updateWorkOrderPayloadSchema>;

/** Carga de `AdvanceWorkOrder`: pasar a "en proceso" o a "listo" [S3-04]. */
export const advanceWorkOrderPayloadSchema = z.object({
  id: uuid,
  to: z.enum(['IN_PROCESS', 'READY']),
  reason: z.string().nullable().optional(),
});

/** Carga de `DeliverWorkOrder`: entregar; con saldo exige motivo (y `authorizedBy` en el sobre) [S3-06]. */
export const deliverWorkOrderPayloadSchema = z.object({
  id: uuid,
  reason: z.string().nullable().optional(),
});

/** Carga de `CancelWorkOrder`: cancelar con motivo [S3-08]. */
export const cancelWorkOrderPayloadSchema = z.object({
  id: uuid,
  reason: z.string().trim().min(1),
});

const paymentRowSchema = z
  .object({
    id: uuid,
    method: z.enum(['CASH', 'TRANSFER']),
    /** Lo que se aplica a la orden o venta (sin el cambio). */
    amountCents: entero.min(1),
    cashReceivedCents: centavos.nullable().optional(),
    reference: z.string().nullable().optional(),
  })
  .superRefine((r, ctx) => {
    if (r.method === 'CASH') {
      if (r.cashReceivedCents === null || r.cashReceivedCents === undefined) {
        ctx.addIssue({ code: 'custom', message: 'falta el efectivo recibido' });
      } else if (r.cashReceivedCents < r.amountCents) {
        ctx.addIssue({ code: 'custom', message: 'el efectivo recibido es menor que lo aplicado' });
      }
    } else if (r.cashReceivedCents !== null && r.cashReceivedCents !== undefined) {
      ctx.addIssue({ code: 'custom', message: 'una transferencia no lleva efectivo recibido' });
    }
  });

/** Carga de `RegisterPayment`: un cobro (una o varias filas, p. ej. efectivo + transferencia) [S3-05].
 *  Los pagos solo se agregan; nunca se modifican. */
export const registerPaymentPayloadSchema = z.object({
  groupId: uuid,
  target: z.object({ type: z.enum(['WORK_ORDER', 'COUNTER_SALE']), id: uuid }),
  kind: z.enum(['DEPOSIT', 'BALANCE', 'SALE']),
  paidAt: z.iso.datetime(),
  rows: z.array(paymentRowSchema).min(1),
});

export type RegisterPaymentPayload = z.infer<typeof registerPaymentPayloadSchema>;

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

/** Esquema de la carga de cada tipo; los que aún no tienen esquema solo validan el sobre. */
const ESQUEMAS_DE_CARGA: Partial<Record<OperationType, z.ZodType>> = {
  IssueQuote: issueQuotePayloadSchema,
  UpsertCustomer: upsertCustomerPayloadSchema,
  CreateWorkOrder: createWorkOrderPayloadSchema,
  UpdateWorkOrder: updateWorkOrderPayloadSchema,
  AdvanceWorkOrder: advanceWorkOrderPayloadSchema,
  DeliverWorkOrder: deliverWorkOrderPayloadSchema,
  CancelWorkOrder: cancelWorkOrderPayloadSchema,
  RegisterPayment: registerPaymentPayloadSchema,
};

/** Valida una operación completa: el sobre y, según el tipo, su carga. Es la comprobación que hace la
 *  cola de la tablet antes de guardar y la misma que hace el servidor al recibir. Los tipos cuya carga
 *  todavía no tiene esquema (se agregan con su historia) solo validan el sobre. */
export function parseOperation(crudo: unknown): Result<OperationEnvelope, EnvelopeError> {
  const sobre = parseEnvelope(crudo);
  if (!sobre.ok) {
    return sobre;
  }
  const esquema: z.ZodType | null = ESQUEMAS_DE_CARGA[sobre.value.type] ?? null;
  if (esquema !== null) {
    const carga = esquema.safeParse(sobre.value.payload);
    if (!carga.success) {
      return err({
        code: 'INVALID_ENVELOPE',
        problems: carga.error.issues.map((i) => `payload.${i.path.join('.')}: ${i.message}`),
      });
    }
  }
  return sobre;
}
