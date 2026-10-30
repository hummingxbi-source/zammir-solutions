import { ok } from '../../../shared-kernel/result';
import type { AuditEntry } from '../domain/audit-entry';
import type { AuditLog } from './ports';
import { pageSize, type AuditPage, type AuditQuery, type AuditReader } from './reader';

export interface InMemoryAuditLog extends AuditLog, AuditReader {
  /** Las entradas guardadas, en el orden en que se agregaron. */
  entries(): readonly AuditEntry[];
}

function masNuevaPrimero(a: AuditEntry, b: AuditEntry): number {
  const porHora = b.occurredAt.getTime() - a.occurredAt.getTime();
  if (porHora !== 0) {
    return porHora;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? 1 : -1;
}

/** Adaptador en memoria de AuditLog y AuditReader, para pruebas. */
export function inMemoryAuditLog(): InMemoryAuditLog {
  const guardadas = new Map<string, AuditEntry>();
  return {
    append(entrada) {
      if (!guardadas.has(entrada.id)) {
        guardadas.set(entrada.id, entrada);
      }
      return Promise.resolve(ok(undefined));
    },

    query(consulta: AuditQuery) {
      const limite = pageSize(consulta.limit);
      const { after } = consulta;
      const filtradas = [...guardadas.values()]
        .filter(
          (e) =>
            (consulta.from === undefined || e.occurredAt >= consulta.from) &&
            (consulta.to === undefined || e.occurredAt < consulta.to) &&
            (consulta.action === undefined || e.action === consulta.action) &&
            (consulta.userId === undefined || e.userId === consulta.userId) &&
            (consulta.deviceId === undefined || e.deviceId === consulta.deviceId) &&
            (consulta.entityType === undefined || e.entityType === consulta.entityType),
        )
        .sort(masNuevaPrimero);
      const siguientes =
        after === undefined
          ? filtradas
          : filtradas.filter(
              (e) =>
                e.occurredAt.getTime() < after.occurredAt.getTime() ||
                (e.occurredAt.getTime() === after.occurredAt.getTime() && e.id < after.id),
            );
      const pagina = siguientes.slice(0, limite);
      const ultima = pagina[pagina.length - 1];
      const resultado: AuditPage = {
        entries: pagina,
        next:
          siguientes.length > limite && ultima !== undefined
            ? { occurredAt: ultima.occurredAt, id: ultima.id }
            : null,
      };
      return Promise.resolve(ok(resultado));
    },

    entries: () => [...guardadas.values()],
  };
}
