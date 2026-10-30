import { describe, expect, it } from 'vitest';

import type { Clock } from '../../../shared-kernel/clock';
import { asId, sequentialIdGenerator, type UserId } from '../../../shared-kernel/id';
import { inMemoryAuditLog } from '../../audit/application/in-memory-audit-log';
import { authorizeWithAdminPin, type AuthorizeDeps } from './authorize-with-admin-pin';
import { createUser, setUserActive, type UserPolicy } from './manage-users';
import { fakePinHasher, inMemoryUsers } from './in-memory-users';
import { inMemoryPinAttemptGuard } from './pin-attempt-guard';

const politicaDeUsuarios: UserPolicy = { adminMinDigits: 6, pbkdf2Iterations: 1000 };
const bloqueo = { maxAttempts: 3, baseSeconds: 30, capSeconds: 120 };

/** Reloj de pruebas que se mueve a mano. */
function relojManual(): Clock & { avanzar: (segundos: number) => void } {
  let ahora = new Date('2026-10-30T12:00:00.000Z').getTime();
  return {
    now: () => new Date(ahora),
    avanzar: (segundos) => {
      ahora += segundos * 1000;
    },
  };
}

async function entorno(conBloqueo = true) {
  const clock = relojManual();
  const users = inMemoryUsers({
    clock,
    idGenerator: sequentialIdGenerator('b'),
    auditLog: inMemoryAuditLog(),
  });
  const hasher = fakePinHasher();
  const deps: AuthorizeDeps = {
    users,
    hasher,
    clock,
    guard: inMemoryPinAttemptGuard(clock, conBloqueo ? bloqueo : null),
  };
  const gestion = { users, hasher, idGenerator: sequentialIdGenerator('u') };
  const alta = async (name: string, role: 'ADMIN' | 'STAFF', pin: string): Promise<UserId> => {
    const r = await createUser(gestion, politicaDeUsuarios, { role: 'ADMIN' }, { name, role, pin });
    if (!r.ok) throw new Error(`alta ${name}`);
    return r.value.id;
  };
  const luis = await alta('Luis', 'ADMIN', '482915');
  const ana = await alta('Ana', 'STAFF', '4829');
  return { deps, clock, luis, ana, gestion };
}

describe('authorizeWithAdminPin', () => {
  it('con el PIN de un administrador activo autoriza y dice quién y cuándo', async () => {
    const { deps, luis, clock } = await entorno();
    const r = await authorizeWithAdminPin(deps, { adminId: luis, pin: '482915' });
    expect(r.ok && r.value).toEqual({ adminId: luis, authorizedAt: clock.now() });
  });

  it('un PIN incorrecto se rechaza', async () => {
    const { deps, luis } = await entorno();
    const r = await authorizeWithAdminPin(deps, { adminId: luis, pin: '482916' });
    expect(!r.ok && r.error.code).toBe('AUTH_FAILED');
  });

  it('el PIN de un cajero no autoriza, aunque sea el correcto', async () => {
    const { deps, ana } = await entorno();
    const r = await authorizeWithAdminPin(deps, { adminId: ana, pin: '4829' });
    expect(!r.ok && r.error.code).toBe('AUTH_FAILED');
  });

  it('un administrador desactivado no autoriza', async () => {
    const { deps, luis, gestion } = await entorno();
    await setUserActive(gestion, { role: 'ADMIN' }, luis, false);
    const r = await authorizeWithAdminPin(deps, { adminId: luis, pin: '482915' });
    expect(!r.ok && r.error.code).toBe('AUTH_FAILED');
  });

  it('una persona que no existe se rechaza igual que un PIN malo (no da pistas)', async () => {
    const { deps } = await entorno();
    const r = await authorizeWithAdminPin(deps, { adminId: asId<'User'>('nadie'), pin: '482915' });
    expect(r).toEqual({ ok: false, error: { code: 'AUTH_FAILED' } });
  });

  it('tras los intentos fallidos configurados bloquea, aun con el PIN correcto', async () => {
    const { deps, luis } = await entorno();
    for (let i = 0; i < 3; i += 1) {
      await authorizeWithAdminPin(deps, { adminId: luis, pin: '000111' });
    }
    const r = await authorizeWithAdminPin(deps, { adminId: luis, pin: '482915' });
    expect(r).toEqual({ ok: false, error: { code: 'LOCKED', retryAfterSeconds: 30 } });
  });

  it('el bloqueo termina con el tiempo y el siguiente fallo bloquea el doble', async () => {
    const { deps, luis, clock } = await entorno();
    for (let i = 0; i < 3; i += 1) {
      await authorizeWithAdminPin(deps, { adminId: luis, pin: '000111' });
    }
    clock.avanzar(30);
    const otroFallo = await authorizeWithAdminPin(deps, { adminId: luis, pin: '000111' });
    expect(!otroFallo.ok && otroFallo.error.code).toBe('AUTH_FAILED');
    const bloqueado = await authorizeWithAdminPin(deps, { adminId: luis, pin: '482915' });
    expect(bloqueado).toEqual({ ok: false, error: { code: 'LOCKED', retryAfterSeconds: 60 } });
    clock.avanzar(60);
    expect((await authorizeWithAdminPin(deps, { adminId: luis, pin: '482915' })).ok).toBe(true);
  });

  it('un acierto borra los intentos fallidos', async () => {
    const { deps, luis } = await entorno();
    await authorizeWithAdminPin(deps, { adminId: luis, pin: '000111' });
    await authorizeWithAdminPin(deps, { adminId: luis, pin: '000111' });
    expect((await authorizeWithAdminPin(deps, { adminId: luis, pin: '482915' })).ok).toBe(true);
    await authorizeWithAdminPin(deps, { adminId: luis, pin: '000111' });
    await authorizeWithAdminPin(deps, { adminId: luis, pin: '000111' });
    // Dos fallos nuevos: todavía no bloquea porque el contador volvió a cero.
    expect((await authorizeWithAdminPin(deps, { adminId: luis, pin: '482915' })).ok).toBe(true);
  });

  it('el bloqueo de una persona no afecta a otra', async () => {
    const { deps, luis, gestion } = await entorno();
    const r = await createUser(
      gestion,
      politicaDeUsuarios,
      { role: 'ADMIN' },
      { name: 'Ricardo', role: 'ADMIN', pin: '739104' },
    );
    if (!r.ok) throw new Error('alta');
    for (let i = 0; i < 3; i += 1) {
      await authorizeWithAdminPin(deps, { adminId: luis, pin: '000111' });
    }
    expect((await authorizeWithAdminPin(deps, { adminId: r.value.id, pin: '739104' })).ok).toBe(
      true,
    );
  });

  it('con la configuración todavía por definir (null) no bloquea nunca', async () => {
    const { deps, luis } = await entorno(false);
    for (let i = 0; i < 20; i += 1) {
      await authorizeWithAdminPin(deps, { adminId: luis, pin: '000111' });
    }
    expect((await authorizeWithAdminPin(deps, { adminId: luis, pin: '482915' })).ok).toBe(true);
  });
});
