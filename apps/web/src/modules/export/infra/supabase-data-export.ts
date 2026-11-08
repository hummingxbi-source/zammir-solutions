import type { SupabaseClient } from '@supabase/supabase-js';
import { parseExportDataset, type DataExportSource } from '@zammir/core';

/** Fuente de la exportación sobre Supabase: la función `admin_export_data()` de la base, que solo atiende a
 *  administradores, entrega los datos del negocio sin PIN ni credenciales y anota la exportación en la bitácora
 *  [S5-08, RNF-22, ADR-0036]. */
export function supabaseDataExport(cliente: SupabaseClient): DataExportSource {
  return {
    async load() {
      const sesion = await cliente.auth.getSession();
      if (sesion.data.session === null) {
        return { kind: 'NOT_AUTHORIZED' };
      }
      let respuesta: Awaited<ReturnType<typeof cliente.rpc>>;
      try {
        respuesta = await cliente.rpc('admin_export_data');
      } catch {
        return { kind: 'NO_NETWORK' };
      }
      if (respuesta.error !== null) {
        if (respuesta.error.code === '42501') {
          return { kind: 'NOT_AUTHORIZED' };
        }
        return { kind: respuesta.status === 0 ? 'NO_NETWORK' : 'UNAVAILABLE' };
      }
      const dataset = parseExportDataset(respuesta.data);
      return dataset === null ? { kind: 'UNAVAILABLE' } : { kind: 'OK', dataset };
    },
  };
}
