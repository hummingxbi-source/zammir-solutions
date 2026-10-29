import { describe, expect, it } from 'vitest';

import { createComposition } from './index';

describe('createComposition', () => {
  it('entrega los adaptadores reales de reloj e identificadores', () => {
    const { clock, idGenerator } = createComposition();
    expect(clock.now()).toBeInstanceOf(Date);
    expect(idGenerator.newId<'Device'>()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sin Supabase configurado nadie puede entrar y el límite de inactividad queda por definir', async () => {
    const { adminAuth, cargarLimiteInactividad } = createComposition();
    const resultado = await adminAuth.signIn('admin@ejemplo.invalid', 'clave');
    expect(!resultado.ok && resultado.error.code).toBe('NETWORK_UNAVAILABLE');
    expect(await adminAuth.currentUser()).toBeNull();
    await expect(adminAuth.signOut()).resolves.toBeUndefined();
    expect(await cargarLimiteInactividad()).toBeNull();
  });

  it('con Supabase configurado crea el acceso real sin tocar la red al construirlo', async () => {
    const { adminAuth } = createComposition({
      url: 'http://127.0.0.1:1',
      anonKey: 'llave-publica-de-prueba',
    });
    expect(await adminAuth.currentUser()).toBeNull();
  });
});
