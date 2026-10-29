import type { Result } from '../../../shared-kernel/result';
import type { AuthenticatedUser, AuthError } from '../domain/auth';

/** Puerto: entrada con correo y contraseña (administradores). */
export interface AdminAuth {
  signIn(email: string, password: string): Promise<Result<AuthenticatedUser, AuthError>>;
  signOut(): Promise<void>;
  /** El usuario con sesión abierta, o `null` si no hay. */
  currentUser(): Promise<AuthenticatedUser | null>;
}
