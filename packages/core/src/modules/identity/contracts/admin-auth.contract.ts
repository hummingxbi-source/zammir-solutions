import { beforeEach, describe, expect, it } from 'vitest';

import type { AdminAuth } from '../application/ports';

export interface CuentasDelContrato {
  readonly admin: { readonly email: string; readonly password: string };
  readonly cajero: { readonly email: string; readonly password: string };
}

/** Batería de contrato de AdminAuth: la pasan todos los adaptadores (memoria, Supabase…).
 *  `crear` debe devolver un puerto SIN sesión abierta y con estas cuentas ya dadas de alta. */
export function adminAuthContract(
  nombre: string,
  crear: () => AdminAuth | Promise<AdminAuth>,
  cuentas: CuentasDelContrato,
): void {
  describe(`contrato de AdminAuth: ${nombre}`, () => {
    let auth: AdminAuth;

    beforeEach(async () => {
      auth = await crear();
    });

    it('al inicio no hay sesión', async () => {
      expect(await auth.currentUser()).toBeNull();
    });

    it('con correo y contraseña válidos abre la sesión y devuelve el rol', async () => {
      const resultado = await auth.signIn(cuentas.admin.email, cuentas.admin.password);
      expect(resultado.ok && resultado.value.role).toBe('ADMIN');
      expect((await auth.currentUser())?.email).toBe(cuentas.admin.email);
    });

    it('una cuenta de cajero entra al puerto pero con rol STAFF', async () => {
      const resultado = await auth.signIn(cuentas.cajero.email, cuentas.cajero.password);
      expect(resultado.ok && resultado.value.role).toBe('STAFF');
    });

    it('con contraseña incorrecta no abre sesión', async () => {
      const resultado = await auth.signIn(cuentas.admin.email, 'contraseña-incorrecta');
      expect(!resultado.ok && resultado.error.code).toBe('INVALID_CREDENTIALS');
      expect(await auth.currentUser()).toBeNull();
    });

    it('un correo que no existe da el mismo error que una contraseña incorrecta', async () => {
      const inexistente = await auth.signIn('nadie@ejemplo.invalid', 'cualquiera');
      const incorrecta = await auth.signIn(cuentas.admin.email, 'contraseña-incorrecta');
      expect(!inexistente.ok && inexistente.error.code).toBe('INVALID_CREDENTIALS');
      expect(!incorrecta.ok && incorrecta.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('la contraseña de otra cuenta no sirve con este correo', async () => {
      const resultado = await auth.signIn(cuentas.admin.email, cuentas.cajero.password);
      expect(!resultado.ok && resultado.error.code).toBe('INVALID_CREDENTIALS');
      expect(await auth.currentUser()).toBeNull();
    });

    it('cerrar la sesión la quita', async () => {
      await auth.signIn(cuentas.admin.email, cuentas.admin.password);
      await auth.signOut();
      expect(await auth.currentUser()).toBeNull();
    });
  });
}
