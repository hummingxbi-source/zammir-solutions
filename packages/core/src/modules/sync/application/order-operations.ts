import { formatFolio, folioYear } from '../../../shared-kernel/folio/folio';
import {
  advanceWorkOrderPayloadSchema,
  cancelCounterSalePayloadSchema,
  cancelWorkOrderPayloadSchema,
  closeCashShiftPayloadSchema,
  confirmTransferPayloadSchema,
  openCashShiftPayloadSchema,
  reopenCashShiftPayloadSchema,
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

export interface ServerShift {
  userId: string;
  floatCents: number;
  status: 'OPEN' | 'CLOSED';
  /** Efectivo del turno: lo cobrado menos lo devuelto en él (las cancelaciones viejas restan su cobro). */
  cashCents: number;
  expectedCents: number | null;
  differenceCents: number | null;
  differenceNote?: string | null;
}

export interface ServerSale {
  shiftId: string | null;
  cashCents: number;
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
  /** Método de cada pago guardado (de órdenes y de ventas). */
  readonly metodoDePago: Map<string, 'CASH' | 'TRANSFER'>;
  /** Pagos por transferencia ya confirmados [RF-M4-11]. */
  readonly confirmadas: Set<string>;
  readonly convertidas: Set<string>;
  readonly codigosDeOrden: Set<string>;
  /** Ventas de mostrador del servidor. */
  readonly ventas: Map<string, ServerSale>;
  /** Turnos de caja del servidor. */
  readonly turnos: Map<string, ServerShift>;
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
  'OpenCashShift',
  'CloseCashShift',
  'ReopenCashShift',
  'ConfirmTransfer',
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
          fields:
            p.estimatedDeliveryDate === undefined
              ? {}
              : { estimatedDeliveryDate: p.estimatedDeliveryDate },
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
      const turnoId = c.data.cashShiftId ?? null;
      const turno = turnoId === null ? undefined : store.turnos.get(turnoId);
      if (turnoId !== null && turno === undefined) {
        return invalida('SHIFT_NOT_FOUND');
      }
      const aplicado = c.data.rows.reduce((suma, r) => suma + r.amountCents, 0);
      const saldo = orden.totalCents - (store.pagado.get(id) ?? 0);
      // El dinero recibido nunca se rechaza: se guarda y, si no cuadra, se revisa.
      const motivo =
        aplicado > saldo
          ? 'PAYMENT_EXCEEDS_BALANCE'
          : orden.status === 'CANCELLED'
            ? 'ORDER_CANCELLED'
            : turno?.status === 'CLOSED'
              ? 'SHIFT_CLOSED'
              : undefined;
      if (turno !== undefined) {
        turno.cashCents += c.data.rows
          .filter((r) => r.method === 'CASH')
          .reduce((suma, r) => suma + r.amountCents, 0);
      }
      for (const r of c.data.rows) {
        store.pagos.add(r.id);
        store.metodoDePago.set(r.id, r.method);
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
      const turnoId = p.cashShiftId ?? null;
      const turno = turnoId === null ? undefined : store.turnos.get(turnoId);
      if (turnoId !== null && turno === undefined) {
        return invalida('SHIFT_NOT_FOUND');
      }
      const cobrado = p.payment.rows.reduce((suma, r) => suma + r.amountCents, 0);
      const efectivo = p.payment.rows
        .filter((r) => r.method === 'CASH')
        .reduce((suma, r) => suma + r.amountCents, 0);
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
          shiftId: turnoId,
          cashCents: efectivo,
        });
        if (turno !== undefined) {
          turno.cashCents += efectivo;
        }
        store.codigosDeVenta.add(p.publicCode);
        for (const r of p.payment.rows) {
          store.metodoDePago.set(r.id, r.method);
        }
        const motivo =
          cobrado !== p.totalCents
            ? 'PAYMENT_NOT_EQUAL_TOTAL'
            : turno?.status === 'CLOSED'
              ? 'SHIFT_CLOSED'
              : undefined;
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
      let motivo: string | undefined;
      const devoluciones = c.data.refunds;
      if (devoluciones === undefined) {
        // Cancelación de antes de RF-M4-10: como entonces, su cobro sale del turno de la venta.
        const turnoDeVenta = venta.shiftId === null ? undefined : store.turnos.get(venta.shiftId);
        if (turnoDeVenta !== undefined) {
          turnoDeVenta.cashCents -= venta.cashCents;
        }
        motivo = 'REFUND_MISSING';
      } else {
        // El cobro se queda en su turno; el efectivo devuelto sale del turno de quien cancela [RF-M4-10].
        const devuelto = (m: 'CASH' | 'TRANSFER') =>
          devoluciones.filter((d) => d.method === m).reduce((t, d) => t + d.amountCents, 0);
        if (
          devuelto('CASH') !== venta.cashCents ||
          devuelto('TRANSFER') !== venta.paidCents - venta.cashCents
        ) {
          motivo = 'REFUND_MISMATCH';
        }
        for (const d of devoluciones.filter((x) => x.method === 'CASH')) {
          // Sin turno (no se llevan turnos), como un cobro sin turno; con uno, debe estar abierto.
          const turno = d.cashShiftId === null ? undefined : store.turnos.get(d.cashShiftId);
          if (d.cashShiftId !== null && (turno === undefined || turno.status === 'CLOSED')) {
            motivo ??= 'SHIFT_CLOSED';
          }
          if (turno !== undefined) {
            turno.cashCents -= d.amountCents;
          }
        }
      }
      const autorizada = store.administradores.has(quien);
      const reason = autorizada ? (motivo ?? ctx.baseReason) : 'CANCEL_WITHOUT_AUTHORIZATION';
      return {
        ok: true,
        status: autorizada && motivo === undefined ? ctx.baseStatus : 'TO_REVIEW',
        folio: venta.folio,
        documentId: c.data.id,
        ...(reason === undefined ? {} : { reason }),
      };
    }

    case 'OpenCashShift': {
      const c = openCashShiftPayloadSchema.safeParse(op.payload);
      if (!c.success) {
        return invalida();
      }
      const yaAbierto = [...store.turnos.values()].some(
        (t) => t.userId === op.userId && t.status === 'OPEN',
      );
      store.turnos.set(c.data.id, {
        userId: op.userId,
        floatCents: c.data.openingFloatCents,
        status: 'OPEN',
        cashCents: 0,
        expectedCents: null,
        differenceCents: null,
      });
      const reason = yaAbierto ? 'SHIFT_ALREADY_OPEN' : ctx.baseReason;
      return {
        ok: true,
        status: yaAbierto ? 'TO_REVIEW' : ctx.baseStatus,
        documentId: c.data.id,
        ...(reason === undefined ? {} : { reason }),
      };
    }

    case 'CloseCashShift': {
      const c = closeCashShiftPayloadSchema.safeParse(op.payload);
      if (!c.success) {
        return invalida();
      }
      const turno = store.turnos.get(c.data.id);
      if (turno === undefined) {
        return invalida('SHIFT_NOT_FOUND');
      }
      if (turno.status === 'CLOSED') {
        return revisar('INVALID_TRANSITION', { documentId: c.data.id });
      }
      // El servidor recalcula el efectivo esperado; si no coincide, el corte queda por revisar.
      const esperado = turno.floatCents + turno.cashCents;
      turno.status = 'CLOSED';
      turno.expectedCents = esperado;
      turno.differenceCents = c.data.countedCashCents - esperado;
      turno.differenceNote = c.data.differenceNote ?? null;
      const difiere = esperado !== c.data.expectedCashCents;
      // Con diferencia y sin explicación (un cierre viejo en cola) se aplica, pero por revisar [RF-M4-09].
      const sinNota = turno.differenceCents !== 0 && turno.differenceNote === null;
      const reason = difiere
        ? 'CASH_SUMMARY_MISMATCH'
        : sinNota
          ? 'DIFFERENCE_WITHOUT_NOTE'
          : ctx.baseReason;
      return {
        ok: true,
        status: difiere || sinNota ? 'TO_REVIEW' : ctx.baseStatus,
        documentId: c.data.id,
        ...(reason === undefined ? {} : { reason }),
      };
    }

    case 'ReopenCashShift': {
      const c = reopenCashShiftPayloadSchema.safeParse(op.payload);
      if (!c.success) {
        return invalida();
      }
      const turno = store.turnos.get(c.data.id);
      if (turno === undefined) {
        return invalida('SHIFT_NOT_FOUND');
      }
      if (turno.status !== 'CLOSED') {
        return revisar('INVALID_TRANSITION', { documentId: c.data.id });
      }
      const quien = op.authorizedBy ?? op.userId;
      turno.status = 'OPEN';
      const sinPermiso = !store.administradores.has(quien);
      const reason = sinPermiso ? 'REOPEN_WITHOUT_AUTHORIZATION' : ctx.baseReason;
      return {
        ok: true,
        status: sinPermiso ? 'TO_REVIEW' : ctx.baseStatus,
        documentId: c.data.id,
        ...(reason === undefined ? {} : { reason }),
      };
    }

    case 'ConfirmTransfer': {
      const c = confirmTransferPayloadSchema.safeParse(op.payload);
      if (!c.success) {
        return invalida();
      }
      const id = c.data.paymentId;
      // Nada se rechaza: si no se puede confirmar, queda por revisar sin guardar nada [RF-M4-11].
      const metodo = store.metodoDePago.get(id);
      if (metodo === undefined) {
        return revisar('PAYMENT_NOT_FOUND', { documentId: id });
      }
      if (metodo !== 'TRANSFER') {
        return revisar('NOT_A_TRANSFER', { documentId: id });
      }
      if (store.confirmadas.has(id)) {
        return revisar('ALREADY_CONFIRMED', { documentId: id });
      }
      store.confirmadas.add(id);
      const quien = op.authorizedBy ?? op.userId;
      const sinPermiso = !store.administradores.has(quien);
      const reason = sinPermiso ? 'CONFIRM_WITHOUT_AUTHORIZATION' : ctx.baseReason;
      return {
        ok: true,
        status: sinPermiso ? 'TO_REVIEW' : ctx.baseStatus,
        documentId: id,
        ...(reason === undefined ? {} : { reason }),
      };
    }

    default:
      return { ok: false, code: 'UNKNOWN_TYPE' };
  }
}
