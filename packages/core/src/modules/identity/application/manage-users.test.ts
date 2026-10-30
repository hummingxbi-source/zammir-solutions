import { describe, expect, it } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId, sequentialIdGenerator } from '../../../shared-kernel/id';
import { inMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import {
  createUser,
  resetPin,
  setUserActive,
  updateUser,
  type ManageUsersDeps,
  type UserPolicy,
} from './manage-users';
import { fakePinHasher, inMemoryUsers } from './in-memory-users';

const politica: UserPolicy = { adminMinDigits: 6, pbkdf2Iterations: 1000 };
const admin = { role: 'ADMIN' } as const;

function entorno() {
  const auditLog = inMemoryAuditLog();
  const idGenerator = sequentialIdGenerator('u');
  const users = inMemoryUsers({
    clock: fixedClock(new Date('2026-10-30T12:00:00.000Z')),
    idGenerator: sequentialIdGenerator('b'),
    auditLog,
  });
  const deps: ManageUsersDeps = { users, hasher: fakePinHasher(), idGenerator };
  return { deps, auditLog };
}

describe('createUser', () => {
  it('crea un empleado con rol, estado activo y solo el verificador del PIN', async () => {
    const { deps } = entorno();
    const r = await createUser(deps, politica, admin, {
      name: '  Ana  ',
      role: 'STAFF',
      pin: '4829',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.value).toMatchObject({ id: 'u-0001', name: 'Ana', role: 'STAFF', isActive: true });
    expect(r.value.pin.iterations).toBe(1000);
    // Se inspecciona TODO lo guardado: el PIN no aparece en ningún campo.
    const guardado = await deps.users.get(r.value.id);
    expect(JSON.stringify(guardado)).not.toContain('4829');
    expect(await deps.hasher.verify('4829', r.value.pin)).toBe(true);
  });

  it.each(['STAFF', 'DEVICE', null] as const)('%s no puede crear usuarios', async (role) => {
    const { deps } = entorno();
    const r = await createUser(
      deps,
      politica,
      { role },
      { name: 'Ana', role: 'STAFF', pin: '4829' },
    );
    expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
    const lista = await deps.users.list();
    expect(lista.ok && lista.value).toEqual([]);
  });

  it('exige nombre', async () => {
    const { deps } = entorno();
    const r = await createUser(deps, politica, admin, { name: '   ', role: 'STAFF', pin: '4829' });
    expect(!r.ok && r.error.code).toBe('NAME_REQUIRED');
  });

  it.each(['0000', '1234', '1212', '12', 'abcd'])('rechaza el PIN %s', async (pin) => {
    const { deps } = entorno();
    const r = await createUser(deps, politica, admin, { name: 'Ana', role: 'STAFF', pin });
    expect(r.ok).toBe(false);
    const lista = await deps.users.list();
    expect(lista.ok && lista.value).toEqual([]);
  });

  it('un administrador necesita un PIN de 6 dígitos', async () => {
    const { deps } = entorno();
    const corto = await createUser(deps, politica, admin, {
      name: 'Luis',
      role: 'ADMIN',
      pin: '4829',
    });
    expect(!corto.ok && corto.error.code).toBe('PIN_TOO_SHORT_FOR_ADMIN');
    const largo = await createUser(deps, politica, admin, {
      name: 'Luis',
      role: 'ADMIN',
      pin: '482915',
    });
    expect(largo.ok).toBe(true);
  });

  it('no hay límite técnico: 2 administradores y 5 empleados', async () => {
    const { deps } = entorno();
    const pines = ['482915', '739104', '4829', '7391', '5028', '8164', '2957'];
    const roles = ['ADMIN', 'ADMIN', 'STAFF', 'STAFF', 'STAFF', 'STAFF', 'STAFF'] as const;
    for (const [i, pin] of pines.entries()) {
      const r = await createUser(deps, politica, admin, {
        name: `Persona ${String(i)}`,
        role: roles[i] ?? 'STAFF',
        pin,
      });
      expect(r.ok).toBe(true);
    }
    const lista = await deps.users.list();
    expect(lista.ok && lista.value).toHaveLength(7);
  });

  it('no repite nombres', async () => {
    const { deps } = entorno();
    await createUser(deps, politica, admin, { name: 'Ana', role: 'STAFF', pin: '4829' });
    const r = await createUser(deps, politica, admin, { name: 'ana', role: 'STAFF', pin: '7391' });
    expect(!r.ok && r.error.code).toBe('NAME_TAKEN');
  });
});

describe('updateUser, resetPin y setUserActive', () => {
  async function conAna() {
    const e = entorno();
    const r = await createUser(e.deps, politica, admin, {
      name: 'Ana',
      role: 'STAFF',
      pin: '4829',
    });
    if (!r.ok) {
      throw new Error('alta');
    }
    return { ...e, ana: r.value };
  }

  it('cambia el nombre sin tocar el PIN', async () => {
    const { deps, ana } = await conAna();
    const r = await updateUser(deps, politica, admin, ana.id, { name: ' Ana María ' });
    expect(r.ok && r.value.name).toBe('Ana María');
    expect(r.ok && r.value.pin).toEqual(ana.pin);
  });

  it('pasar a administrador exige un PIN nuevo de 6 dígitos', async () => {
    const { deps, ana } = await conAna();
    const sinPin = await updateUser(deps, politica, admin, ana.id, { role: 'ADMIN' });
    expect(!sinPin.ok && sinPin.error.code).toBe('PIN_REQUIRED');
    const corto = await updateUser(deps, politica, admin, ana.id, { role: 'ADMIN', pin: '4829' });
    expect(!corto.ok && corto.error.code).toBe('PIN_TOO_SHORT_FOR_ADMIN');
    const bien = await updateUser(deps, politica, admin, ana.id, { role: 'ADMIN', pin: '482915' });
    expect(bien.ok && bien.value.role).toBe('ADMIN');
  });

  it('pasar a cajero no pide PIN', async () => {
    const { deps } = entorno();
    const r = await createUser(deps, politica, admin, {
      name: 'Luis',
      role: 'ADMIN',
      pin: '482915',
    });
    if (!r.ok) {
      throw new Error('alta');
    }
    const baja = await updateUser(deps, politica, admin, r.value.id, { role: 'STAFF' });
    expect(baja.ok && baja.value.role).toBe('STAFF');
  });

  it('restablecer el PIN cambia el verificador, valida el PIN nuevo y deja bitácora', async () => {
    const { deps, ana, auditLog } = await conAna();
    const malo = await resetPin(deps, politica, admin, ana.id, '1234');
    expect(!malo.ok && malo.error.code).toBe('PIN_TRIVIAL');

    const r = await resetPin(deps, politica, admin, ana.id, '7391');
    expect(r.ok && r.value.pin.hash).not.toBe(ana.pin.hash);
    expect(r.ok && (await deps.hasher.verify('7391', r.value.pin))).toBe(true);
    expect(r.ok && (await deps.hasher.verify('4829', r.value.pin))).toBe(false);
    expect(auditLog.entries().map((e) => e.action)).toContain('USER_PIN_RESET');
  });

  it.each(['STAFF', 'DEVICE', null] as const)(
    '%s no puede editar, restablecer ni desactivar',
    async (role) => {
      const { deps, ana } = await conAna();
      const sin = { role };
      const resultados = [
        await updateUser(deps, politica, sin, ana.id, { name: 'Otra' }),
        await resetPin(deps, politica, sin, ana.id, '7391'),
        await setUserActive(deps, sin, ana.id, false),
      ];
      for (const r of resultados) {
        expect(!r.ok && r.error.code).toBe('NOT_AUTHORIZED');
      }
      const sigue = await deps.users.get(ana.id);
      expect(sigue.ok && sigue.value).toEqual(ana);
    },
  );

  it('desactivar y reactivar no borra al usuario', async () => {
    const { deps, ana, auditLog } = await conAna();
    const baja = await setUserActive(deps, admin, ana.id, false);
    expect(baja.ok && baja.value.isActive).toBe(false);
    const alta = await setUserActive(deps, admin, ana.id, true);
    expect(alta.ok && alta.value.isActive).toBe(true);
    expect(auditLog.entries().map((e) => e.action)).toEqual([
      'USER_CREATED',
      'USER_DEACTIVATED',
      'USER_ACTIVATED',
    ]);
  });

  it('un usuario que no existe se reporta', async () => {
    const { deps } = entorno();
    const fantasma = asId<'User'>('no-existe');
    const a = await updateUser(deps, politica, admin, fantasma, { name: 'X' });
    const b = await setUserActive(deps, admin, fantasma, false);
    expect(!a.ok && a.error.code).toBe('NOT_FOUND');
    expect(!b.ok && b.error.code).toBe('NOT_FOUND');
  });

  it('un nombre en blanco al editar se rechaza', async () => {
    const { deps, ana } = await conAna();
    const r = await updateUser(deps, politica, admin, ana.id, { name: '  ' });
    expect(!r.ok && r.error.code).toBe('NAME_REQUIRED');
  });
});
