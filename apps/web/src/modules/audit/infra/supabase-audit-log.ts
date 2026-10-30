import { err, ok, type AuditLog } from '@zammir/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Código de PostgreSQL cuando un rol no tiene permiso (políticas RLS o privilegios). */
const SIN_PERMISO = '42501';

/** Adaptador de AuditLog sobre la tabla audit_log. Agregar la misma entrada dos veces deja una sola. */
export function supabaseAuditLog(cliente: SupabaseClient): AuditLog {
  return {
    async append(entrada) {
      const { error } = await cliente.from('audit_log').upsert(
        {
          id: entrada.id,
          occurred_at: entrada.occurredAt.toISOString(),
          user_id: entrada.userId,
          device_id: entrada.deviceId,
          action: entrada.action,
          entity_type: entrada.entityType,
          entity_id: entrada.entityId,
          old_value: entrada.oldValue,
          new_value: entrada.newValue,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      );
      if (error === null) {
        return ok(undefined);
      }
      return err({ code: error.code === SIN_PERMISO ? 'AUDIT_REJECTED' : 'AUDIT_UNAVAILABLE' });
    },
  };
}
