import { asId, type DeviceCredentials } from '@zammir/core';
import { describe, expect, it, vi } from 'vitest';

import { functionDeviceRegistrar } from './function-device-registrar';
import { localCredentialsStore } from './local-credentials-store';

function respuesta(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado });
}

function registrador(fetchImpl: typeof fetch) {
  return functionDeviceRegistrar({ url: 'http://servidor', anonKey: 'llave-publica', fetchImpl });
}

const entrada = { code: 'ABCD2345', name: 'Tablet del mostrador' };

describe('functionDeviceRegistrar', () => {
  it('manda el código y el nombre a la función con la llave pública y entiende la respuesta', async () => {
    const peticion = vi.fn(() =>
      Promise.resolve(
        respuesta(200, {
          dispositivo: { id: 'd-1', nombre: 'Tablet del mostrador', serie: 2 },
          sesion: { access_token: 'acceso', refresh_token: 'renovacion' },
        }),
      ),
    );
    const r = await registrador(peticion).register(entrada);
    expect(r).toEqual({
      ok: true,
      value: {
        device: { id: 'd-1', name: 'Tablet del mostrador', tempSeries: 2 },
        session: { accessToken: 'acceso', refreshToken: 'renovacion' },
      },
    });
    const [url, init] = peticion.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://servidor/functions/v1/registrar-dispositivo');
    expect(init.method).toBe('POST');
    expect(JSON.parse(typeof init.body === 'string' ? init.body : '')).toEqual({
      codigo: 'ABCD2345',
      nombre: 'Tablet del mostrador',
    });
    expect(init.headers).toMatchObject({
      apikey: 'llave-publica',
      authorization: 'Bearer llave-publica',
    });
  });

  it.each([
    [400, { error: 'CODE_INVALID' }, 'CODE_INVALID'],
    [400, { error: 'INVALID_INPUT' }, 'INVALID_INPUT'],
    [503, { error: 'DEVICES_UNAVAILABLE' }, 'DEVICES_UNAVAILABLE'],
    [500, {}, 'DEVICES_UNAVAILABLE'],
    [400, { error: 'ALGO_RARO' }, 'INVALID_INPUT'],
  ])('respuesta %i %j → %s', async (estado, cuerpo, esperado) => {
    const r = await registrador(() => Promise.resolve(respuesta(estado, cuerpo))).register(entrada);
    expect(!r.ok && r.error.code).toBe(esperado);
  });

  it('sin conexión con el servidor devuelve NETWORK_UNAVAILABLE', async () => {
    const r = await registrador(() => Promise.reject(new TypeError('Failed to fetch'))).register(
      entrada,
    );
    expect(!r.ok && r.error.code).toBe('NETWORK_UNAVAILABLE');
  });

  it('una respuesta que no es JSON devuelve DEVICES_UNAVAILABLE', async () => {
    const r = await registrador(() =>
      Promise.resolve(new Response('<html>error</html>', { status: 502 })),
    ).register(entrada);
    expect(!r.ok && r.error.code).toBe('DEVICES_UNAVAILABLE');
  });
});

function almacenamientoFalso(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() {
      return datos.size;
    },
    clear: () => {
      datos.clear();
    },
    getItem: (clave) => datos.get(clave) ?? null,
    key: (i) => [...datos.keys()][i] ?? null,
    removeItem: (clave) => {
      datos.delete(clave);
    },
    setItem: (clave, valor) => {
      datos.set(clave, valor);
    },
  };
}

const credenciales: DeviceCredentials = {
  device: { id: asId<'Device'>('d-1'), name: 'Tablet', tempSeries: 1 },
  session: { accessToken: 'a', refreshToken: 'r' },
  registeredAt: new Date('2026-10-30T18:00:00.000Z'),
};

describe('localCredentialsStore', () => {
  it('sin nada guardado dice que la tablet no está registrada', async () => {
    expect(await localCredentialsStore(almacenamientoFalso()).load()).toBeNull();
  });

  it('guarda y recupera las credenciales, con la fecha como fecha', async () => {
    const tienda = localCredentialsStore(almacenamientoFalso());
    await tienda.save(credenciales);
    expect(await tienda.load()).toEqual(credenciales);
  });

  it('olvidar el registro lo borra', async () => {
    const tienda = localCredentialsStore(almacenamientoFalso());
    await tienda.save(credenciales);
    await tienda.clear();
    expect(await tienda.load()).toBeNull();
  });

  it('lo guardado dañado se trata como no registrada, sin lanzar errores', async () => {
    const almacen = almacenamientoFalso();
    almacen.setItem('zammir.credenciales-del-dispositivo', '{no es json');
    expect(await localCredentialsStore(almacen).load()).toBeNull();
  });

  it('si el almacenamiento falla, no lanza errores', async () => {
    const roto: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
      removeItem: () => {
        throw new Error('bloqueado');
      },
    };
    const tienda = localCredentialsStore(roto);
    await expect(tienda.save(credenciales)).resolves.toBeUndefined();
    await expect(tienda.clear()).resolves.toBeUndefined();
    expect(await tienda.load()).toBeNull();
  });
});
