import { err, parseBusinessSettings, type SettingRow, type SettingsRepository } from '@zammir/core';
import type { SupabaseClient } from '@supabase/supabase-js';

function esFila(valor: unknown): valor is SettingRow {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    'key' in valor &&
    typeof valor.key === 'string' &&
    'value' in valor
  );
}

/** Adaptador de SettingsRepository sobre la tabla business_settings.
 *  Las políticas RLS dejan leerla solo a administradores y dispositivos con sesión. */
export function supabaseSettingsRepository(cliente: SupabaseClient): SettingsRepository {
  return {
    async load() {
      const { data, error } = await cliente.from('business_settings').select('key, value');
      if (error !== null) {
        return err({ code: 'SETTINGS_UNAVAILABLE', problemas: [error.message] });
      }
      const filas: unknown = data;
      if (!Array.isArray(filas) || !filas.every(esFila)) {
        return err({
          code: 'SETTINGS_UNAVAILABLE',
          problemas: ['La respuesta no tiene el formato esperado'],
        });
      }
      return parseBusinessSettings(filas);
    },
  };
}
