import { describe, expect, it, vi } from 'vitest';

import { inMemoryAdminAuth, type CuentaDePrueba } from './in-memory-admin-auth';
import type { AdminAuth } from './ports';
import { signInAdmin } from './sign-in-admin';

const cuentas: CuentaDePrueba[] = [
  { userId: 'u-1', email: 'admin@ejemplo.invalid', password: 'clave-de-prueba-1', role: 'ADMIN' },
  { userId: 'u-2', email: 'cajero@ejemplo.invalid', password: 'clave-de-prueba-2', role: 'STAFF' },
  { userId: 'u-3', email: 'sinrol@ejemplo.invalid', password: 'clave-de-prueba-3', role: null },
];

describe('signInAdmin', () => {
  it('un administrador con credenciales válidas abre la sesión', async () => {
    const auth = inMemoryAdminAuth(cuentas);
    const resultado = await signInAdmin(auth, 'admin@ejemplo.invalid', 'clave-de-prueba-1');
    expect(resultado.ok && resultado.value.role).toBe('ADMIN');
    expect((await auth.currentUser())?.userId).toBe('u-1');
  });

  it('ignora espacios alrededor del correo', async () => {
    const resultado = await signInAdmin(
      inMemoryAdminAuth(cuentas),
      '  admin@ejemplo.invalid  ',
      'clave-de-prueba-1',
    );
    expect(resultado.ok).toBe(true);
  });

  it('una cuenta de cajero no entra y su sesión se cierra', async () => {
    const auth = inMemoryAdminAuth(cuentas);
    const resultado = await signInAdmin(auth, 'cajero@ejemplo.invalid', 'clave-de-prueba-2');
    expect(!resultado.ok && resultado.error.code).toBe('NOT_AN_ADMIN');
    expect(await auth.currentUser()).toBeNull();
  });

  it('una cuenta sin rol asignado tampoco entra como administrador', async () => {
    const auth = inMemoryAdminAuth(cuentas);
    const resultado = await signInAdmin(auth, 'sinrol@ejemplo.invalid', 'clave-de-prueba-3');
    expect(!resultado.ok && resultado.error.code).toBe('NOT_AN_ADMIN');
    expect(await auth.currentUser()).toBeNull();
  });

  it('contraseña incorrecta devuelve el error de credenciales', async () => {
    const resultado = await signInAdmin(
      inMemoryAdminAuth(cuentas),
      'admin@ejemplo.invalid',
      'otra-clave',
    );
    expect(!resultado.ok && resultado.error.code).toBe('INVALID_CREDENTIALS');
  });

  it.each([
    ['un correo sin forma de correo', 'no-es-un-correo', 'clave'],
    ['un correo vacío', '', 'clave'],
    ['una contraseña vacía', 'admin@ejemplo.invalid', ''],
  ])('rechaza %s sin llamar al servidor', async (_descripcion, correo, clave) => {
    const signIn = vi.fn();
    const auth: AdminAuth = {
      signIn,
      signOut: () => Promise.resolve(),
      currentUser: () => Promise.resolve(null),
    };
    const resultado = await signInAdmin(auth, correo, clave);
    expect(!resultado.ok && resultado.error.code).toBe('INVALID_INPUT');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('si no hay conexión devuelve ese error sin cerrar nada', async () => {
    const signOut = vi.fn(() => Promise.resolve());
    const auth: AdminAuth = {
      signIn: () => Promise.resolve({ ok: false, error: { code: 'NETWORK_UNAVAILABLE' } }),
      signOut,
      currentUser: () => Promise.resolve(null),
    };
    const resultado = await signInAdmin(auth, 'admin@ejemplo.invalid', 'clave');
    expect(!resultado.ok && resultado.error.code).toBe('NETWORK_UNAVAILABLE');
    expect(signOut).not.toHaveBeenCalled();
  });
});
