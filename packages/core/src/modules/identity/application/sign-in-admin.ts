import { z } from 'zod';

import { err, type Result } from '../../../shared-kernel/result';
import type { AuthenticatedUser, AuthError } from '../domain/auth';
import type { AdminAuth } from './ports';

const credenciales = z.object({
  email: z.string().trim().pipe(z.email()),
  password: z.string().min(1),
});

/** Entrada de un administrador. Una cuenta válida que no es de administrador no entra:
 *  se cierra su sesión y se avisa [matriz de permisos, docs/producto/REQUERIMIENTOS.md]. */
export async function signInAdmin(
  auth: AdminAuth,
  email: string,
  password: string,
): Promise<Result<AuthenticatedUser, AuthError>> {
  const datos = credenciales.safeParse({ email, password });
  if (!datos.success) {
    return err({ code: 'INVALID_INPUT' });
  }

  const resultado = await auth.signIn(datos.data.email, datos.data.password);
  if (!resultado.ok) {
    return resultado;
  }

  if (resultado.value.role !== 'ADMIN') {
    await auth.signOut();
    return err({ code: 'NOT_AN_ADMIN' });
  }
  return resultado;
}
