import { formatFolio, folioYear } from '../../../shared-kernel/folio/folio';
import {
  advanceWorkOrderPayloadSchema,
  cancelCounterSalePayloadSchema,
  cancelWorkOrderPayloadSchema,
  createCounterSalePayloadSchema,
  createWorkOrderPayloadSchema,
  deliverWorkOrderPayloadSchema,
  registerPaymentPayloadSchema,
  updateWorkOrderPayloadSchema,
  type OperationEnvelope,
  type OperationResult,
} from '../domain/operation';
import type { FolioAllocator } from './folio-allocator';

/** Una orden tal como la conoce el servidor en memoria (lo justo para aplicar las reglas). */
export interface ServerOrder {
  folio: string;
  status: 'WAITING' | 'IN_PROCESS' | 'READY' | 'DELIVERED' | 'CANCELLED';
  totalCents: number;
  customerId: string;
  quoteId: string | null;
  publicCode: string;
  fields: Record<string, unknown>;
  warrantyMonths: number | null | undefined;
  deliveredWithBalance: boolean;
  cancelDepositPaidCents: number | null;
}

export interface ServerSale {
  folio: string;
  status: 'COMPLETED' | 'CANCELLED';
  totalCents: number;
  paidCents: number;
}

export interface OrderStore {
  readonly ordenes: Map<string, ServerOrder>;
  /** Pagos aplicados por orden, en centavos. */
  readonly pagado: Map<string, number>;
  /** Ids de pago ya guardados. */
  readonly pagos: Set<string>;
  readonly convertidas: Set<string>;
  readonly codigosDeOrden: Set<string>;
  /** Ventas de mostrador del servidor. */
  readonly ventas: Map<string, ServerSale>;
  readonly codigosDeVenta: Set<string>;
  /** Cotizaciones del servidor: estado por id. */
  readonly estadoDeCotizacion: Map<string, 'SENT' | 'ACCEPTED' | 'REJECTED'>;
  readonly clientesConocidos: Set<string>;
  readonly administradores: Set<string>;
  readonly requireDepositToStart: boolean;
}

export const ORDER_OPERATION_TYPES = [
  'CreateWorkOrder',
  'UpdateWorkOrder',
  'AdvanceWorkOrder',
  'DeliverWorkOrder',
  'CancelWorkOrder',
  'RegisterPayment',
  'CreateCounterSale',
  'CancelCounterSale',
] as const;

const invalida = (detail?: string): OperationResult => ({
  ok: false,
  code: 'INVALID_PAYLOAD',
  ...(detail === undefined ? {} : { detail }),
});

/** Aplica una operación de orden o de pago, con las mismas reglas que `receive_operation` en la base:
 *  lo que ya ocurrió físicamente se guarda y, si no cuadra, queda por revisar; nada se rechaza por dinero. */
