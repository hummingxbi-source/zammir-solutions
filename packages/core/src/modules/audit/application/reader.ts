import type { DeviceId, UserId } from '../../../shared-kernel/id';
import { err, type Result } from '../../../shared-kernel/result';
import type { Actor } from '../../identity/domain/auth';
import type { AuditAction, AuditEntry } from '../domain/audit-entry';
import type { AuditError } from './ports';

/** Posición de la última entrada vista: la siguiente página empieza justo después. */
export interface AuditCursor {
  readonly occurredAt: Date;
  readonly id: string;
}

export interface AuditQuery {
  /** Desde esta hora (incluida). */
  readonly from?: Date;
  /** Hasta esta hora (excluida). */
  readonly to?: Date;
  readonly action?: AuditAction;
  readonly userId?: UserId;
  readonly deviceId?: DeviceId;
  readonly entityType?: string;
  /** Cuántas entradas por página; se acota a `MAX_AUDIT_PAGE`. */
  readonly limit?: number;
  readonly after?: AuditCursor;
}

export interface AuditPage {
  /** De la más reciente a la más antigua. */
  readonly entries: readonly AuditEntry[];
  /** Para pedir la siguiente página; `null` si ya no hay más. */
  readonly next: AuditCursor | null;
}

export const DEFAULT_AUDIT_PAGE = 50;
export const MAX_AUDIT_PAGE = 200;

/** Puerto: consulta de la bitácora [RF-M8-03]. Solo la ve un administrador. */
export interface AuditReader {
  query(consulta: AuditQuery): Promise<Result<AuditPage, AuditError>>;
}

/** Cuántas entradas pedir: el valor dado, acotado entre 1 y el máximo. */
export function pageSize(limit: number | undefined): number {
  const pedido = limit ?? DEFAULT_AUDIT_PAGE;
  return Math.min(MAX_AUDIT_PAGE, Math.max(1, Math.trunc(pedido)));
}

/** Consulta la bitácora. Solo administradores: un cajero o la sesión de la tablet no tienen acceso. */
export function listAuditEntries(
  deps: { readonly reader: AuditReader },
  actor: Actor,
  consulta: AuditQuery = {},
): Promise<Result<AuditPage, AuditError>> {
  if (actor.role !== 'ADMIN') {
    return Promise.resolve(err({ code: 'AUDIT_REJECTED' }));
  }
  return deps.reader.query(consulta);
}
