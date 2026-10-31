import { describe, expect, it } from 'vitest';

import type { Clock } from '../../../shared-kernel/clock';
import { asId, type UserId } from '../../../shared-kernel/id';
import { err, ok } from '../../../shared-kernel/result';
import { localLoginStoreContract, copiaDePrueba } from '../contracts/local-login-store.contract';
import {
  pinAttemptGuardContract,
  POLITICA_DEL_CONTRATO,
} from '../contracts/pin-attempt-guard.contract';
import { fakePinHasher } from './in-memory-users';
import { inMemoryLoginStore } from './in-memory-login-store';
import { inMemoryPinAttemptGuard } from './pin-attempt-guard';
import {
  refreshLogin,
  signInWithPin,
  type LoginReplicaSource,
  type SignInWithPinDeps,
} from './sign-in-with-pin';
import type { AppUser } from '../domain/user';

localLoginStoreContract('memoria', () => inMemoryLoginStore());

pinAttemptGuardContract('memoria', () => {
  let ahora = new Date('2026-10-30T12:00:00.000Z').getTime();
  const clock: Clock = { now: () => new Date(ahora) };
  return {
    guard: inMemoryPinAttemptGuard(clock, POLITICA_DEL_CONTRATO),
    avanzar: (s) => {
      ahora += s * 1000;
    },
  };
});

const hasher = fakePinHasher();
const ana = asId<'User'>('u-ana');
const luis = asId<'User'>('u-luis');

async function persona(id: UserId, nombre: string, pin: string, extra: Partial<AppUser> = {}) {
  return {
    id,
    name: nombre,
    role: 'STAFF' as const,
    isActive: true,
    pin: await hasher.hash(pin, 1000),
    ...extra,
  };
}

async function entorno(listo = true, bajado = true) {
  let ahora = new Date('2026-10-30T12:00:00.000Z').getTime();
  const clock: Clock = { now: () => new Date(ahora) };
  const store = inMemoryLoginStore();
  if (bajado) {
    await store.replace(
      copiaDePrueba([
        await persona(ana, 'Ana', '4829'),
        await persona(luis, 'Luis', '482915', { role: 'ADMIN', isActive: false }),
      ]),
    );
  }
  const deps: SignInWithPinDeps = {
    store,
    hasher,
    guard: inMemoryPinAttemptGuard(clock, { maxAttempts: 3, baseSeconds: 30, capSeconds: 120 }),
    deviceReady: () => Promise.resolve(listo),
  };
  return {
    deps,
    avanzar: (s: number) => {
      ahora += s * 1000;
    },
  };
}

describe('signInWithPin', () => {
  it('con el PIN correcto entra y dice quién es', async () => {
    const { deps } = await entorno();
    const r = await signInWithPin(deps, { userId: ana, pin: '4829' });
    expect(r.ok && r.value).toEqual({ id: ana, name: 'Ana', role: 'STAFF' });
  });

  it('un PIN incorrecto no entra', async () => {
    const { deps } = await entorno();
    const r = await signInWithPin(deps, { userId: ana, pin: '4830' });
    expect(!r.ok && r.error.code).toBe('AUTH_FAILED');
  });

  it('una persona desactivada no entra ni con su PIN correcto', async () => {
    const { deps } = await entorno();
    const r = await signInWithPin(deps, { userId: luis, pin: '482915' });
    expect(!r.ok && r.error.code).toBe('AUTH_FAILED');
  });

  it('una persona que no existe se rechaza igual que un PIN malo', async () => {
    const { deps } = await entorno();
    const r = await signInWithPin(deps, { userId: asId<'User'>('nadie'), pin: '4829' });
    expect(!r.ok && r.error.code).toBe('AUTH_FAILED');
  });

  it('una tablet no registrada o revocada no deja entrar', async () => {
    const { deps } = await entorno(false);
    const r = await signInWithPin(deps, { userId: ana, pin: '4829' });
    expect(!r.ok && r.error.code).toBe('DEVICE_NOT_READY');
  });

  it('sin haber bajado nunca las personas avisa que hay que conectarse', async () => {
    const { deps } = await entorno(true, false);
    const r = await signInWithPin(deps, { userId: ana, pin: '4829' });
    expect(!r.ok && r.error.code).toBe('NO_USERS_YET');
  });

  it('tras los intentos fallidos bloquea, aun con el PIN correcto, hasta que pasa el tiempo', async () => {
    const { deps, avanzar } = await entorno();
    for (let i = 0; i < 3; i += 1) {
      await signInWithPin(deps, { userId: ana, pin: '0000' });
    }
    const bloqueada = await signInWithPin(deps, { userId: ana, pin: '4829' });
    expect(!bloqueada.ok && bloqueada.error).toEqual({ code: 'LOCKED', retryAfterSeconds: 30 });
    avanzar(31);
    const libre = await signInWithPin(deps, { userId: ana, pin: '4829' });
    expect(libre.ok).toBe(true);
  });

  it('un acierto borra los fallos anteriores', async () => {
    const { deps } = await entorno();
    await signInWithPin(deps, { userId: ana, pin: '0000' });
    await signInWithPin(deps, { userId: ana, pin: '0000' });
    await signInWithPin(deps, { userId: ana, pin: '4829' });
    await signInWithPin(deps, { userId: ana, pin: '0000' });
    await signInWithPin(deps, { userId: ana, pin: '0000' });
    const r = await signInWithPin(deps, { userId: ana, pin: '4829' });
    expect(r.ok).toBe(true);
  });

  it('lo guardado en la tablet no contiene el PIN', async () => {
    const { deps } = await entorno();
    const guardado = JSON.stringify(await deps.store.load());
    expect(guardado).not.toContain('4829');
    expect(guardado).not.toContain('482915');
  });
});

describe('refreshLogin', () => {
  it('reemplaza la copia local con lo que baja', async () => {
    const store = inMemoryLoginStore();
    const fuente: LoginReplicaSource = {
      load: async () => ok(copiaDePrueba([await persona(ana, 'Ana', '4829')])),
    };
    const r = await refreshLogin({ source: fuente, store });
    expect(r.ok && r.value.users).toBe(1);
    expect((await store.load())?.users).toHaveLength(1);
  });

  it('sin conexión conserva lo guardado', async () => {
    const store = inMemoryLoginStore();
    await store.replace(copiaDePrueba([await persona(ana, 'Ana', '4829')]));
    const fuente: LoginReplicaSource = {
      load: () => Promise.resolve(err({ code: 'USERS_UNAVAILABLE' })),
    };
    const r = await refreshLogin({ source: fuente, store });
    expect(!r.ok && r.error.code).toBe('USERS_UNAVAILABLE');
    expect((await store.load())?.users).toHaveLength(1);
  });
});
