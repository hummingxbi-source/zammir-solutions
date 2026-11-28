import type { SupabaseClient } from '@supabase/supabase-js';
import { err, ok, readSaleUnitSuggestions, type SaleUnitSuggestionsStore } from '@zammir/core';

const CLAVE = 'sale_unit_suggestions';

/** Las unidades de venta sugeridas en `business_settings` [RF-M1-11, PP-40]. Solo administradores cambian el
 *  valor; para cualquier otra cuenta la actualización no toca ninguna fila. */
export function supabaseUnidadesDeVenta(cliente: SupabaseClient): SaleUnitSuggestionsStore {
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
      const unidades = readSaleUnitSuggestions(data[0]?.value);
      return unidades === null ? err({ code: 'SETTINGS_INVALID' }) : ok(unidades);
    },
    async write(unidades) {
      const { data, error } = await cliente
        .from('business_settings')
        .update({ value: unidades })
        .eq('key', CLAVE)
        .select('key');
      if (error !== null) {
        return err({ code: error.code === '42501' ? 'NOT_AUTHORIZED' : 'SETTINGS_UNAVAILABLE' });
      }
      return data.length === 0 ? err({ code: 'NOT_AUTHORIZED' }) : ok(undefined);
    },
  };
}
