import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  asId,
  createActiveUserSession,
  fakePinHasher,
  inMemoryLoginStore,
  inMemoryPinAttemptGuard,
  type Clock,
  type SignInWithPinDeps,
  type StaffRole,
} from '@zammir/core';
import { copiaDePrueba } from '@zammir/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../App';

/** E4 · Tres personas con PIN en la misma tablet [PRUEBAS_DE_ACEPTACION.md]: cada quien entra con su PIN,
 *  la tablet siempre sabe quién la usa, lo que cada quien tenía a medias se conserva al cambiar de
 *  usuario y, sin actividad, vuelve a la pantalla de personas. La atribución de cada acción en la base
 *  de datos depende de que las acciones de la tablet lleven a la persona activa (ver PENDIENTES). */

// La pantalla completa se monta entera y, con todo el conjunto corriendo a la vez, puede pasar de los 5 s por
// omisión: este archivo pide más margen solo para él (la configuración global no se toca).
vi.setConfig({ testTimeout: 30_000 });

const hasher = fakePinHasher();
const gente = [
  { id: asId<'User'>('u-ana'), name: 'Ana', role: 'STAFF' as StaffRole, pin: '4829' },
  { id: asId<'User'>('u-beto'), name: 'Beto', role: 'STAFF' as StaffRole, pin: '7391' },
  { id: asId<'User'>('u-luis'), name: 'Luis', role: 'ADMIN' as StaffRole, pin: '482915' },
];

async function tablet() {
  let ahora = new Date('2026-10-30T12:00:00.000Z').getTime();
  const clock: Clock = { now: () => new Date(ahora) };
  const store = inMemoryLoginStore();
  await store.replace(
    copiaDePrueba(
      await Promise.all(
        gente.map(async (p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          isActive: true,
          pin: await hasher.hash(p.pin, 1000),
        })),
      ),
    ),
  );
  const deps: SignInWithPinDeps = {
    store,
    hasher,
    guard: inMemoryPinAttemptGuard(clock, { maxAttempts: 3, baseSeconds: 30, capSeconds: 120 }),
    deviceReady: () => Promise.resolve(true),
  };
  const session = createActiveUserSession(clock, () => 5);
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

async function entrarComo(nombre: string, pin: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: nombre }));
  const teclado = screen.getByRole('group', { name: 'Teclado numérico' });
  for (const digito of pin) {
    fireEvent.click(within(teclado).getByRole('button', { name: digito }));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
  await screen.findByText(nombre, { selector: 'strong' });
}

async function cambiarDeUsuario(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Cambiar de usuario' }));
  await screen.findByRole('heading', { name: '¿Quién va a usar la tablet?' });
}

describe('E4 · tres personas con PIN en la misma tablet', () => {
  it('cada quien entra con su PIN y la tablet sabe en todo momento quién la usa', async () => {
    const { session } = await tablet();
    const vistos: string[] = [];
    for (const p of gente) {
      await entrarComo(p.name, p.pin);
      vistos.push(session.actingUser()?.name ?? '');
      expect(session.actingUser()?.role).toBe(p.role);
      await cambiarDeUsuario();
      expect(session.actingUser()).toBeNull();
    }
    expect(vistos).toEqual(['Ana', 'Beto', 'Luis']);
  });

  it('el PIN de una persona no sirve para entrar como otra', async () => {
    const { session } = await tablet();
    fireEvent.click(await screen.findByRole('button', { name: 'Ana' }));
    const teclado = screen.getByRole('group', { name: 'Teclado numérico' });
    for (const digito of '7391') {
      fireEvent.click(within(teclado).getByRole('button', { name: digito }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('El PIN no es correcto.')).toBeTruthy();
    expect(session.actingUser()).toBeNull();
  });

  it('al cambiar de usuario, lo que cada quien tenía a medias se conserva', async () => {
    const { session } = await tablet();
    await entrarComo('Ana', '4829');
    session.saveDraft(gente[0]?.id ?? asId<'User'>('x'), 'cotizacion', 'ventana 800 x 1200');
    await cambiarDeUsuario();
    await entrarComo('Beto', '7391');
    expect(session.draft(gente[0]?.id ?? asId<'User'>('x'), 'cotizacion')).toBe(
      'ventana 800 x 1200',
    );
    expect(session.draft(gente[1]?.id ?? asId<'User'>('x'), 'cotizacion')).toBeUndefined();
    await cambiarDeUsuario();
    await entrarComo('Ana', '4829');
    expect(session.draft(gente[0]?.id ?? asId<'User'>('x'), 'cotizacion')).toBe(
      'ventana 800 x 1200',
    );
  });

  it('sin actividad la tablet se bloquea y vuelve a pedir quién es; con actividad no', async () => {
    const { session, avanzar } = await tablet();
    await entrarComo('Beto', '7391');
    avanzar(200);
    fireEvent.pointerDown(document.body);
    avanzar(200);
    act(() => {
      session.check();
    });
    expect(session.actingUser()?.name).toBe('Beto');
    avanzar(301);
    act(() => {
      session.check();
    });
    expect(
      await screen.findByRole('heading', { name: '¿Quién va a usar la tablet?' }),
    ).toBeTruthy();
    expect(session.actingUser()).toBeNull();
    await entrarComo('Ana', '4829');
    expect(session.actingUser()?.name).toBe('Ana');
  });
});
