import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  asId,
  createActiveUserSession,
  fakePinHasher,
  inMemoryLoginStore,
  inMemoryPinAttemptGuard,
  type AppUser,
  type Clock,
  type SignInWithPinDeps,
} from '@zammir/core';
import { copiaDePrueba } from '@zammir/core/testing';
import { describe, expect, it } from 'vitest';

import { App } from '../../../App';

const ana = asId<'User'>('u-ana');
const luis = asId<'User'>('u-luis');
const baja = asId<'User'>('u-baja');

const hasher = fakePinHasher();

async function persona(id: typeof ana, name: string, pin: string, extra: Partial<AppUser> = {}) {
  return {
    id,
    name,
    role: 'STAFF' as const,
    isActive: true,
    pin: await hasher.hash(pin, 1000),
    ...extra,
  };
}

async function montar(
  opciones: { listo?: boolean; bajada?: boolean; minutos?: number | null } = {},
) {
  let ahora = new Date('2026-10-30T12:00:00.000Z').getTime();
  const clock: Clock = { now: () => new Date(ahora) };
  const store = inMemoryLoginStore();
  if (opciones.bajada !== false) {
    await store.replace(
      copiaDePrueba([
        await persona(ana, 'Ana', '4829'),
        await persona(luis, 'Luis', '482915', { role: 'ADMIN' }),
        await persona(baja, 'Beto', '7391', { isActive: false }),
      ]),
    );
  }
  const deps: SignInWithPinDeps = {
    store,
    hasher: hasher,
    guard: inMemoryPinAttemptGuard(clock, { maxAttempts: 3, baseSeconds: 30, capSeconds: 120 }),
    deviceReady: () => Promise.resolve(opciones.listo ?? true),
  };
  const session = createActiveUserSession(clock, () => opciones.minutos ?? 5);
  render(
    <MemoryRouter initialEntries={['/entrar']}>
      <App entradaConPin={{ deps, session }} />
    </MemoryRouter>,
  );
  return {
    session,
    avanzar: (s: number) => {
      ahora += s * 1000;
    },
  };
}

function teclear(pin: string): void {
  const teclado = screen.getByRole('group', { name: 'Teclado numérico' });
  for (const digito of pin) {
    fireEvent.click(within(teclado).getByRole('button', { name: digito }));
  }
}

async function elegir(nombre: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: nombre }));
}

describe('entrada con PIN en la tablet', () => {
  it('muestra a las personas activas, sin las desactivadas', async () => {
    await montar();
    await screen.findByRole('button', { name: 'Ana' });
    expect(screen.getByRole('button', { name: 'Luis' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Beto' })).toBeNull();
  });

  it('con el PIN correcto entra y la tablet dice quién la usa', async () => {
    const { session } = await montar();
    await elegir('Ana');
    teclear('4829');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Ana', { selector: 'strong' })).toBeTruthy();
    expect(session.actingUser()?.name).toBe('Ana');
  });

  it('el PIN no se ve: solo puntos', async () => {
    await montar();
    await elegir('Ana');
    teclear('4829');
    expect(screen.getByRole('status', { name: 'PIN' }).textContent).toBe('●●●●');
    expect(document.body.textContent).not.toContain('4829');
  });

  it('con el PIN incorrecto no entra y dice qué hacer', async () => {
    const { session } = await montar();
    await elegir('Ana');
    teclear('1111');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('El PIN no es correcto.')).toBeTruthy();
    expect(screen.getByText(/Revisa el PIN e intenta de nuevo/)).toBeTruthy();
    expect(session.actingUser()).toBeNull();
  });

  it('tras varios intentos fallidos bloquea y dice cuánto esperar', async () => {
    await montar();
    await elegir('Ana');
    for (let i = 0; i < 3; i += 1) {
      teclear('1111');
      fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
      await screen.findByRole('alert');
    }
    teclear('4829');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText(/Demasiados intentos con el PIN\./)).toBeTruthy();
    expect(screen.getByText(/Intenta de nuevo en 30 segundos/)).toBeTruthy();
  });

  it('una tablet no conectada no deja entrar y dice cómo conectarla', async () => {
    await montar({ listo: false });
    await elegir('Ana');
    teclear('4829');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText(/no está conectada o ya no tiene permiso/)).toBeTruthy();
  });

  it('sin haber bajado nunca las personas pide conectarse a internet una vez', async () => {
    await montar({ bajada: false });
    expect(await screen.findByText(/todavía no tiene la lista de personas/)).toBeTruthy();
  });

  it('Borrar quita el último dígito', async () => {
    await montar();
    await elegir('Ana');
    teclear('482');
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(screen.getByRole('status', { name: 'PIN' }).textContent).toBe('●●');
  });

  it('cambiar de usuario vuelve a la pantalla de personas', async () => {
    const { session } = await montar();
    await elegir('Ana');
    teclear('4829');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByText('Ana', { selector: 'strong' });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de usuario' }));
    expect(
      await screen.findByRole('heading', { name: '¿Quién va a usar la tablet?' }),
    ).toBeTruthy();
    expect(session.actingUser()).toBeNull();
  });

  it('por inactividad la tablet vuelve a la pantalla de personas sin cerrar nada más', async () => {
    const { session, avanzar } = await montar({ minutos: 5 });
    await elegir('Ana');
    teclear('4829');
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByText('Ana', { selector: 'strong' });
    avanzar(301);
    act(() => {
      session.check();
    });
    expect(
      await screen.findByRole('heading', { name: '¿Quién va a usar la tablet?' }),
    ).toBeTruthy();
    expect(screen.queryByText('Ana', { selector: 'strong' })).toBeNull();
  });
});
