import type { Result } from '../../../shared-kernel/result';
import type { AuditEntry } from '../domain/audit-entry';

export type AuditErrorCode =
  /** Los datos de la entrada no son válidos. */
  | 'INVALID_AUDIT_INPUT'
  /** El servidor no permitió guardarla (por ejemplo, la cuenta no tiene permiso). */
  | 'AUDIT_REJECTED'
  /** No se pudo guardar por falta de conexión u otra falla. */
  | 'AUDIT_UNAVAILABLE';

export interface AuditError {
  readonly code: AuditErrorCode;
}

/** Puerto: bitácora de acciones sensibles. Solo se agrega.
 *  Agregar dos veces la misma entrada (mismo `id`) deja una sola: el envío es idempotente [ADR-0016]. */
export interface AuditLog {
  append(entrada: AuditEntry): Promise<Result<void, AuditError>>;
}
