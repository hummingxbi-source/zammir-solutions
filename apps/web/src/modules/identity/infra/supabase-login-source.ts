import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asId,
  err,
  ok,
  type AppUser,
  type LockoutPolicy,
  type LoginReplicaSource,
  type StaffRole,
} from '@zammir/core';

import { supabaseSettingsRepository } from '../../settings/infra/supabase-settings-repository';

interface FilaDeLogin {
  readonly id: string;
  readonly name: string;
  readonly role: StaffRole;
  readonly is_active: boolean;
  readonly pin_salt: string;
  readonly pin_iterations: number;
  readonly pin_hash: string;
  readonly pin_version: number;
}

function aPersona(fila: FilaDeLogin): AppUser {
  return {
    id: asId<'User'>(fila.id),
    name: fila.name,
    role: fila.role,
    isActive: fila.is_active,
    pin: {
      salt: fila.pin_salt,
      iterations: fila.pin_iterations,
      hash: fila.pin_hash,
      version: fila.pin_version,
    },
  };
}

/** Fuente de la entrada con PIN: la vista `login_users` (que incluye a los desactivados, para que la
 *  tablet los saque) y los ajustes de bloqueo. Solo la leen administradores y tablets activas. */
export function supabaseLoginSource(cliente: SupabaseClient): LoginReplicaSource {
  return {
    async load() {
      const respuesta = await cliente.from('login_users').select('*').order('name');
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err({ code: 'USERS_UNAVAILABLE' });
      }
      const ajustes = await supabaseSettingsRepository(cliente).load();
      if (!ajustes.ok) {
        return err({ code: 'USERS_UNAVAILABLE' });
      }
      const {
        pin_max_failed_attempts,
        pin_lock_seconds,
        pin_lock_max_seconds,
        idle_lock_minutes,
        sync_stale_hours,
      } = ajustes.value;
      const v = ajustes.value;
      const lockout: LockoutPolicy | null =
        pin_max_failed_attempts === null || pin_lock_seconds === null
          ? null
          : {
              maxAttempts: pin_max_failed_attempts,
              baseSeconds: pin_lock_seconds,
              capSeconds: pin_lock_max_seconds,
            };
      return ok({
        users: (datos as FilaDeLogin[]).map(aPersona),
        lockout,
        idleLockMinutes: idle_lock_minutes,
        syncStaleHours: sync_stale_hours,
        quote: {
          taxRateBps: v.tax_rate_bps,
          validityDays: v.quote_validity_days,
          conditionsText: v.quote_conditions,
        },
        business: { name: v.business_name, phone: v.business_phone, address: v.business_address },
      });
    },
  };
}
