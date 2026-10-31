import type { Clock } from '../../../shared-kernel/clock';
import type {
  CustomerId,
  IdGenerator,
  QuoteId,
  UserId,
  WorkOrderId,
} from '../../../shared-kernel/id';
import { money } from '../../../shared-kernel/money/money';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { Random } from '../../../shared-kernel/random';
import { computeDeposit } from '../../../shared-kernel/tax/tax';
import { formatTempFolio } from '../../../shared-kernel/folio/folio';
import { mexicoDate } from '../../../shared-kernel/date/mx-date';
import type { Authorization } from '../../identity/application/authorize-with-admin-pin';
import { defaultPermissionPolicy, type PermissionPolicy } from '../../identity/domain/permissions';
import {
  balanceCents,
  paymentKindForOrder,
  planPayment,
  type Payment,
  type PaymentError,
  type PaymentPlan,
  type PaymentRowInput,
} from '../../payments/domain/payment';
import type { QuoteStore } from '../../quotes/application/quote-store';
import type { QuoteActor } from '../../quotes/application/quote-use-cases';
import { quoteTotals } from '../../quotes/domain/quote';
import type { SyncOutbox } from '../../sync/application/ports';
import { generatePublicCode } from '../../sync/domain/public-code';
import { CURRENT_SCHEMA_VERSION } from '../../sync/domain/operation';
import {
  checkWorkOrderTransition,
  type Warranty,
  type WorkOrder,
  type WorkOrderLine,
  type WorkOrderStatus,
} from '../domain/work-order';
import {
  PAYMENTS_COLLECTION,
  WARRANTIES_COLLECTION,
  WORK_ORDERS_COLLECTION,
  type PaymentStore,
  type WorkOrderStore,
} from './work-order-store';

export type OrderErrorCode =
  | 'NOT_AUTHORIZED'
  | 'NOT_FOUND'
  | 'QUOTE_NOT_ACCEPTED'
  | 'ALREADY_CONVERTED'
  | 'EMPTY_ORDER'
  | 'INVALID_TRANSITION'
  /** Hace falta la autorización de un administrador (PIN) [PD-39]. */
  | 'NEEDS_AUTHORIZATION'
  | 'REASON_REQUIRED'
  | 'INVALID_DATE'
  | 'NOTHING_TO_UPDATE'
  | 'STORAGE_FAILED';

export interface OrderError {
  readonly code: OrderErrorCode;
}

export interface OrderDeps {
  readonly orders: WorkOrderStore;
  readonly payments: PaymentStore;
  readonly quotes: QuoteStore;
  readonly outbox: SyncOutbox;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
  readonly random: Random;
  /** Identificador del dispositivo y su serie de folios provisionales (`T<n>`). */
  readonly device: { readonly id: string; readonly series: number };
  readonly settings: {
    /** Porcentaje de anticipo en puntos base (5000 = 50 %) [RN-08]. */
    readonly depositPercentBps: number;
    /** PD-39: empezar sin anticipo exige autorización de un administrador. */
    readonly requireDepositToStart: boolean;
    /** PD-06: sin valor definido, la garantía queda sin duración. */
    readonly warrantyMonthsDefault: number | null;
  };
  readonly policy?: PermissionPolicy;
  /** Turnos de caja: si se da, todo cobro exige que quien cobra tenga su turno abierto [S3-16]. */
  readonly shifts?: { openFor(userId: string): Promise<{ readonly id: string } | null> };
}

const permisos = (d: OrderDeps): PermissionPolicy => d.policy ?? defaultPermissionPolicy;
const ahora = (d: OrderDeps): string => d.clock.now().toISOString();

/** Quien puede ver y llevar órdenes: administradores y cajeros. */
function puedeTrabajarOrdenes(d: OrderDeps, actor: QuoteActor): boolean {
  return permisos(d).check(actor.role, 'ORDER_ADVANCE') !== 'DENY';
}

