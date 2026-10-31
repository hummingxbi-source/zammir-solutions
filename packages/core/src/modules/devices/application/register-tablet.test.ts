import { describe, expect, it, vi } from 'vitest';

import { fixedClock } from '../../../shared-kernel/clock';
import { asId } from '../../../shared-kernel/id';
import { err, ok } from '../../../shared-kernel/result';
import {
  normalizeRegistrationCode,
  registerTablet,
  type DeviceCredentials,
  type DeviceCredentialsStore,
  type DeviceRegistrar,
} from './register-tablet';

const instante = new Date('2026-10-30T18:00:00.000Z');
const dispositivo = { id: asId<'Device'>('d-1'), name: 'Tablet del mostrador', tempSeries: 1 };
const sesion = { accessToken: 'acceso', refreshToken: 'renovacion' };

function memoriaDeCredenciales(inicial: DeviceCredentials | null = null): DeviceCredentialsStore {
  let guardadas = inicial;
  return {
    load: () => Promise.resolve(guardadas),
    save: (c) => {
      guardadas = c;
      return Promise.resolve();
    },
    clear: () => {
      guardadas = null;
      return Promise.resolve();
    },
  };
}

function entorno(registrar?: DeviceRegistrar, inicial: DeviceCredentials | null = null) {
  const llamar = vi.fn(() => Promise.resolve(ok({ device: dispositivo, session: sesion })));
  const registrador: DeviceRegistrar = registrar ?? { register: llamar };
  const store = memoriaDeCredenciales(inicial);
  return {
    deps: { registrar: registrador, store, clock: fixedClock(instante) },
    store,
    llamar,
  };
}

describe('normalizeRegistrationCode', () => {
  it.each([
    ['abcd2345', 'ABCD2345'],
    [' abcd 2345 ', 'ABCD2345'],
    ['ABCD-2345', 'ABCD2345'],
    ['ab-cd 23-45', 'ABCD2345'],
    ['', ''],
  ])('%j → %j', (escrito, esperado) => {
    expect(normalizeRegistrationCode(escrito)).toBe(esperado);
  });
});

describe('registerTablet', () => {
  it('registra la tablet y guarda sus credenciales con la hora de registro', async () => {
    const { deps, store, llamar } = entorno();
    const r = await registerTablet(deps, { code: 'abcd-2345', name: '  Tablet del mostrador ' });
    expect(r.ok && r.value).toEqual({
      device: dispositivo,
      session: sesion,
      registeredAt: instante,
    });
    expect(llamar).toHaveBeenCalledWith({
      code: 'ABCD2345',
      name: 'Tablet del mostrador',
    });
    expect(await store.load()).toEqual({
      device: dispositivo,
      session: sesion,
      registeredAt: instante,
    });
  });

  it.each([
    ['sin código', { code: '  -  ', name: 'Tablet' }],
    ['sin nombre', { code: 'ABCD2345', name: '   ' }],
  ])('%s: no llama al servidor ni guarda nada', async (_caso, entrada) => {
    const { deps, store, llamar } = entorno();
    const r = await registerTablet(deps, entrada);
    expect(!r.ok && r.error.code).toBe('INVALID_INPUT');
    expect(llamar).not.toHaveBeenCalled();
    expect(await store.load()).toBeNull();
  });

  it.each(['CODE_INVALID', 'NETWORK_UNAVAILABLE', 'DEVICES_UNAVAILABLE'] as const)(
    'si el servidor responde %s, devuelve ese error y no guarda nada',
    async (codigo) => {
      const { deps, store } = entorno({ register: () => Promise.resolve(err({ code: codigo })) });
      const r = await registerTablet(deps, { code: 'ABCD2345', name: 'Tablet' });
      expect(!r.ok && r.error.code).toBe(codigo);
      expect(await store.load()).toBeNull();
    },
  );

  it('una tablet ya registrada no se registra otra vez ni gasta un código', async () => {
    const previa: DeviceCredentials = {
      device: dispositivo,
      session: sesion,
      registeredAt: instante,
    };
    const { deps, llamar } = entorno(undefined, previa);
    const r = await registerTablet(deps, { code: 'ABCD2345', name: 'Otra' });
    expect(!r.ok && r.error.code).toBe('ALREADY_REGISTERED');
    expect(llamar).not.toHaveBeenCalled();
  });

  it('tras olvidar el registro se puede registrar de nuevo', async () => {
    const previa: DeviceCredentials = {
      device: dispositivo,
      session: sesion,
      registeredAt: instante,
    };
    const { deps, store } = entorno(undefined, previa);
    await store.clear();
    const r = await registerTablet(deps, { code: 'ABCD2345', name: 'Tablet' });
    expect(r.ok).toBe(true);
  });
});
