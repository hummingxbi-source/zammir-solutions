import type { SupabaseClient } from '@supabase/supabase-js';
import { err, ok, type CustomerReplicaSource } from '@zammir/core';

interface FilaReplicada {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
  readonly notes: string | null;
  readonly privacy_notice_version: number | null;
  readonly anonymized_at: string | null;
  readonly change_seq: number;
}

/** De dónde baja la tablet los clientes: la vista `customers_for_device`, que no trae datos fiscales
 *  [RNF-06]. Pide solo lo que cambió después del último número recibido. */
export function supabaseCustomerReplica(cliente: SupabaseClient): CustomerReplicaSource {
  return {
    async changedAfter(seq, limit) {
      const respuesta = await cliente
        .from('customers_for_device')
        .select('id, name, phone, email, notes, privacy_notice_version, anonymized_at, change_seq')
        .gt('change_seq', seq)
        .order('change_seq')
        .limit(limit);
      if (respuesta.error !== null) {
        return err({ code: 'CUSTOMERS_UNAVAILABLE' });
      }
      const filas = (respuesta.data ?? []) as FilaReplicada[];
      return ok(
        filas.map((f) => ({
          id: f.id,
          name: f.name,
          phone: f.phone,
          email: f.email,
          notes: f.notes,
          privacyNoticeVersion: f.privacy_notice_version,
          anonymizedAt: f.anonymized_at,
          changeSeq: Number(f.change_seq),
        })),
      );
    },
  };
}
