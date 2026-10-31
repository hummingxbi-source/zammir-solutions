import type { Clock } from '../../../shared-kernel/clock';
import { formatTempFolio } from '../../../shared-kernel/folio/folio';
import type { CustomerId, IdGenerator } from '../../../shared-kernel/id';
import type { Random } from '../../../shared-kernel/random';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { Authorization } from '../../identity/application/authorize-with-admin-pin';
import { defaultPermissionPolicy, type PermissionPolicy } from '../../identity/domain/permissions';
import { PAYMENTS_COLLECTION, type PaymentStore } from '../../orders/application/work-order-store';
import {
  planPayment,
  type Payment,
  type PaymentError,
  type PaymentPlan,
  type PaymentRowInput,
} from '../../payments/domain/payment';
import type { QuoteActor } from '../../quotes/application/quote-use-cases';
import type { SyncOutbox } from '../../sync/application/ports';
import { CURRENT_SCHEMA_VERSION } from '../../sync/domain/operation';
import { generatePublicCode } from '../../sync/domain/public-code';
import type { CounterSale } from '../domain/counter-sale';
import { ticketTotals, type Ticket } from '../domain/ticket';
import { COUNTER_SALES_COLLECTION, type CounterSaleStore } from './counter-sale-store';

export type CounterErrorCode =
  | 'NOT_AUTHORIZED'
  | 'NOT_FOUND'
  | 'EMPTY_TICKET'
  | 'REASON_REQUIRED'
  | 'INVALID_TRANSITION'
  | 'STORAGE_FAILED';

export interface CounterError {
  readonly code: CounterErrorCode;
}

export interface CounterDeps {
  readonly sales: CounterSaleStore;
  readonly payments: PaymentStore;
  readonly outbox: SyncOutbox;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
  readonly random: Random;
  /** Identificador del dispositivo y su serie de folios provisionales (`T<n>`). */
  readonly device: { readonly id: string; readonly series: number };
  readonly policy?: PermissionPolicy;
}

const permisos = (d: CounterDeps): PermissionPolicy => d.policy ?? defaultPermissionPolicy;

export type ChargeError = CounterError | PaymentError;

/** Cobra el ticket completo: la venta, su cobro (efectivo con cambio, transferencia o mixto) y su
 *  operación `CreateCounterSale` se guardan juntos en la tablet, con quién cobró, el dispositivo y la hora
 *  [RF-M4-02, RF-M4-03, RN-11]. La venta se paga completa: no hay anticipo en el mostrador. */
export async function chargeCounterSale(
  deps: CounterDeps,
  actor: QuoteActor,
  entrada: {
    readonly ticket: Ticket;
    readonly customerId: CustomerId | null;
    readonly rows: readonly PaymentRowInput[];
  },
): Promise<
  Result<
    {
      readonly sale: CounterSale;
      readonly payments: readonly Payment[];
      readonly plan: PaymentPlan;
    },
    ChargeError
  >
