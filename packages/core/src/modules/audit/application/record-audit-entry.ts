import type { Clock } from '../../../shared-kernel/clock';
import type { DeviceId, IdGenerator, UserId } from '../../../shared-kernel/id';
import { andThen, err, ok, type Result } from '../../../shared-kernel/result';
import type { AuditAction, AuditEntry, Json } from '../domain/audit-entry';
import type { AuditError, AuditLog } from './ports';

export interface RecordAuditEntryDeps {
  readonly auditLog: AuditLog;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

export interface RecordAuditEntryInput {
  readonly userId: UserId | null;
  readonly deviceId: DeviceId | null;
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId: string;
  /** Cómo estaba antes; `null` si no existía. */
  readonly oldValue: Json;
  /** Cómo quedó; `null` si ya no existe. */
  readonly newValue: Json;
}

/** Registra una acción sensible con quién, dónde, cuándo (hora UTC del `Clock`) y los valores
 *  anterior y nuevo [RN-19]. */
export async function recordAuditEntry(
  deps: RecordAuditEntryDeps,
  entrada: RecordAuditEntryInput,
): Promise<Result<AuditEntry, AuditError>> {
  if (entrada.entityType.trim() === '' || entrada.entityId.trim() === '') {
    return err({ code: 'INVALID_AUDIT_INPUT' });
  }

  const registro: AuditEntry = {
    id: deps.idGenerator.newId<'AuditEntry'>(),
    occurredAt: deps.clock.now(),
    userId: entrada.userId,
    deviceId: entrada.deviceId,
    action: entrada.action,
    entityType: entrada.entityType,
    entityId: entrada.entityId,
    oldValue: entrada.oldValue,
    newValue: entrada.newValue,
  };

  const guardado = await deps.auditLog.append(registro);
  return andThen(guardado, () => ok(registro));
}
