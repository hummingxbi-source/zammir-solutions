import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  asId,
  err,
  fixedClock,
  ok,
  type DeviceCredentials,
  type DeviceCredentialsStore,
  type DeviceRegistrar,
  type RegisterTabletDeps,
} from '@zammir/core';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../../../App';

const instante = new Date('2026-10-30T18:00:00.000Z');
const credenciales: DeviceCredentials = {
  device: { id: asId<'Device'>('d-1'), name: 'Mostrador', tempSeries: 1 },
  session: { accessToken: 'a', refreshToken: 'r' },
  registeredAt: instante,
};

function memoria(inicial: DeviceCredentials | null = null): DeviceCredentialsStore {
  let guardada = inicial;
  return {
    load: () => Promise.resolve(guardada),
    save: (c) => {
      guardada = c;
      return Promise.resolve();
    },
    clear: () => {
      guardada = null;
      return Promise.resolve();
    },
  };
}

function mostrar(registrar: DeviceRegistrar, inicial: DeviceCredentials | null = null) {
  const deps: RegisterTabletDeps = {
    registrar,
    store: memoria(inicial),
    clock: fixedClock(instante),
  };
  render(
    <MemoryRouter initialEntries={['/conectar']}>
      <App conectarTablet={deps} />
    </MemoryRouter>,
  );
  return deps;
}

function conectar(codigo: string, nombre: string): void {
  fireEvent.change(screen.getByLabelText('Código de registro'), { target: { value: codigo } });
  fireEvent.change(screen.getByLabelText('Nombre de esta tablet (por ejemplo, Mostrador)'), {
    target: { value: nombre },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Conectar' }));
}

describe('pantalla Conectar esta tablet', () => {
  it('conecta la tablet con el código y guarda sus credenciales', async () => {
    const register = vi.fn(() =>
      Promise.resolve(ok({ device: credenciales.device, session: credenciales.session })),
    );
    const deps = mostrar({ register });
    await screen.findByLabelText('Código de registro');
    conectar('abcd-2345', 'Mostrador');
    expect(await screen.findByText(/esta tablet quedó conectada como/)).toBeTruthy();
    expect(screen.getAllByText('Mostrador').length).toBeGreaterThan(0);
    expect(register).toHaveBeenCalledWith({ code: 'ABCD2345', name: 'Mostrador' });
    expect(await deps.store.load()).toMatchObject({ device: { name: 'Mostrador' } });
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toBeTruthy();
  });

  it.each([
    [
      'CODE_INVALID',
      'El código no sirve: no existe, ya se usó o ya venció.',
      'Pide un código nuevo a un administrador.',
    ],
    [
      'NETWORK_UNAVAILABLE',
      'No hay conexión con el servidor.',
      'Conéctate a internet e intenta de nuevo.',
    ],
    [
      'DEVICES_UNAVAILABLE',
      'El servidor no pudo conectar la tablet.',
      'Intenta de nuevo en unos minutos.',
    ],
  ] as const)(
    'si el servidor responde %s, dice qué pasó y qué hacer',
    async (codigo, mensaje, queHacer) => {
      mostrar({ register: () => Promise.resolve(err({ code: codigo })) });
      await screen.findByLabelText('Código de registro');
      conectar('ABCD2345', 'Mostrador');
      expect(await screen.findByText(mensaje)).toBeTruthy();
      expect(screen.getByText(queHacer)).toBeTruthy();
      expect(screen.queryByText(/quedó conectada/)).toBeNull();
    },
  );

  it('sin código o sin nombre pide los datos y no llama al servidor', async () => {
    const register = vi.fn();
    mostrar({ register });
    await screen.findByLabelText('Código de registro');
    conectar('  ', 'Mostrador');
    expect(await screen.findByText('Faltan datos.')).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it('una tablet ya conectada lo dice y permite olvidar el registro', async () => {
    const deps = mostrar(
      { register: () => Promise.resolve(err({ code: 'CODE_INVALID' })) },
      credenciales,
    );
    expect(await screen.findByText(/Esta tablet ya está conectada como/)).toBeTruthy();
    expect(screen.queryByLabelText('Código de registro')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Olvidar el registro de esta tablet' }));
    expect(await screen.findByText(/Se olvidó el registro/)).toBeTruthy();
    expect(await deps.store.load()).toBeNull();
    expect(screen.getByLabelText('Código de registro')).toBeTruthy();
  });

  it('el inicio ofrece el acceso para conectar la tablet', async () => {
    const deps: RegisterTabletDeps = {
      registrar: { register: () => Promise.resolve(err({ code: 'CODE_INVALID' })) },
      store: memoria(),
      clock: fixedClock(instante),
    };
    render(
      <MemoryRouter initialEntries={['/']}>
        <App conectarTablet={deps} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: 'Conectar esta tablet' })).toBeTruthy();
  });
});
