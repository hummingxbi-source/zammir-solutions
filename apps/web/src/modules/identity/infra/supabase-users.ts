import type { SupabaseClient } from '@supabase/supabase-js';
import {
  asId,
  err,
  ok,
  type AppUser,
  type Result,
  type StaffRole,
  type UserError,
  type UserRepository,
} from '@zammir/core';

const SIN_PERMISO = '42501';
const VALOR_REPETIDO = '23505';

interface FilaDeUsuario {
  readonly id: string;
  readonly name: string;
  readonly role: StaffRole;
  readonly is_active: boolean;
  readonly pin_salt: string;
  readonly pin_iterations: number;
  readonly pin_hash: string;
  readonly pin_version: number;
}

function aError(error: { readonly code?: string }): UserError {
  switch (error.code) {
    case SIN_PERMISO:
      return { code: 'NOT_AUTHORIZED' };
    case VALOR_REPETIDO:
      return { code: 'NAME_TAKEN' };
    default:
      return { code: 'USERS_UNAVAILABLE' };
  }
}

function aUsuario(fila: FilaDeUsuario): AppUser {
  return {
    id: asId<'User'>(fila.id),
    name: fila.name,
    role: fila.role,
    isActive: fila.is_active,
    pin: {
      salt: fila.pin_salt,
      iterations: fila.pin_iterations,
      hash: fila.pin_hash,
      version: fila.pin_version,
    },
  };
}

function aFila(u: AppUser) {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    is_active: u.isActive,
    pin_salt: u.pin.salt,
    pin_iterations: u.pin.iterations,
    pin_hash: u.pin.hash,
    pin_version: u.pin.version,
  };
}

/** Adaptador de UserRepository sobre `app_users`. Las bitácoras las deja la base con disparadores.
 *  Sin sesión de administrador la base no deja leer ni escribir (RLS). */
export function supabaseUsers(cliente: SupabaseClient): UserRepository {
  return {
    async create(usuario): Promise<Result<AppUser, UserError>> {
      const respuesta = await cliente.from('app_users').insert(aFila(usuario)).select().single();
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return ok(aUsuario(datos as FilaDeUsuario));
    },

    async update(usuario) {
      const { id, ...cambios } = aFila(usuario);
      const respuesta = await cliente
        .from('app_users')
        .update(cambios)
        .eq('id', id)
        .select()
        .maybeSingle();
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      // Sin renglón: no existe, o la base no dejó verlo ni cambiarlo (RLS).
      return datos === null ? err({ code: 'NOT_FOUND' }) : ok(aUsuario(datos as FilaDeUsuario));
    },

    async get(id) {
      const respuesta = await cliente.from('app_users').select('*').eq('id', id).maybeSingle();
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return datos === null ? err({ code: 'NOT_FOUND' }) : ok(aUsuario(datos as FilaDeUsuario));
    },

    async list() {
      const respuesta = await cliente.from('app_users').select('*').order('name');
      const datos: unknown = respuesta.data;
      if (respuesta.error !== null) {
        return err(aError(respuesta.error));
      }
      return ok((datos as FilaDeUsuario[]).map(aUsuario));
    },
  };
}
