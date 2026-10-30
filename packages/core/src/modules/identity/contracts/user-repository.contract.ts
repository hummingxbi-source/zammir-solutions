import { describe, expect, it } from 'vitest';

import type { UserId } from '../../../shared-kernel/id';
import type { UserRepository } from '../application/user-ports';
import type { PinVerifier } from '../domain/pin';
import type { AppUser } from '../domain/user';

export interface EntradaDeBitacoraDeUsuario {
  readonly action: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}

export interface UserRepositoryDelContrato {
  readonly users: UserRepository;
  /** Un identificador nuevo, válido para el almacén (UUID en Supabase). */
  readonly nuevoId: () => UserId;
  /** Un nombre que no se ha usado en esta ejecución. */
  readonly nombreNuevo: () => string;
  /** Entradas de bitácora de un usuario, leídas por un camino independiente del puerto. */
  readonly bitacoraDe: (id: UserId) => Promise<readonly EntradaDeBitacoraDeUsuario[]>;
}

export function verificadorDePrueba(cambios: Partial<PinVerifier> = {}): PinVerifier {
  return {
    salt: 'c2FsLWRlLXBydWViYQ==',
    iterations: 1000,
    hash: 'aGFzaC1kZS1wcnVlYmE=',
    version: 1,
    ...cambios,
  };
}

export function usuarioDePrueba(id: UserId, name: string, cambios: Partial<AppUser> = {}): AppUser {
  return { id, name, role: 'STAFF', isActive: true, pin: verificadorDePrueba(), ...cambios };
}

/** Batería de contrato del repositorio de usuarios: la pasan todos los adaptadores (memoria, Supabase…). */
export function userRepositoryContract(
  nombre: string,
  crear: () => UserRepositoryDelContrato | Promise<UserRepositoryDelContrato>,
): void {
  describe(`contrato de UserRepository: ${nombre}`, () => {
    async function conUsuario(h: UserRepositoryDelContrato, cambios: Partial<AppUser> = {}) {
      const usuario = usuarioDePrueba(h.nuevoId(), h.nombreNuevo(), cambios);
      const r = await h.users.create(usuario);
      if (!r.ok) {
        throw new Error('no se pudo crear el usuario de prueba');
      }
      return usuario;
    }

    it('guarda un usuario con su verificador y lo devuelve igual', async () => {
      const h = await crear();
      const usuario = await conUsuario(h, { role: 'ADMIN' });
      const leido = await h.users.get(usuario.id);
      expect(leido.ok && leido.value).toEqual(usuario);
    });

    it('aparece en la lista', async () => {
      const h = await crear();
      const usuario = await conUsuario(h);
      const lista = await h.users.list();
      expect(lista.ok && lista.value.some((u) => u.id === usuario.id)).toBe(true);
    });

    it('un usuario que no existe no se encuentra ni se edita', async () => {
      const h = await crear();
      const id = h.nuevoId();
      const leido = await h.users.get(id);
      expect(!leido.ok && leido.error.code).toBe('NOT_FOUND');
      const editado = await h.users.update(usuarioDePrueba(id, h.nombreNuevo()));
      expect(!editado.ok && editado.error.code).toBe('NOT_FOUND');
    });

    it('no admite dos usuarios con el mismo nombre, sin distinguir mayúsculas', async () => {
      const h = await crear();
      const primero = await conUsuario(h);
      const repetido = await h.users.create(
        usuarioDePrueba(h.nuevoId(), primero.name.toUpperCase()),
      );
      expect(!repetido.ok && repetido.error.code).toBe('NAME_TAKEN');
    });

    it('al editar tampoco deja tomar el nombre de otro, pero sí conservar el propio', async () => {
      const h = await crear();
      const a = await conUsuario(h);
      const b = await conUsuario(h);
      const choque = await h.users.update({ ...b, name: a.name });
      expect(!choque.ok && choque.error.code).toBe('NAME_TAKEN');
      const igual = await h.users.update({ ...a, role: 'ADMIN' });
      expect(igual.ok).toBe(true);
    });

    it('guarda los cambios de nombre, rol y verificador', async () => {
      const h = await crear();
      const usuario = await conUsuario(h);
      const cambiado = {
        ...usuario,
        name: h.nombreNuevo(),
        role: 'ADMIN' as const,
        pin: verificadorDePrueba({ hash: 'bnVldm8taGFzaA==', salt: 'bnVldmEtc2Fs' }),
      };
      await h.users.update(cambiado);
      const leido = await h.users.get(usuario.id);
      expect(leido.ok && leido.value).toEqual(cambiado);
    });

    it('desactivar conserva al usuario (no se borra)', async () => {
      const h = await crear();
      const usuario = await conUsuario(h);
      await h.users.update({ ...usuario, isActive: false });
      const leido = await h.users.get(usuario.id);
      expect(leido.ok && leido.value.isActive).toBe(false);
      const lista = await h.users.list();
      expect(lista.ok && lista.value.some((u) => u.id === usuario.id)).toBe(true);
    });

    it('el puerto no tiene operación de borrado', async () => {
      const h = await crear();
      for (const operacion of ['delete', 'remove', 'destroy']) {
        expect(operacion in h.users).toBe(false);
      }
    });

    it('cada cambio deja su entrada de bitácora, sin guardar el verificador', async () => {
      const h = await crear();
      const usuario = await conUsuario(h);
      const nombreViejo = usuario.name;
      const nombreNuevo = h.nombreNuevo();
      await h.users.update({ ...usuario, name: nombreNuevo, role: 'ADMIN' });
      await h.users.update({ ...usuario, name: nombreNuevo, role: 'ADMIN', isActive: false });
      await h.users.update({
        ...usuario,
        name: nombreNuevo,
        role: 'ADMIN',
        isActive: false,
        pin: verificadorDePrueba({ hash: 'bnVldm8taGFzaA==' }),
      });

      const bitacora = await h.bitacoraDe(usuario.id);
      expect(bitacora.map((e) => e.action)).toEqual([
        'USER_CREATED',
        'USER_UPDATED',
        'USER_DEACTIVATED',
        'USER_PIN_RESET',
      ]);
      expect(bitacora[1]).toEqual({
        action: 'USER_UPDATED',
        oldValue: { nombre: nombreViejo, rol: 'STAFF' },
        newValue: { nombre: nombreNuevo, rol: 'ADMIN' },
      });
      // Nada del verificador en la bitácora.
      expect(JSON.stringify(bitacora)).not.toContain('bnVldm8taGFzaA==');
      expect(JSON.stringify(bitacora)).not.toContain(usuario.pin.hash);
    });

    it('guardar sin cambios no deja entradas nuevas', async () => {
      const h = await crear();
      const usuario = await conUsuario(h);
      await h.users.update(usuario);
      expect((await h.bitacoraDe(usuario.id)).map((e) => e.action)).toEqual(['USER_CREATED']);
    });
  });
}
