import type { SupabaseClient } from '@supabase/supabase-js';
import { err, ok, type QuoteConditionsStore } from '@zammir/core';

const CLAVE = 'quote_conditions';

/** Las condiciones de la cotización en `business_settings`. La política de la tabla deja cambiar el
 *  valor solo a administradores; para cualquier otra cuenta la actualización no toca ninguna fila. */
export function supabaseQuoteConditions(cliente: SupabaseClient): QuoteConditionsStore {
  return {
    async read() {
      const { data, error } = await cliente
        .from('business_settings')
        .select('value')
        .eq('key', CLAVE)
        .limit(1);
      const valor = (data as { readonly value: unknown }[] | null)?.[0]?.value;
      if (error !== null) {
        return err({ code: 'SETTINGS_UNAVAILABLE' });
      }
      return typeof valor === 'string' ? ok(valor) : err({ code: 'SETTINGS_INVALID' });
    },
    async write(texto) {
      const { data, error } = await cliente
        .from('business_settings')
        .update({ value: texto })
        .eq('key', CLAVE)
        .select('key');
      if (error !== null) {
        return err({ code: error.code === '42501' ? 'NOT_AUTHORIZED' : 'SETTINGS_UNAVAILABLE' });
      }
      return (data ?? []).length === 0 ? err({ code: 'NOT_AUTHORIZED' }) : ok(undefined);
    },
  };
}
