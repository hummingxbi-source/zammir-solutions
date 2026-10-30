import { ok } from '../../../shared-kernel/result';
import type { AuditEntry } from '../domain/audit-entry';
import type { AuditLog } from './ports';

export interface InMemoryAuditLog extends AuditLog {
  /** Las entradas guardadas, en el orden en que se agregaron. */
  entries(): readonly AuditEntry[];
}

/** Adaptador en memoria del puerto AuditLog, para pruebas. */
export function inMemoryAuditLog(): InMemoryAuditLog {
  const guardadas = new Map<string, AuditEntry>();
  return {
    append(entrada) {
      if (!guardadas.has(entrada.id)) {
        guardadas.set(entrada.id, entrada);
      }
      return Promise.resolve(ok(undefined));
    },
    entries: () => [...guardadas.values()],
  };
}
