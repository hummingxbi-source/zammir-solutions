import { err, ok, type AdminAuth, type AuthenticatedUser, type UserRole } from '@zammir/core';
import type { SupabaseClient, User } from '@supabase/supabase-js';

const ROLES: readonly UserRole[] = ['ADMIN', 'STAFF', 'DEVICE'];

function rolDe(usuario: User): UserRole | null {
  const rol: unknown = usuario.app_metadata.rol;
  return ROLES.find((conocido) => conocido === rol) ?? null;
}

function aUsuario(usuario: User): AuthenticatedUser {
  return { userId: usuario.id, email: usuario.email ?? '', role: rolDe(usuario) };
}

/** Adaptador de AdminAuth sobre Supabase Auth (correo y contraseña). */
export function supabaseAdminAuth(cliente: SupabaseClient): AdminAuth {
  return {
    async signIn(email, password) {
      const { data, error } = await cliente.auth.signInWithPassword({ email, password });
      if (error !== null) {
        // Sin respuesta del servidor no hay código de estado; el resto son datos incorrectos.
        const sinConexion = error.status === undefined || error.status === 0 || error.status >= 500;
        return err({ code: sinConexion ? 'NETWORK_UNAVAILABLE' : 'INVALID_CREDENTIALS' });
      }
      return ok(aUsuario(data.user));
    },

    async signOut() {
      await cliente.auth.signOut();
    },

    async currentUser() {
      const { data } = await cliente.auth.getSession();
      return data.session === null ? null : aUsuario(data.session.user);
    },
  };
}

/** Sin Supabase configurado nadie puede entrar. */
export const adminAuthNoConfigurada: AdminAuth = {
  signIn: () => Promise.resolve(err({ code: 'NETWORK_UNAVAILABLE' })),
  signOut: () => Promise.resolve(),
  currentUser: () => Promise.resolve(null),
};
