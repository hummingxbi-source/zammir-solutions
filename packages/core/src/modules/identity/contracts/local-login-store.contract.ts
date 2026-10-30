import { describe, expect, it } from 'vitest';

import { asId } from '../../../shared-kernel/id';
import type { LocalLoginStore, LoginSnapshot } from '../application/sign-in-with-pin';
import type { AppUser } from '../domain/user';

export function personaDePrueba(id: string, extra: Partial<AppUser> = {}): AppUser {
  return {
    id: asId<'User'>(id),
    name: `Persona ${id}`,
    role: 'STAFF',
    isActive: true,
    pin: { salt: 'c2Fs', iterations: 1000, hash: 'aGFzaA==', version: 1 },
    ...extra,
  };
}

export function copiaDePrueba(users: readonly AppUser[]): LoginSnapshot {
  return {
    users,
    lockout: { maxAttempts: 5, baseSeconds: 30, capSeconds: 900 },
    idleLockMinutes: 5,
  };
}

/** Batería de contrato de LocalLoginStore: la pasan la memoria y el almacén de la tablet (IndexedDB). */
export function localLoginStoreContract(
  nombre: string,
  crear: () => LocalLoginStore | Promise<LocalLoginStore>,
): void {
  describe(`contrato de LocalLoginStore: ${nombre}`, () => {
    it('vacío: no hay copia', async () => {
      expect(await (await crear()).load()).toBeNull();
    });

    it('guarda y devuelve las personas con su verificador y la configuración', async () => {
      const s = await crear();
      const copia = copiaDePrueba([personaDePrueba('a'), personaDePrueba('b', { role: 'ADMIN' })]);
      await s.replace(copia);
      expect(await s.load()).toEqual(copia);
    });

    it('reemplazar deja solo lo nuevo: quien ya no está, sale', async () => {
      const s = await crear();
      await s.replace(copiaDePrueba([personaDePrueba('a'), personaDePrueba('b')]));
      await s.replace(copiaDePrueba([personaDePrueba('b', { isActive: false })]));
      const copia = await s.load();
      expect(copia?.users.map((u) => u.id)).toEqual(['b']);
      expect(copia?.users[0]?.isActive).toBe(false);
    });

    it('la política de bloqueo por definir se conserva como null', async () => {
      const s = await crear();
      await s.replace({ users: [], lockout: null, idleLockMinutes: 5 });
      expect((await s.load())?.lockout).toBeNull();
    });
  });
}
