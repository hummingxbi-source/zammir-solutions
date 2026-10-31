import type { Clock } from '../../../shared-kernel/clock';
import { mexicoDate } from '../../../shared-kernel/date/mx-date';
import type { IdGenerator, UserId } from '../../../shared-kernel/id';
import { err, ok, type Result } from '../../../shared-kernel/result';
import type { CounterSaleStore } from '../../counter/application/counter-sale-store';
import type { Authorization } from '../../identity/application/authorize-with-admin-pin';
import { defaultPermissionPolicy, type PermissionPolicy } from '../../identity/domain/permissions';
import type { PaymentStore } from '../../orders/application/work-order-store';
import type { QuoteActor } from '../../quotes/application/quote-use-cases';
import type { SyncOutbox } from '../../sync/application/ports';
import { CURRENT_SCHEMA_VERSION } from '../../sync/domain/operation';
import {
  summarizeDay,
  summarizeShift,
  type CashShift,
  type CashShiftSummary,
  type DaySummary,
} from '../domain/cash-shift';
import { CASH_SHIFTS_COLLECTION, type CashShiftStore } from './cash-shift-store';

export type CashErrorCode =
  | 'NOT_AUTHORIZED'
  | 'NOT_FOUND'
  | 'SHIFT_ALREADY_OPEN'
  | 'NO_OPEN_SHIFT'
  | 'ALREADY_CLOSED'
  | 'NOT_CLOSED'
  | 'AMOUNT_INVALID'
  | 'REASON_REQUIRED'
  | 'STORAGE_FAILED';

export interface CashError {
  readonly code: CashErrorCode;
}

export interface CashDeps {
  readonly shifts: CashShiftStore;
  readonly payments: PaymentStore;
  readonly sales: CounterSaleStore;
  readonly outbox: SyncOutbox;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
  readonly device: { readonly id: string };
  readonly policy?: PermissionPolicy;
}

const permisos = (d: CashDeps): PermissionPolicy => d.policy ?? defaultPermissionPolicy;
const esEntero = (n: number): boolean => Number.isSafeInteger(n) && n >= 0;

async function guardar(
  deps: CashDeps,
  actor: QuoteActor,
  turno: CashShift,
  operacion: {
    readonly type: 'OpenCashShift' | 'CloseCashShift' | 'ReopenCashShift';
    readonly payload: unknown;
    readonly authorizedBy?: string;
  },
): Promise<Result<CashShift, CashError>> {
  try {
    await deps.outbox.transaction(async (tx) => {
      const r = await tx.enqueue({
        opId: deps.idGenerator.newId<'Operation'>(),
        deviceId: deps.device.id,
        type: operacion.type,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        userId: actor.userId,
        ...(operacion.authorizedBy === undefined ? {} : { authorizedBy: operacion.authorizedBy }),
        clientCreatedAt: turno.updatedAt,
        payload: operacion.payload,
      });
      if (!r.ok) {
        throw new Error('INVALID_OPERATION');
      }
      await tx.putDocument(CASH_SHIFTS_COLLECTION, turno.id, turno);
    });
    return ok(turno);
  } catch {
    return err({ code: 'STORAGE_FAILED' });
  }
}

/** Abre el turno de caja de la persona, con un fondo inicial opcional [RF-M4-06, S3-16]. Una persona no
 *  puede tener dos turnos abiertos a la vez. */
export async function openCashShift(
  deps: CashDeps,
  actor: QuoteActor,
  entrada: { readonly openingFloatCents?: number } = {},
): Promise<Result<CashShift, CashError>> {
  if (permisos(deps).check(actor.role, 'OWN_CASH_CLOSE') === 'DENY') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const fondo = entrada.openingFloatCents ?? 0;
  if (!esEntero(fondo)) {
    return err({ code: 'AMOUNT_INVALID' });
  }
  if ((await deps.shifts.openFor(actor.userId)) !== null) {
    return err({ code: 'SHIFT_ALREADY_OPEN' });
  }
  const instante = deps.clock.now();
  const turno: CashShift = {
    id: deps.idGenerator.newId<'CashShift'>(),
    cashierId: actor.userId,
    deviceId: deps.device.id,
    status: 'OPEN',
    openedAt: instante.toISOString(),
    openingFloatCents: fondo,
    closedAt: null,
    countedCashCents: null,
    expectedCashCents: null,
    differenceCents: null,
    pendingAtClose: null,
    reopenings: [],
    syncStatus: 'SAVED_ON_TABLET',
    reviewReason: null,
    updatedAt: instante.toISOString(),
  };
  return guardar(deps, actor, turno, {
    type: 'OpenCashShift',
    payload: { id: turno.id, openedAt: turno.openedAt, openingFloatCents: fondo },
  });
}

/** El corte del turno con los cobros que tiene hoy en la tablet. */
export async function shiftSummary(
  deps: CashDeps,
  turno: Pick<CashShift, 'id' | 'openingFloatCents' | 'countedCashCents'>,
): Promise<CashShiftSummary> {
  const pagos = (await deps.payments.list()).filter((p) => p.cashShiftId === turno.id);
  const canceladas = new Set(
    (await deps.sales.list()).filter((v) => v.status === 'CANCELLED').map((v) => v.id),
  );
  return summarizeShift({
    openingFloatCents: turno.openingFloatCents,
    payments: pagos,
    cancelledSaleIds: canceladas,
    countedCashCents: turno.countedCashCents,
  });
}

