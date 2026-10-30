import { err, ok, type Result } from '../../../shared-kernel/result';
import type { AuthenticatedUser, AuthError } from '../domain/auth';
import type { AdminAuth } from './ports';

export interface CuentaDePrueba extends AuthenticatedUser {
  readonly password: string;
}

/** Adaptador en memoria del puerto AdminAuth, para pruebas. */
export function inMemoryAdminAuth(cuentas: readonly CuentaDePrueba[]): AdminAuth {
  let sesion: AuthenticatedUser | null = null;

  return {
    signIn(email, password): Promise<Result<AuthenticatedUser, AuthError>> {
      const cuenta = cuentas.find((c) => c.email === email && c.password === password);
      if (cuenta === undefined) {
        return Promise.resolve(err({ code: 'INVALID_CREDENTIALS' }));
      }
      sesion = { userId: cuenta.userId, email: cuenta.email, role: cuenta.role };
      return Promise.resolve(ok(sesion));
    },
    signOut(): Promise<void> {
      sesion = null;
      return Promise.resolve();
    },
    currentUser(): Promise<AuthenticatedUser | null> {
      return Promise.resolve(sesion);
    },
  };
}
