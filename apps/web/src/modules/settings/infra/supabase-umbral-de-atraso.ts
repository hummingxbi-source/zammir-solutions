import type { SupabaseClient } from '@supabase/supabase-js';
import { err, ok, type AgingThresholdStore } from '@zammir/core';

const CLAVE = 'receivable_aging_threshold_days';

/** El umbral de antigüedad en `business_settings`. Solo administradores cambian el valor; para cualquier
 *  otra cuenta la actualización no toca ninguna fila. */
export function supabaseUmbralDeAtraso(cliente: SupabaseClient): AgingThresholdStore {
  return {
    async read() {
      const { data, error } = await cliente
        .from('business_settings')
        .select('value')
        .eq('key', CLAVE)
        .limit(1);
      if (error !== null) {
        return err({ code: 'SETTINGS_UNAVAILABLE' });
      }
      const valor: unknown = data[0]?.value;
      return typeof valor === 'number' && Number.isInteger(valor) && valor > 0
        ? ok(valor)
        : err({ code: 'SETTINGS_INVALID' });
    },
    async write(dias) {
      const { data, error } = await cliente
        .from('business_settings')
        .update({ value: dias })
        .eq('key', CLAVE)
        .select('key');
      if (error !== null) {
        return err({ code: error.code === '42501' ? 'NOT_AUTHORIZED' : 'SETTINGS_UNAVAILABLE' });
      }
      return data.length === 0 ? err({ code: 'NOT_AUTHORIZED' }) : ok(undefined);
    },
  };
}