/** Cuántas operaciones siguen sin enviarse: se avisa antes de cerrar para no cerrar con cifras
 *  incompletas [S3-19, SINCRONIZACION §6.1]. */
export function pendingBeforeClose(deps: Pick<CashDeps, 'outbox'>): Promise<number> {
  return deps.outbox.pendingCount();
}

/** Cierra el turno con el efectivo contado: calcula cobros por método, efectivo esperado y diferencia
 *  [S3-17]. Cada quien cierra el suyo; un administrador puede cerrar el de otra persona. Un corte cerrado
 *  no se edita. */
export async function closeCashShift(
  deps: CashDeps,
  actor: QuoteActor,
  shiftId: string,
  countedCashCents: number,
): Promise<
  Result<
    {
      readonly shift: CashShift;
      readonly summary: CashShiftSummary;
      /** Operaciones sin enviar al cerrar (la del propio corte no cuenta). */
      readonly pendingOperations: number;
    },
    CashError
  >
> {
  const turno = await deps.shifts.get(shiftId);
  if (turno === null) {
    return err({ code: 'NOT_FOUND' });
  }
  const suyo = turno.cashierId === actor.userId;
  const decision = permisos(deps).check(actor.role, suyo ? 'OWN_CASH_CLOSE' : 'OTHERS_CASH_VIEW');
  if (decision === 'DENY') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  if (turno.status === 'CLOSED') {
    return err({ code: 'ALREADY_CLOSED' });
  }
  if (!esEntero(countedCashCents)) {
    return err({ code: 'AMOUNT_INVALID' });
  }
  const pendientes = await deps.outbox.pendingCount();
  const resumen = await shiftSummary(deps, { ...turno, countedCashCents });
  const instante = deps.clock.now().toISOString();
  const cerrado: CashShift = {
    ...turno,
    status: 'CLOSED',
    closedAt: instante,
    countedCashCents,
    expectedCashCents: resumen.expectedCashCents,
    differenceCents: resumen.differenceCents,
    pendingAtClose: pendientes,
    syncStatus: 'SAVED_ON_TABLET',
    updatedAt: instante,
  };
  const r = await guardar(deps, actor, cerrado, {
    type: 'CloseCashShift',
    payload: {
      id: turno.id,
      closedAt: instante,
      countedCashCents,
      expectedCashCents: resumen.expectedCashCents,
      pendingAtClose: pendientes,
    },
  });
  return r.ok ? ok({ shift: r.value, summary: resumen, pendingOperations: pendientes }) : r;
}

/** Reabre un corte cerrado: solo un administrador (o un cajero con el PIN de uno), con motivo, y queda en
 *  la bitácora [S3-17, RN-19]. */
export async function reopenCashShift(
  deps: CashDeps,
  actor: QuoteActor,
  shiftId: string,
  reason: string,
  authorization?: Authorization,
): Promise<Result<CashShift, CashError>> {
  let autorizo: string;
  if (actor.role === 'ADMIN') {
    autorizo = actor.userId;
  } else if (authorization !== undefined) {
    autorizo = authorization.adminId;
  } else {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const motivo = reason.trim();
  if (motivo === '') {
    return err({ code: 'REASON_REQUIRED' });
  }
  const turno = await deps.shifts.get(shiftId);
  if (turno === null) {
    return err({ code: 'NOT_FOUND' });
  }
  if (turno.status !== 'CLOSED') {
    return err({ code: 'NOT_CLOSED' });
  }
  const instante = deps.clock.now().toISOString();
  const reabierto: CashShift = {
    ...turno,
    status: 'OPEN',
    closedAt: null,
    reopenings: [...turno.reopenings, { adminId: autorizo, reason: motivo, at: instante }],
    syncStatus: 'SAVED_ON_TABLET',
    updatedAt: instante,
  };
  return guardar(deps, actor, reabierto, {
    type: 'ReopenCashShift',
    payload: { id: turno.id, reason: motivo },
    authorizedBy: autorizo,
  });
}

/** Turnos que una persona puede ver: los suyos; un administrador, todos [RF-M4-06, RN-11]. */
export async function visibleShifts(
  deps: CashDeps,
  actor: QuoteActor,
): Promise<readonly CashShift[]> {
  const todos = await deps.shifts.list();
  const verTodos = permisos(deps).check(actor.role, 'OTHERS_CASH_VIEW') !== 'DENY';
  return todos
    .filter((t) => verTodos || t.cashierId === actor.userId)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

/** Corte consolidado del día (hora de México), por método y por cajero: solo administradores [S3-18]. */
export async function dayReport(
  deps: CashDeps,
  actor: QuoteActor,
  fecha: string = mexicoDate(deps.clock.now()),
): Promise<Result<DaySummary, CashError>> {
  if (permisos(deps).check(actor.role, 'OTHERS_CASH_VIEW') === 'DENY') {
    return err({ code: 'NOT_AUTHORIZED' });
  }
  const turnos = (await deps.shifts.list()).filter(
    (t) => mexicoDate(new Date(t.openedAt)) === fecha,
  );
  const conResumen = await Promise.all(
    turnos.map(async (shift) => ({ shift, summary: await shiftSummary(deps, shift) })),
  );
  return ok(summarizeDay(fecha, conResumen));
}

export type { UserId };