> {
  if (permisos(deps).check(actor.role, 'SALE_REGISTER') === 'DENY') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  if (entrada.ticket.lines.length === 0) {
    return err({ code: 'EMPTY_TICKET' });
  }
  const totales = ticketTotals(entrada.ticket);
  const plan = planPayment({ kind: 'SALE', balanceCents: totales.totalCents, rows: entrada.rows });
  if (!plan.ok) {
    return plan;
  }
  const instante = deps.clock.now().toISOString();
  const idVenta = deps.idGenerator.newId<'CounterSale'>();
  const grupo = deps.idGenerator.newId<'PaymentGroup'>();
  const pagos: Payment[] = plan.value.rows.map((f) => ({
    id: deps.idGenerator.newId<'Payment'>(),
    groupId: grupo,
    targetType: 'COUNTER_SALE',
    targetId: idVenta,
    kind: 'SALE',
    method: f.method,
    amountCents: f.amountCents,
    cashReceivedCents: f.cashReceivedCents,
    changeCents: f.changeCents,
    reference: f.reference,
    userId: actor.userId,
    deviceId: deps.device.id,
    paidAt: instante,
    cashShiftId: null,
  }));
  try {
    const venta = await deps.outbox.transaction(async (tx): Promise<CounterSale> => {
      const numero = await tx.nextTempNumber();
      const folio = formatTempFolio(deps.device.series, numero);
      if (!folio.ok) {
        throw new Error('INVALID_TEMP_FOLIO');
      }
      const nueva: CounterSale = {
        id: idVenta,
        status: 'COMPLETED',
        customerId: entrada.customerId,
        lines: entrada.ticket.lines,
        subtotalCents: totales.subtotalCents,
        taxCents: totales.taxCents,
        totalCents: totales.totalCents,
        tempFolio: folio.value,
        folio: null,
        publicCode: generatePublicCode(deps.random),
        issuedAt: instante,
        userId: actor.userId,
        deviceId: deps.device.id,
        cancelledAt: null,
        cancelReason: null,
        cancelledBy: null,
        syncStatus: 'SAVED_ON_TABLET',
        reviewReason: null,
        updatedAt: instante,
      };
      const operacion = await tx.enqueue({
        opId: deps.idGenerator.newId<'Operation'>(),
        deviceId: deps.device.id,
        type: 'CreateCounterSale',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        userId: actor.userId,
        clientCreatedAt: instante,
        payload: {
          id: nueva.id,
          tempFolio: nueva.tempFolio,
          publicCode: nueva.publicCode,
          ...(nueva.customerId === null ? {} : { customerId: nueva.customerId }),
          issuedAt: instante,
          subtotalCents: nueva.subtotalCents,
          taxCents: nueva.taxCents,
          totalCents: nueva.totalCents,
          lines: nueva.lines.map((l) => ({
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
            displayUnit: l.displayUnit,
          })),
          payment: {
            groupId: grupo,
            rows: pagos.map((p) => ({
              id: p.id,
              method: p.method,
              amountCents: p.amountCents,
              ...(p.cashReceivedCents === null ? {} : { cashReceivedCents: p.cashReceivedCents }),
              ...(p.reference === null ? {} : { reference: p.reference }),
            })),
          },
        },
      });
      if (!operacion.ok) {
        throw new Error('INVALID_OPERATION');
      }
      await tx.putDocument(COUNTER_SALES_COLLECTION, nueva.id, nueva);
      for (const p of pagos) {
        await tx.putDocument(PAYMENTS_COLLECTION, p.id, p);
      }
      return nueva;
    });
    return ok({ sale: venta, payments: pagos, plan: plan.value });
  } catch {
    return err({ code: 'STORAGE_FAILED' });
  }
}

/** Cancela una venta con motivo; nada se borra [RF-M4-07, RN-18]. Solo un administrador (o un cajero con el
 *  PIN de uno). PD-24 sin respuesta: se registra la cancelación y no se toca la caja. */
export async function cancelCounterSale(
  deps: CounterDeps,
  actor: QuoteActor,
  id: string,
  reason: string,
  authorization?: Authorization,
): Promise<Result<CounterSale, CounterError>> {
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
  const venta = await deps.sales.get(id);
  if (venta === null) {
    return err({ code: 'NOT_FOUND' });
  }
  if (venta.status === 'CANCELLED') {
    return err({ code: 'INVALID_TRANSITION' });
  }
  const instante = deps.clock.now().toISOString();
  const nueva: CounterSale = {
    ...venta,
    status: 'CANCELLED',
    cancelledAt: instante,
    cancelReason: motivo,
    cancelledBy: autorizo,
    syncStatus: 'SAVED_ON_TABLET',
    updatedAt: instante,
  };
  try {
    await deps.outbox.transaction(async (tx) => {
      const operacion = await tx.enqueue({
        opId: deps.idGenerator.newId<'Operation'>(),
        deviceId: deps.device.id,
        type: 'CancelCounterSale',
        schemaVersion: CURRENT_SCHEMA_VERSION,
        userId: actor.userId,
        authorizedBy: autorizo,
        clientCreatedAt: instante,
        payload: { id, reason: motivo },
      });
      if (!operacion.ok) {
        throw new Error('INVALID_OPERATION');
      }
      await tx.putDocument(COUNTER_SALES_COLLECTION, id, nueva);
    });
    return ok(nueva);
  } catch {
    return err({ code: 'STORAGE_FAILED' });
  }
}

/** Ventas que cuentan para el cobro: las canceladas quedan aparte (PD-24). */
export function activeSales(ventas: readonly CounterSale[]): readonly CounterSale[] {
  return ventas.filter((v) => v.status === 'COMPLETED');
}