function lineaAPayload(l: WorkOrderLine) {
  return {
    id: l.id,
    productId: l.productId,
    name: l.name,
    chargeUnit: l.chargeUnit,
    unitPriceCents: l.unitPriceCents,
    catalogPriceCents: l.catalogPriceCents,
    ruleId: l.ruleId,
    ruleParams: l.ruleParams ?? {},
    widthMm: l.widthMm,
    heightMm: l.heightMm,
    quantity: l.quantity,
    lineTotalCents: l.lineTotalCents,
    baseCents: l.baseCents,
    taxCents: l.taxCents,
    isTaxExempt: l.isTaxExempt,
    detail: l.detail,
    ...(l.displayUnit === undefined || l.displayUnit === null
      ? {}
      : { displayUnit: l.displayUnit }),
  };
}

function anticipoExigido(totalCents: number, bps: number): number | null {
  const total = money(totalCents);
  if (!total.ok) {
    return null;
  }
  const a = computeDeposit(total.value, bps);
  return a.ok ? a.value.deposit : null;
}

interface NuevaOrden {
  readonly customerId: CustomerId;
  readonly quoteId: string | null;
  readonly siteAddress: string | null;
  readonly description: string | null;
  readonly lines: readonly WorkOrderLine[];
}

/** Crea la orden con su folio provisional y su operación `CreateWorkOrder` en una sola transacción local
 *  [S3-01]. Las líneas y los totales se copian tal cual: no se recalcula nada [RN-03]. */
async function crearOrden(
  deps: OrderDeps,
  actor: QuoteActor,
  entrada: NuevaOrden,
): Promise<Result<WorkOrder, OrderError>> {
  if (entrada.lines.length === 0) {
    return err({ code: 'EMPTY_ORDER' });
  }
  const totales = quoteTotals(entrada.lines);
  const anticipo = anticipoExigido(totales.totalCents, deps.settings.depositPercentBps);
  if (anticipo === null) {
    return err({ code: 'STORAGE_FAILED' });
  }
  const instante = ahora(deps);
  try {
    const orden = await deps.outbox.transaction(async (tx): Promise<WorkOrder> => {
      const numero = await tx.nextTempNumber();
      const folio = formatTempFolio(deps.device.series, numero);
      if (!folio.ok) {
        throw new Error('INVALID_TEMP_FOLIO');
      }
      const nueva: WorkOrder = {
        id: deps.idGenerator.newId<'WorkOrder'>(),
        status: 'WAITING',
        customerId: entrada.customerId,
        quoteId: entrada.quoteId,
        siteAddress: entrada.siteAddress,
        description: entrada.description,
        lines: entrada.lines,
        subtotalCents: totales.subtotalCents,
        taxCents: totales.taxCents,
        totalCents: totales.totalCents,
        depositPercentBps: deps.settings.depositPercentBps,
        depositRequiredCents: anticipo,
        measuredBy: null,
        builtBy: null,
        installedBy: null,
        estimatedDeliveryDate: null,
        notes: null,
        tempFolio: folio.value,
        folio: null,
        publicCode: generatePublicCode(deps.random),
        issuedAt: instante,
        deliveredAt: null,
        deliveredWithBalance: false,
        deliveryReason: null,
        deliveryAuthorizedBy: null,
        cancelledAt: null,
        cancelReason: null,
        cancelledFromStatus: null,
        cancelDepositPaidCents: null,
        userId: actor.userId,
        syncStatus: 'SAVED_ON_TABLET',
        reviewReason: null,
        updatedAt: instante,
      };
      const operacion = await tx.enqueue({
        opId: deps.idGenerator.newId<'Operation'>(),
        deviceId: deps.device.id,
        type: 'CreateWorkOrder',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        userId: actor.userId,
        clientCreatedAt: instante,
        payload: {
          id: nueva.id,
          tempFolio: nueva.tempFolio,
          publicCode: nueva.publicCode,
          customerId: nueva.customerId,
          quoteId: nueva.quoteId,
          siteAddress: nueva.siteAddress,
          description: nueva.description,
          issuedAt: nueva.issuedAt,
          depositPercentBps: nueva.depositPercentBps,
          depositRequiredCents: nueva.depositRequiredCents,
          subtotalCents: nueva.subtotalCents,
          taxCents: nueva.taxCents,
          totalCents: nueva.totalCents,
          lines: nueva.lines.map(lineaAPayload),
        },
      });
      if (!operacion.ok) {
        throw new Error('INVALID_OPERATION');
      }
      await tx.putDocument(WORK_ORDERS_COLLECTION, nueva.id, nueva);
      if (entrada.quoteId !== null) {
        const q = (await tx.getDocument('quotes', entrada.quoteId)) as Record<string, unknown>;
        await tx.putDocument('quotes', entrada.quoteId, {
          ...q,
          convertedWorkOrderId: nueva.id,
          updatedAt: instante,
        });
      }
      return nueva;
    });
    return ok(orden);
  } catch {
    return err({ code: 'STORAGE_FAILED' });
  }
}