export async function applyOrderOperation(ctx: {
  readonly store: OrderStore;
  readonly folios: FolioAllocator;
  readonly op: OperationEnvelope;
  readonly baseStatus: 'APPLIED' | 'TO_REVIEW';
  readonly baseReason: string | undefined;
}): Promise<OperationResult> {
  const { store, op } = ctx;
  const revisar = (reason: string, extra: Partial<OperationResult> = {}): OperationResult =>
    ({ ok: true, status: 'TO_REVIEW', reason, ...extra }) as OperationResult;
  const fin = (orden: ServerOrder, id: string, motivo?: string): OperationResult => {
    const reason = motivo ?? ctx.baseReason;
    return {
      ok: true,
      status: motivo !== undefined ? 'TO_REVIEW' : ctx.baseStatus,
      folio: orden.folio,
      documentId: id,
      ...(reason === undefined ? {} : { reason }),
    };
  };

  switch (op.type) {
    case 'CreateWorkOrder': {
      const c = createWorkOrderPayloadSchema.safeParse(op.payload);
      if (!c.success) {
        return invalida();
      }
      const p = c.data;
      if (!store.clientesConocidos.has(p.customerId)) {
        return invalida('CUSTOMER_NOT_FOUND');
      }
      if (store.codigosDeOrden.has(p.publicCode)) {
        return revisar('PUBLIC_CODE_CONFLICT');
      }
      let motivo: string | undefined;
      if (p.quoteId !== null && p.quoteId !== undefined) {
        const estado = store.estadoDeCotizacion.get(p.quoteId);
        if (estado === undefined) {
          return invalida('QUOTE_NOT_FOUND');
        }
        if (store.convertidas.has(p.quoteId)) {
          motivo = 'QUOTE_ALREADY_CONVERTED';
        } else if (estado !== 'ACCEPTED') {
          motivo = 'QUOTE_NOT_ACCEPTED';
        }
      }
      return ctx.folios.withTransaction(async (tx) => {
        const anio = folioYear(new Date(p.issuedAt));
        const numero = await tx.next('WORK_ORDER', anio);
        const folio = formatFolio('WORK_ORDER', anio, numero);
        if (!folio.ok) {
          throw new Error('folio inválido');
        }
        const orden: ServerOrder = {
          folio: folio.value,
          status: 'WAITING',
          totalCents: p.totalCents,
          customerId: p.customerId,
          quoteId: p.quoteId ?? null,
          publicCode: p.publicCode,
          fields: {},
          warrantyMonths: undefined,
          deliveredWithBalance: false,
          cancelDepositPaidCents: null,
        };
        store.ordenes.set(p.id, orden);
        store.pagado.set(p.id, 0);
        store.codigosDeOrden.add(p.publicCode);
        if (p.quoteId !== null && p.quoteId !== undefined && motivo === undefined) {
          store.convertidas.add(p.quoteId);
        }
        return fin(orden, p.id, motivo);
      });
    }

    case 'UpdateWorkOrder': {
      const c = updateWorkOrderPayloadSchema.safeParse(op.payload);
      if (!c.success) {
        return invalida();
      }
      const orden = store.ordenes.get(c.data.id);
      if (orden === undefined) {
        return invalida('ORDER_NOT_FOUND');
      }
      // Por campo gana el último que llega.
      Object.assign(orden.fields, c.data.patch);
      return fin(orden, c.data.id);
    }

    case 'AdvanceWorkOrder': {
      const c = advanceWorkOrderPayloadSchema.safeParse(op.payload);
      if (!c.success) {
        return invalida();
      }
      const orden = store.ordenes.get(c.data.id);
      if (orden === undefined) {
        return invalida('ORDER_NOT_FOUND');
      }
      const valida =
        (orden.status === 'WAITING' && c.data.to === 'IN_PROCESS') ||
        (orden.status === 'IN_PROCESS' && c.data.to === 'READY');
      if (!valida) {
        return revisar('INVALID_TRANSITION', { folio: orden.folio, documentId: c.data.id });
      }
      const sinAnticipo =
        c.data.to === 'IN_PROCESS' &&
        store.requireDepositToStart &&
        (store.pagado.get(c.data.id) ?? 0) === 0 &&
        (op.authorizedBy === undefined || op.authorizedBy === null);
      orden.status = c.data.to;
      return fin(orden, c.data.id, sinAnticipo ? 'STARTED_WITHOUT_DEPOSIT' : undefined);
    }

    case 'DeliverWorkOrder': {
      const c = deliverWorkOrderPayloadSchema.safeParse(op.payload);
      if (!c.success) {
        return invalida();
      }
      const orden = store.ordenes.get(c.data.id);
      if (orden === undefined) {
        return invalida('ORDER_NOT_FOUND');
      }
      if (orden.status !== 'READY') {
        return revisar('INVALID_TRANSITION', { folio: orden.folio, documentId: c.data.id });
      }
      const saldo = orden.totalCents - (store.pagado.get(c.data.id) ?? 0);
      const motivo = c.data.reason?.trim() ?? '';
      const sinPermiso =
        saldo > 0 && (op.authorizedBy === undefined || op.authorizedBy === null || motivo === '');
      orden.status = 'DELIVERED';
      orden.deliveredWithBalance = saldo > 0;
      // PD-06: la garantía se crea al entregar y su duración puede quedar vacía.
      orden.warrantyMonths = null;
      return fin(
        orden,
        c.data.id,
        sinPermiso ? 'DELIVERED_WITH_BALANCE_WITHOUT_AUTHORIZATION' : undefined,
      );
    }

    case 'CancelWorkOrder': {
      const c = cancelWorkOrderPayloadSchema.safeParse(op.payload);
      if (!c.success) {
        return invalida();
      }
      const orden = store.ordenes.get(c.data.id);
      if (orden === undefined) {
        return invalida('ORDER_NOT_FOUND');
      }
      if (orden.status === 'DELIVERED' || orden.status === 'CANCELLED') {
        return revisar('INVALID_TRANSITION', { folio: orden.folio, documentId: c.data.id });
      }
      const quien = op.authorizedBy ?? op.userId;
      const sinPermiso = !store.administradores.has(quien);
      orden.status = 'CANCELLED';
      orden.cancelDepositPaidCents = store.pagado.get(c.data.id) ?? 0;
      return fin(orden, c.data.id, sinPermiso ? 'CANCEL_WITHOUT_AUTHORIZATION' : undefined);
    }

    case 'RegisterPayment': {
      const c = registerPaymentPayloadSchema.safeParse(op.payload);
      if (!c.success) {
        return invalida();
      }
      if (c.data.target.type !== 'WORK_ORDER') {
        return invalida('TARGET_NOT_SUPPORTED');
      }
      const id = c.data.target.id;
      const orden = store.ordenes.get(id);
      if (orden === undefined) {
        return invalida('ORDER_NOT_FOUND');
      }
      const aplicado = c.data.rows.reduce((suma, r) => suma + r.amountCents, 0);
      const saldo = orden.totalCents - (store.pagado.get(id) ?? 0);
      // El dinero recibido nunca se rechaza: se guarda y, si no cuadra, se revisa.
      const motivo =
        aplicado > saldo
          ? 'PAYMENT_EXCEEDS_BALANCE'
          : orden.status === 'CANCELLED'
            ? 'ORDER_CANCELLED'
            : undefined;
      for (const r of c.data.rows) {
        store.pagos.add(r.id);
      }
      store.pagado.set(id, (store.pagado.get(id) ?? 0) + aplicado);
      return fin(orden, id, motivo);
    }

    case 'CreateCounterSale': {
      const c = createCounterSalePayloadSchema.safeParse(op.payload);
      if (!c.success) {
        return invalida();
      }
      const p = c.data;
      if (
        p.customerId !== null &&
        p.customerId !== undefined &&
        !store.clientesConocidos.has(p.customerId)
      ) {
        return invalida('CUSTOMER_NOT_FOUND');
      }
      if (store.codigosDeVenta.has(p.publicCode)) {
        return revisar('PUBLIC_CODE_CONFLICT');
      }
      const cobrado = p.payment.rows.reduce((suma, r) => suma + r.amountCents, 0);
      return ctx.folios.withTransaction(async (tx) => {
        const anio = folioYear(new Date(p.issuedAt));
        const numero = await tx.next('COUNTER_SALE', anio);
        const folio = formatFolio('COUNTER_SALE', anio, numero);
        if (!folio.ok) {
          throw new Error('folio inválido');
        }
        store.ventas.set(p.id, {
          folio: folio.value,
          status: 'COMPLETED',
          totalCents: p.totalCents,
          paidCents: cobrado,
        });
        store.codigosDeVenta.add(p.publicCode);
        const motivo = cobrado === p.totalCents ? undefined : 'PAYMENT_NOT_EQUAL_TOTAL';
        const reason = motivo ?? ctx.baseReason;
        return {
          ok: true,
          status: motivo !== undefined ? 'TO_REVIEW' : ctx.baseStatus,
          folio: folio.value,
          documentId: p.id,
          ...(reason === undefined ? {} : { reason }),
        };
      });
    }

    case 'CancelCounterSale': {
      const c = cancelCounterSalePayloadSchema.safeParse(op.payload);
      if (!c.success) {
        return invalida();
      }
      const venta = store.ventas.get(c.data.id);
      if (venta === undefined) {
        return invalida('SALE_NOT_FOUND');
      }
      if (venta.status === 'CANCELLED') {
        return revisar('INVALID_TRANSITION', { folio: venta.folio, documentId: c.data.id });
      }
      const quien = op.authorizedBy ?? op.userId;
      venta.status = 'CANCELLED';
      const reason = store.administradores.has(quien)
        ? ctx.baseReason
        : 'CANCEL_WITHOUT_AUTHORIZATION';
      return {
        ok: true,
        status: store.administradores.has(quien) ? ctx.baseStatus : 'TO_REVIEW',
        folio: venta.folio,
        documentId: c.data.id,
        ...(reason === undefined ? {} : { reason }),
      };
    }

    default:
      return { ok: false, code: 'UNKNOWN_TYPE' };
  }
}
