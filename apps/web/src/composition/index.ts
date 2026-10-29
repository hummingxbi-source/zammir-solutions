import type { AdminAuth, Clock, DeviceRepository, IdGenerator } from '@zammir/core';

import { supabaseDeviceRepository } from '../modules/devices/infra/supabase-device-repository';
import {
  adminAuthNoConfigurada,
  supabaseAdminAuth,
} from '../modules/identity/infra/supabase-admin-auth';
import { supabaseSettingsRepository } from '../modules/settings/infra/supabase-settings-repository';
import { createSupabaseClient } from '../shared/infra/supabase-client';
import { systemClock } from '../shared/infra/system-clock';
import { uuidIdGenerator } from '../shared/infra/uuid-id-generator';

/** Raíz de composición: el único lugar donde se eligen los adaptadores reales
 *  y se entregan a los casos de uso [00-principios §1.1]. */
export interface Composition {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly adminAuth: AdminAuth;
  /** `null` si no hay servidor configurado. */
  readonly dispositivos: DeviceRepository | null;
  /** Minutos de inactividad para cerrar la sesión de un administrador; `null` = por definir (PD-21). */
  readonly cargarLimiteInactividad: () => Promise<number | null>;
}

export interface EntornoSupabase {
  readonly url?: string | undefined;
  readonly anonKey?: string | undefined;
}

export function createComposition(entorno: EntornoSupabase = {}): Composition {
  const cliente = createSupabaseClient(entorno.url, entorno.anonKey);
  const ajustes = cliente === null ? null : supabaseSettingsRepository(cliente);

  return {
    clock: systemClock,
    idGenerator: uuidIdGenerator,
    adminAuth: cliente === null ? adminAuthNoConfigurada : supabaseAdminAuth(cliente),
    dispositivos: cliente === null ? null : supabaseDeviceRepository(cliente),
    cargarLimiteInactividad: async () => {
      if (ajustes === null) {
        return null;
      }
      const resultado = await ajustes.load();
      return resultado.ok ? resultado.value.admin_idle_logout_minutes : null;
    },
  };
}