/** Convierte una cotización aceptada en orden de trabajo en un solo paso [RF-M2-08, RF-M3-01]. */
export async function convertQuoteToWorkOrder(
  deps: OrderDeps,
  actor: QuoteActor,
  quoteId: string,
): Promise<Result<WorkOrder, OrderError>> {
  if (!puedeTrabajarOrdenes(deps, actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const q = await deps.quotes.get(quoteId as QuoteId);
  if (q === null) {
    return err({ code: 'NOT_FOUND' });
  }
  if (q.status !== 'ACCEPTED') {
    return err({ code: 'QUOTE_NOT_ACCEPTED' });
  }
  if (q.convertedWorkOrderId !== undefined && q.convertedWorkOrderId !== null) {
    return err({ code: 'ALREADY_CONVERTED' });
  }
  return crearOrden(deps, actor, {
    customerId: q.customerId,
    quoteId: q.id,
    siteAddress: q.siteAddress,
    description: null,
    lines: q.lines,
  });
}

/** Crea una orden sin cotización previa, con líneas ya armadas con las reglas de precio [RF-M3-01]. */
export async function createManualWorkOrder(
  deps: OrderDeps,
  actor: QuoteActor,
  entrada: Omit<NuevaOrden, 'quoteId'>,
): Promise<Result<WorkOrder, OrderError>> {
  if (!puedeTrabajarOrdenes(deps, actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  return crearOrden(deps, actor, { ...entrada, quoteId: null });
}

async function cargar(deps: OrderDeps, id: string): Promise<Result<WorkOrder, OrderError>> {
  const o = await deps.orders.get(id);
  return o === null ? err({ code: 'NOT_FOUND' }) : ok(o);
}

/** Guarda la orden modificada y su operación en la misma transacción local. */
async function aplicar(
  deps: OrderDeps,
  actor: QuoteActor,
  nueva: WorkOrder,
  operacion: {
    readonly type: 'UpdateWorkOrder' | 'AdvanceWorkOrder' | 'DeliverWorkOrder' | 'CancelWorkOrder';
    readonly payload: unknown;
    readonly authorizedBy?: string | null;
  },
  extras?: (tx: Parameters<Parameters<SyncOutbox['transaction']>[0]>[0]) => Promise<void>,
): Promise<Result<WorkOrder, OrderError>> {
  try {
    await deps.outbox.transaction(async (tx) => {
      const r = await tx.enqueue({
        opId: deps.idGenerator.newId<'Operation'>(),
        deviceId: deps.device.id,
        type: operacion.type,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        userId: actor.userId,
        ...(operacion.authorizedBy === undefined || operacion.authorizedBy === null
          ? {}
          : { authorizedBy: operacion.authorizedBy }),
        clientCreatedAt: nueva.updatedAt,
        payload: operacion.payload,
      });
      if (!r.ok) {
        throw new Error('INVALID_OPERATION');
      }
      await tx.putDocument(WORK_ORDERS_COLLECTION, nueva.id, nueva);
      await extras?.(tx);
    });
    return ok(nueva);
  } catch {
    return err({ code: 'STORAGE_FAILED' });
  }
}

export interface WorkOrderPatch {
  readonly measuredBy?: UserId | null;
  readonly builtBy?: UserId | null;
  readonly installedBy?: UserId | null;
  readonly estimatedDeliveryDate?: string | null;
  readonly notes?: string | null;
}

/** Cambia responsables, fecha estimada o notas [RF-M3-01, RNF-05]. Solo viaja lo que cambió, así dos
 *  tablets que editan campos distintos conservan ambos cambios. */
export async function updateWorkOrder(
  deps: OrderDeps,
  actor: QuoteActor,
  id: string,
  parche: WorkOrderPatch,
): Promise<Result<WorkOrder, OrderError>> {
  if (!puedeTrabajarOrdenes(deps, actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const o = await cargar(deps, id);
  if (!o.ok) {
    return o;
  }
  if (o.value.status === 'CANCELLED') {
    return err({ code: 'INVALID_TRANSITION' });
  }
  if (Object.keys(parche).length === 0) {
    return err({ code: 'NOTHING_TO_UPDATE' });
  }
  if (
    parche.estimatedDeliveryDate !== undefined &&
    parche.estimatedDeliveryDate !== null &&
    !/^\d{4}-\d{2}-\d{2}$/.test(parche.estimatedDeliveryDate)
  ) {
    return err({ code: 'INVALID_DATE' });
  }
  const notas =
    parche.notes === undefined
      ? undefined
      : (parche.notes?.trim() ?? '') === ''
        ? null
        : parche.notes?.trim();
  const limpio = { ...parche, ...(notas === undefined ? {} : { notes: notas }) };
  const nueva: WorkOrder = {
    ...o.value,
    ...(limpio.measuredBy === undefined ? {} : { measuredBy: limpio.measuredBy }),
    ...(limpio.builtBy === undefined ? {} : { builtBy: limpio.builtBy }),
    ...(limpio.installedBy === undefined ? {} : { installedBy: limpio.installedBy }),
    ...(limpio.estimatedDeliveryDate === undefined
      ? {}
      : { estimatedDeliveryDate: limpio.estimatedDeliveryDate }),
    ...(limpio.notes === undefined ? {} : { notes: limpio.notes }),
    syncStatus: 'SAVED_ON_TABLET',
    updatedAt: ahora(deps),
  };
  return aplicar(deps, actor, nueva, {
    type: 'UpdateWorkOrder',
    payload: { id, patch: limpio },
  });
}

async function pagadoDe(deps: OrderDeps, orderId: string): Promise<number> {
  const pagos = await deps.payments.listByTarget(orderId);
  return pagos.reduce((suma, p) => suma + p.amountCents, 0);
}

/** Saldo de una orden: total − pagos, siempre calculado [RF-M3-03]. */
export async function workOrderBalance(deps: OrderDeps, orderId: string): Promise<number | null> {
  const o = await deps.orders.get(orderId);
  return o === null ? null : balanceCents(o.totalCents, await deps.payments.listByTarget(orderId));
}

/** Avanza la orden a "en proceso" o a "listo" [RF-M3-02]. Entregar es otra acción (`deliverWorkOrder`).
 *  Empezar sin anticipo registrado pide la autorización de un administrador (PD-39, configurable);
 *  un administrador se autoriza a sí mismo. */
export async function advanceWorkOrder(
  deps: OrderDeps,
  actor: QuoteActor,
  id: string,
  authorization?: Authorization,
): Promise<Result<WorkOrder, OrderError>> {
  if (!puedeTrabajarOrdenes(deps, actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const o = await cargar(deps, id);
  if (!o.ok) {
    return o;
  }
  const siguiente: WorkOrderStatus | null =
    o.value.status === 'WAITING' ? 'IN_PROCESS' : o.value.status === 'IN_PROCESS' ? 'READY' : null;
  if (siguiente === null || !checkWorkOrderTransition(o.value.status, siguiente).ok) {
    return err({ code: 'INVALID_TRANSITION' });
  }
  let autorizo: string | null = null;
  if (
    siguiente === 'IN_PROCESS' &&
    deps.settings.requireDepositToStart &&
    (await pagadoDe(deps, id)) === 0
  ) {
    if (actor.role === 'ADMIN') {
      autorizo = actor.userId;
    } else if (authorization !== undefined) {
      autorizo = authorization.adminId;
    } else {
      return err({ code: 'NEEDS_AUTHORIZATION' });
    }
  }
  const nueva: WorkOrder = {
    ...o.value,
    status: siguiente,
    syncStatus: 'SAVED_ON_TABLET',
    updatedAt: ahora(deps),
  };
  return aplicar(deps, actor, nueva, {
    type: 'AdvanceWorkOrder',
    payload: { id, to: siguiente },
    authorizedBy: autorizo,
  });
}

/** Entrega la orden y crea su garantía escrita [RF-M3-04, RF-M3-05, RN-14]. Con saldo pendiente solo un
 *  administrador (o un cajero con el PIN de uno) puede, y con motivo; el saldo queda como cuenta por cobrar. */
export async function deliverWorkOrder(
  deps: OrderDeps,
  actor: QuoteActor,
  id: string,
  opciones: { readonly reason?: string; readonly authorization?: Authorization } = {},
): Promise<Result<WorkOrder, OrderError>> {
  if (!puedeTrabajarOrdenes(deps, actor)) {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const o = await cargar(deps, id);
  if (!o.ok) {
    return o;
  }
  if (!checkWorkOrderTransition(o.value.status, 'DELIVERED').ok) {
    return err({ code: 'INVALID_TRANSITION' });
  }
  const saldo = balanceCents(o.value.totalCents, await deps.payments.listByTarget(id));
  let autorizo: string | null = null;
  const motivo = opciones.reason?.trim() ?? '';
  if (saldo > 0) {
    if (actor.role === 'ADMIN') {
      autorizo = actor.userId;
    } else if (opciones.authorization !== undefined) {
      autorizo = opciones.authorization.adminId;
    } else {
      return err({ code: 'NOT_AUTHORIZED' });
    }
    if (motivo === '') {
      return err({ code: 'REASON_REQUIRED' });
    }
  }
  const instante = ahora(deps);
  const nueva: WorkOrder = {
    ...o.value,
    status: 'DELIVERED',
    deliveredAt: instante,
    deliveredWithBalance: saldo > 0,
    deliveryReason: saldo > 0 ? motivo : null,
    deliveryAuthorizedBy: autorizo,
    syncStatus: 'SAVED_ON_TABLET',
    updatedAt: instante,
  };
  const garantia: Warranty = {
    workOrderId: id,
    startsOn: mexicoDate(deps.clock.now()),
    durationMonths: deps.settings.warrantyMonthsDefault,
    coverage: null,
    exclusions: null,
  };
  return aplicar(
    deps,
    actor,
    nueva,
    {
      type: 'DeliverWorkOrder',
      payload: { id, ...(saldo > 0 ? { reason: motivo } : {}) },
      authorizedBy: autorizo,
    },
    async (tx) => {
      await tx.putDocument(WARRANTIES_COLLECTION, id, garantia);
    },
  );
}

/** Cancela la orden con motivo; nada se borra [RF-M3-08, RN-18]. Solo un administrador (o un cajero con el
 *  PIN de uno). El anticipo recibido se registra sin devolución automática (PD-07). */
export async function cancelWorkOrder(
  deps: OrderDeps,
  actor: QuoteActor,
  id: string,
  reason: string,
  authorization?: Authorization,
): Promise<Result<WorkOrder, OrderError>> {
  const decision = permisos(deps).check(actor.role, 'CANCEL_SALE_OR_ORDER');
  let autorizo: string;
  if (decision === 'DENY') {
    if (authorization === undefined) {
      return err({ code: 'NOT_AUTHORIZED' });
    }
    autorizo = authorization.adminId;
  } else {
    autorizo = actor.userId;
  }
  const motivo = reason.trim();
  if (motivo === '') {
    return err({ code: 'REASON_REQUIRED' });
  }
  const o = await cargar(deps, id);
  if (!o.ok) {
    return o;
  }
  if (!checkWorkOrderTransition(o.value.status, 'CANCELLED').ok) {
    return err({ code: 'INVALID_TRANSITION' });
  }
  const instante = ahora(deps);
  const nueva: WorkOrder = {
    ...o.value,
    status: 'CANCELLED',
    cancelledAt: instante,
    cancelReason: motivo,
    cancelledFromStatus: o.value.status,
    cancelDepositPaidCents: await pagadoDe(deps, id),
    syncStatus: 'SAVED_ON_TABLET',
    updatedAt: instante,
  };
  return aplicar(deps, actor, nueva, {
    type: 'CancelWorkOrder',
    payload: { id, reason: motivo },
    authorizedBy: autorizo,
  });
}

export type RegisterPaymentError = OrderError | PaymentError;

/** Registra el cobro de una orden (anticipo o saldo) con su método y quién cobró [RF-M3-03, RF-M4-05].
 *  Los pagos solo se agregan. Es el mismo cobro que usará el mostrador. */
export async function registerWorkOrderPayment(
  deps: OrderDeps,
  actor: QuoteActor,
  orderId: string,
  rows: readonly PaymentRowInput[],
): Promise<
  Result<
    { readonly payments: readonly Payment[]; readonly plan: PaymentPlan },
    RegisterPaymentError
  >
> {
  if (permisos(deps).check(actor.role, 'SALE_REGISTER') === 'DENY') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const o = await cargar(deps, orderId);
  if (!o.ok) {
    return o;
  }
  if (o.value.status === 'CANCELLED') {
    return err({ code: 'ORDER_CANCELLED' });
  }
  let turnoId: string | null = null;
  if (deps.shifts !== undefined) {
    const turno = await deps.shifts.openFor(actor.userId);
    if (turno === null) {
      return err({ code: 'NO_OPEN_SHIFT' });
    }
    turnoId = turno.id;
  }
  const pagado = await pagadoDe(deps, orderId);
  const kind = paymentKindForOrder(pagado);
  const plan = planPayment({ kind, balanceCents: o.value.totalCents - pagado, rows });
  if (!plan.ok) {
    return plan;
  }
  const instante = ahora(deps);
  const grupo = deps.idGenerator.newId<'PaymentGroup'>();
  const pagos: Payment[] = plan.value.rows.map((f) => ({
    id: deps.idGenerator.newId<'Payment'>(),
    groupId: grupo,
    targetType: 'WORK_ORDER',
    targetId: orderId,
    kind,
    method: f.method,
    amountCents: f.amountCents,
    cashReceivedCents: f.cashReceivedCents,
    changeCents: f.changeCents,
    reference: f.reference,
    userId: actor.userId,
    deviceId: deps.device.id,
    paidAt: instante,
    cashShiftId: turnoId,
  }));
  try {
    await deps.outbox.transaction(async (tx) => {
      const operacion = await tx.enqueue({
        opId: deps.idGenerator.newId<'Operation'>(),
        deviceId: deps.device.id,
        type: 'RegisterPayment',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        userId: actor.userId,
        clientCreatedAt: instante,
        payload: {
          groupId: grupo,
          target: { type: 'WORK_ORDER', id: orderId },
          kind,
          paidAt: instante,
          ...(turnoId === null ? {} : { cashShiftId: turnoId }),
          rows: pagos.map((p) => ({
            id: p.id,
            method: p.method,
            amountCents: p.amountCents,
            ...(p.cashReceivedCents === null ? {} : { cashReceivedCents: p.cashReceivedCents }),
            ...(p.reference === null ? {} : { reference: p.reference }),
          })),
        },
      });
      if (!operacion.ok) {
        throw new Error('INVALID_OPERATION');
      }
      for (const p of pagos) {
        await tx.putDocument(PAYMENTS_COLLECTION, p.id, p);
      }
      await tx.putDocument(WORK_ORDERS_COLLECTION, orderId, {
        ...o.value,
        syncStatus: 'SAVED_ON_TABLET',
        updatedAt: instante,
      });
    });
  } catch {
    return err({ code: 'STORAGE_FAILED' });
  }
  return ok({ payments: pagos, plan: plan.value });
}

export type { WorkOrderId };
