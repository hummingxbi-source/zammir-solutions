import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asId,
  err,
  ok,
  type LegalDocument,
  type LegalDocumentRepository,
  type LegalDocumentType,
  type LegalError,
} from '@zammir/core';

const SIN_PERMISO = '42501';

interface FilaLegal {
  readonly id: string;
  readonly type: LegalDocumentType;
  readonly version: number;
  readonly effective_from: string;
  readonly body: string;
  readonly edited_by: string | null;
}

function aError(error: { readonly code?: string }): LegalError {
  return error.code === SIN_PERMISO ? { code: 'NOT_AUTHORIZED' } : { code: 'LEGAL_UNAVAILABLE' };
}

function aDocumento(fila: FilaLegal): LegalDocument {
  return {
    id: asId<'LegalDocument'>(fila.id),
    type: fila.type,
    version: fila.version,
    effectiveFrom: new Date(fila.effective_from),
    body: fila.body,
    editedBy: fila.edited_by === null ? null : asId<'User'>(fila.edited_by),
  };
}

/** Adaptador de LegalDocumentRepository sobre `legal_documents`. La base asigna el número de versión,
 *  deja la bitácora y no permite modificar ni borrar versiones. */
export function supabaseLegal(cliente: SupabaseClient): LegalDocumentRepository {
  return {
    async publish(entrada) {
      const respuesta = await cliente
        .from('legal_documents')
        .insert({
          type: entrada.type,
          body: entrada.body,
          effective_from: entrada.effectiveFrom.toISOString(),
        })
        .select()
        .single();
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return ok(aDocumento(datos as FilaLegal));
    },

    async list(type) {
      const respuesta = await cliente
        .from('legal_documents')
        .select('*')
        .eq('type', type)
        .order('version');
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return ok((datos as FilaLegal[]).map(aDocumento));
    },
  };
}
