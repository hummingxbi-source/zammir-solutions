import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { supabaseDataExport } from './supabase-data-export';

function clienteFalso(opciones: {
  sesion?: boolean;
  rpc?: { data: unknown; error: { code?: string; message: string } | null; status: number };
  rpcLanza?: boolean;
}) {
  const llamadas: string[] = [];
  const cliente = {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: opciones.sesion === false ? null : { access_token: 't' } },
        }),
    },
    rpc: (nombre: string) => {
      llamadas.push(nombre);
      if (opciones.rpcLanza === true) {
        return Promise.reject(new Error('sin red'));
      }
      return Promise.resolve(opciones.rpc ?? { data: null, error: null, status: 200 });
    },
  } as unknown as SupabaseClient;
  return { cliente, llamadas };
}

const DATOS = { generated_at: '2026-11-08T18:00:00Z', tables: { customers: [{ id: 'c1' }] } };

describe('exportación de datos sobre Supabase', () => {
  it('con una sesión de administrador llama a admin_export_data y entrega los datos validados', async () => {
    const { cliente, llamadas } = clienteFalso({ rpc: { data: DATOS, error: null, status: 200 } });
    const r = await supabaseDataExport(cliente).load();
    expect(llamadas).toEqual(['admin_export_data']);
    expect(r).toEqual({
      kind: 'OK',
      dataset: { generatedAt: '2026-11-08T18:00:00.000Z', tables: { customers: [{ id: 'c1' }] } },
    });
  });

  it('sin sesión no llama a la base', async () => {
    const { cliente, llamadas } = clienteFalso({ sesion: false });
    expect(await supabaseDataExport(cliente).load()).toEqual({ kind: 'NOT_AUTHORIZED' });
    expect(llamadas).toEqual([]);
  });

  it('si la base dice que no tiene permiso (42501), no es administrador', async () => {
    const { cliente } = clienteFalso({
      rpc: {
        data: null,
        error: { code: '42501', message: 'Solo los administradores' },
        status: 403,
      },
    });
    expect(await supabaseDataExport(cliente).load()).toEqual({ kind: 'NOT_AUTHORIZED' });
  });

  it('sin conexión (estado 0 o una excepción de red) lo dice', async () => {
    const sinRed = clienteFalso({
      rpc: { data: null, error: { message: 'Failed to fetch' }, status: 0 },
    });
    expect(await supabaseDataExport(sinRed.cliente).load()).toEqual({ kind: 'NO_NETWORK' });
    const lanza = clienteFalso({ rpcLanza: true });
    expect(await supabaseDataExport(lanza.cliente).load()).toEqual({ kind: 'NO_NETWORK' });
  });

  it('cualquier otro error del servidor o una respuesta con otra forma no se entrega', async () => {
    const error = clienteFalso({
      rpc: { data: null, error: { code: '57014', message: 'timeout' }, status: 500 },
    });
    expect(await supabaseDataExport(error.cliente).load()).toEqual({ kind: 'UNAVAILABLE' });
    const rara = clienteFalso({ rpc: { data: { cualquier: 'cosa' }, error: null, status: 200 } });
    expect(await supabaseDataExport(rara.cliente).load()).toEqual({ kind: 'UNAVAILABLE' });
  });
});
