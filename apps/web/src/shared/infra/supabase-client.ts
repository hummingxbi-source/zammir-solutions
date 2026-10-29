import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Cliente de Supabase con la llave pública (la seguridad la dan las políticas RLS).
 *  Sin configuración devuelve `null`: la aplicación abre, pero lo que exige servidor no funciona. */
export function createSupabaseClient(
  url: string | undefined,
  anonKey: string | undefined,
): SupabaseClient | null {
  if (url === undefined || url === '' || anonKey === undefined || anonKey === '') {
    return null;
  }
  return createClient(url, anonKey);
}
