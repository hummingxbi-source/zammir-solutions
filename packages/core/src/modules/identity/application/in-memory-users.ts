import type { Clock } from '../../../shared-kernel/clock';
import type { IdGenerator, UserId } from '../../../shared-kernel/id';
import { err, ok } from '../../../shared-kernel/result';
import type { InMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { recordAuditEntry } from '../../audit/application/record-audit-entry';
import type { AuditAction } from '../../audit/domain/audit-entry';
import type { PinVerifier } from '../domain/pin';
import type { AppUser } from '../domain/user';
import type { PinHasher, UserRepository } from './user-ports';

export interface InMemoryUsersDeps {
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly auditLog: InMemoryAuditLog;
}

/** Adaptador en memoria del puerto UserRepository, para pruebas. */
export function inMemoryUsers(deps: InMemoryUsersDeps): UserRepository {
  const usuarios = new Map<UserId, AppUser>();
  const auditoria = { auditLog: deps.auditLog, clock: deps.clock, idGenerator: deps.idGenerator };

  function nombreOcupado(usuario: AppUser): boolean {
    return [...usuarios.values()].some(
      (u) => u.id !== usuario.id && u.name.toLowerCase() === usuario.name.toLowerCase(),
    );
  }

  function dejarBitacora(
    usuario: AppUser,
    action: AuditAction,
    oldValue: Record<string, string | boolean> | null,
    newValue: Record<string, string | boolean> | null,
  ) {
    return recordAuditEntry(auditoria, {
      userId: null,
      deviceId: null,
      action,
      entityType: 'user',
      entityId: usuario.id,
      oldValue,
      newValue,
    });
  }

  return {
    async create(usuario) {
      if (nombreOcupado(usuario)) {
        return err({ code: 'NAME_TAKEN' });
      }
      usuarios.set(usuario.id, usuario);
      await dejarBitacora(usuario, 'USER_CREATED', null, {
        nombre: usuario.name,
        rol: usuario.role,
        activo: usuario.isActive,
      });
      return ok(usuario);
    },

    async update(usuario) {
      const anterior = usuarios.get(usuario.id);
      if (anterior === undefined) {
        return err({ code: 'NOT_FOUND' });
      }
      if (nombreOcupado(usuario)) {
        return err({ code: 'NAME_TAKEN' });
      }
      usuarios.set(usuario.id, usuario);

      if (anterior.name !== usuario.name || anterior.role !== usuario.role) {
        await dejarBitacora(
          usuario,
          'USER_UPDATED',
          { nombre: anterior.name, rol: anterior.role },
          { nombre: usuario.name, rol: usuario.role },
        );
      }
      if (anterior.isActive !== usuario.isActive) {
        await dejarBitacora(
          usuario,
          usuario.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
          { activo: anterior.isActive },
          { activo: usuario.isActive },
        );
      }
      if (anterior.pin.hash !== usuario.pin.hash) {
        // El verificador nunca va a la bitácora: solo se anota que se restableció.
        await dejarBitacora(usuario, 'USER_PIN_RESET', null, { pin: 'restablecido' });
      }
      return ok(usuario);
    },

    get(id) {
      const usuario = usuarios.get(id);
      return Promise.resolve(usuario === undefined ? err({ code: 'NOT_FOUND' }) : ok(usuario));
    },

    list: () => Promise.resolve(ok([...usuarios.values()])),
  };
}

/** Comparador de tiempo constante sobre texto; no se corta en la primera diferencia. */
export function sameTextConstantTime(a: string, b: string): boolean {
  let diferencia = a.length ^ b.length;
  const largo = Math.max(a.length, b.length);
  for (let i = 0; i < largo; i += 1) {
    diferencia |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diferencia === 0;
}

/** PinHasher de pruebas: determinista y rápido, con el mismo contrato que el real (NO es seguro). */
export function fakePinHasher(): PinHasher {
  let contador = 0;
  // Mezcla cada dígito con su posición y las vueltas: no es criptografía, solo evita guardar el PIN tal cual.
  const calcular = (pin: string, sal: string, vueltas: number): string =>
    `${sal}|${Array.from({ length: pin.length }, (_, i) =>
      String((Number(pin.charAt(i)) * 3 + i * 7 + vueltas) % 10),
    ).join('')}|${String(pin.length)}`;
  return {
    hash(pin, iterations) {
      contador += 1;
      const salt = `sal-${String(contador)}`;
      const verificador: PinVerifier = {
        salt,
        iterations,
        hash: calcular(pin, salt, iterations),
        version: 1,
      };
      return Promise.resolve(verificador);
    },
    verify: (pin, verificador) =>
      Promise.resolve(
        sameTextConstantTime(
          verificador.hash,
          calcular(pin, verificador.salt, verificador.iterations),
        ),
      ),
  };
}
