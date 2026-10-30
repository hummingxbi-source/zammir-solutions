import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asId,
  err,
  ok,
  pageSize,
  type AuditAction,
  type AuditEntry,
  type AuditPage,
  type AuditReader,
  type Json,
} from '@zammir/core';

const SIN_PERMISO = '42501';

interface FilaDeBitacora {
  readonly id: string;
  readonly occurred_at: string;
  readonly user_id: string | null;
  readonly device_id: string | null;
  readonly authorized_by: string | null;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly old_value: Json;
  readonly new_value: Json;
}

function aEntrada(fila: FilaDeBitacora): AuditEntry {
  return {
    id: asId<'AuditEntry'>(fila.id),
    occurredAt: new Date(fila.occurred_at),
    userId: fila.user_id === null ? null : asId<'User'>(fila.user_id),
    deviceId: fila.device_id === null ? null : asId<'Device'>(fila.device_id),
    ...(fila.authorized_by === null ? {} : { authorizedBy: asId<'User'>(fila.authorized_by) }),
    action: fila.action as AuditAction,
    entityType: fila.entity_type,
    entityId: fila.entity_id,
    oldValue: fila.old_value,
    newValue: fila.new_value,
  };
}

/** Adaptador de AuditReader sobre `audit_log`. Solo un administrador ve filas (RLS); para cualquier otra
 *  sesión la página sale vacía. La paginación usa la posición (hora, id) de la última entrada vista. */
export function supabaseAuditReader(cliente: SupabaseClient): AuditReader {
  return {
    async query(consulta) {
      const limite = pageSize(consulta.limit);
      let peticion = cliente
        .from('audit_log')
        .select('*')
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
        // Una de más para saber si hay página siguiente.
        .limit(limite + 1);
      if (consulta.from !== undefined)
        peticion = peticion.gte('occurred_at', consulta.from.toISOString());
      if (consulta.to !== undefined)
        peticion = peticion.lt('occurred_at', consulta.to.toISOString());
      if (consulta.action !== undefined) peticion = peticion.eq('action', consulta.action);
      if (consulta.userId !== undefined) peticion = peticion.eq('user_id', consulta.userId);
      if (consulta.deviceId !== undefined) peticion = peticion.eq('device_id', consulta.deviceId);
      if (consulta.entityType !== undefined)
        peticion = peticion.eq('entity_type', consulta.entityType);
      if (consulta.after !== undefined) {
        const hora = consulta.after.occurredAt.toISOString();
        peticion = peticion.or(
          `occurred_at.lt.${hora},and(occurred_at.eq.${hora},id.lt.${consulta.after.id})`,
        );
      }

      const respuesta = await peticion;
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err({
          code: respuesta.error.code === SIN_PERMISO ? 'AUDIT_REJECTED' : 'AUDIT_UNAVAILABLE',
        });
      }
      const filas = (datos as FilaDeBitacora[]).map(aEntrada);
      const pagina = filas.slice(0, limite);
      const ultima = pagina[pagina.length - 1];
      const resultado: AuditPage = {
        entries: pagina,
        next:
          filas.length > limite && ultima !== undefined
            ? { occurredAt: ultima.occurredAt, id: ultima.id }
            : null,
      };
      return ok(resultado);
    },
  };
}
