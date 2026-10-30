import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asId,
  err,
  NO_FISCAL_PROFILE,
  ok,
  type Customer,
  type CustomerError,
  type CustomerRepository,
  type FiscalProfile,
  type Result,
} from '@zammir/core';

const SIN_PERMISO = '42501';

interface FilaDeCliente {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
  readonly notes: string | null;
  readonly privacy_notice_version: number | null;
  readonly anonymized_at: string | null;
  readonly fiscal_rfc?: string | null;
  readonly fiscal_legal_name?: string | null;
  readonly fiscal_zip?: string | null;
  readonly fiscal_regime?: string | null;
  readonly fiscal_cfdi_use?: string | null;
}

function aError(error: { readonly code?: string }): CustomerError {
  return error.code === SIN_PERMISO
    ? { code: 'NOT_AUTHORIZED' }
    : { code: 'CUSTOMERS_UNAVAILABLE' };
}

function aCliente(fila: FilaDeCliente): Customer {
  const fiscal: FiscalProfile =
    fila.fiscal_rfc === undefined
      ? NO_FISCAL_PROFILE
      : {
          rfc: fila.fiscal_rfc,
          legalName: fila.fiscal_legal_name ?? null,
          fiscalZip: fila.fiscal_zip ?? null,
          regime: fila.fiscal_regime ?? null,
          cfdiUse: fila.fiscal_cfdi_use ?? null,
        };
  return {
    id: asId<'Customer'>(fila.id),
    name: fila.name,
    phone: fila.phone,
    email: fila.email,
    notes: fila.notes,
    fiscal,
    privacyNoticeVersion: fila.privacy_notice_version,
    anonymizedAt: fila.anonymized_at === null ? null : new Date(fila.anonymized_at),
  };
}

function aFila(c: Customer) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    fiscal_rfc: c.fiscal.rfc,
    fiscal_legal_name: c.fiscal.legalName,
    fiscal_zip: c.fiscal.fiscalZip,
    fiscal_regime: c.fiscal.regime,
    fiscal_cfdi_use: c.fiscal.cfdiUse,
    privacy_notice_version: c.privacyNoticeVersion,
  };
}

export interface SupabaseCustomersOptions {
  /** `true` para un administrador: lee la tabla completa, con datos fiscales. `false` (por omisión,
   *  la tablet): lee la vista sin datos fiscales [RNF-06] y solo puede dar de alta. */
  readonly conDatosFiscales?: boolean;
}

/** Adaptador de CustomerRepository sobre `customers` (administrador) o `customers_for_device` (tablet).
 *  Los permisos los decide la base (RLS), no este código. */
export function supabaseCustomers(
  cliente: SupabaseClient,
  opciones: SupabaseCustomersOptions = {},
): CustomerRepository {
  const conFiscal = opciones.conDatosFiscales === true;
  const fuente = conFiscal ? 'customers' : 'customers_for_device';

  function aLista(datos: unknown): readonly Customer[] {
    return (datos as FilaDeCliente[]).map(aCliente);
  }

  return {
    async create(nuevo): Promise<Result<Customer, CustomerError>> {
      // Sin `.select()`: la tablet puede dar de alta pero no leer la tabla completa.
      const respuesta = await cliente.from('customers').insert(aFila(nuevo));
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return ok(nuevo);
    },

    async update(editado) {
      const { id, ...cambios } = aFila(editado);
      const respuesta = await cliente
        .from('customers')
        .update(cambios)
        .eq('id', id)
        .select()
        .maybeSingle();
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      // Sin renglón: no existe, o la base no dejó verlo ni cambiarlo (RLS).
      return datos === null ? err({ code: 'NOT_FOUND' }) : ok(aCliente(datos as FilaDeCliente));
    },

    async get(id) {
      const respuesta = await cliente.from(fuente).select('*').eq('id', id).maybeSingle();
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return datos === null ? err({ code: 'NOT_FOUND' }) : ok(aCliente(datos as FilaDeCliente));
    },

    async list() {
      const respuesta = await cliente.from(fuente).select('*').order('name');
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return ok(aLista(datos));
    },

    async findByPhone(telefono) {
      const respuesta = await cliente.from(fuente).select('*').eq('phone', telefono);
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return ok(aLista(datos));
    },
  };
}
