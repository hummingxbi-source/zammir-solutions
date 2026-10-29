import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { inMemoryAdminAuth, type AdminAuth, type Clock, type CuentaDePrueba } from '@zammir/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../../../App';
import { ProveedorSesionAdmin } from './SesionAdmin';

const cuentas: CuentaDePrueba[] = [
  { userId: 'u-1', email: 'admin@ejemplo.invalid', password: 'clave-de-prueba-1', role: 'ADMIN' },
  { userId: 'u-2', email: 'cajero@ejemplo.invalid', password: 'clave-de-prueba-2', role: 'STAFF' },
];

/** Reloj de pruebas que se mueve a mano. */
function relojManual(inicio: Date): Clock & { avanzar: (ms: number) => void } {
  let ahora = inicio.getTime();
  return {
    now: () => new Date(ahora),
    avanzar: (ms) => {
      ahora += ms;
    },
  };
}

function mostrar(
  auth: AdminAuth,
  ruta: string,
  opciones: { clock?: Clock; limite?: number | null } = {},
): void {
  const clock = opciones.clock ?? relojManual(new Date('2026-10-29T10:00:00Z'));
  render(
    <ProveedorSesionAdmin
      auth={auth}
      clock={clock}
      cargarLimiteInactividad={() => Promise.resolve(opciones.limite ?? null)}
    >
      <MemoryRouter initialEntries={[ruta]}>
        <App />
      </MemoryRouter>
    </ProveedorSesionAdmin>,
  );
}

async function entrarCon(correo: string, contrasena: string): Promise<void> {
  fireEvent.change(await screen.findByLabelText('Correo'), { target: { value: correo } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: contrasena } });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('sección de administradores', () => {
  it('sin sesión pide entrar y no muestra el contenido', async () => {
    mostrar(inMemoryAdminAuth(cuentas), '/reportes');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).queryByRole('heading', { name: 'Reportes' }),
    ).toBeNull();
  });

  it('un administrador con credenciales válidas entra y ve la sección', async () => {
    mostrar(inMemoryAdminAuth(cuentas), '/reportes');
    await entrarCon('admin@ejemplo.invalid', 'clave-de-prueba-1');
    expect(await screen.findByRole('heading', { name: 'Reportes' })).toBeInTheDocument();
  });

  it('una cuenta de cajero que intenta entrar no ve la sección y recibe un aviso que dice qué hacer', async () => {
    mostrar(inMemoryAdminAuth(cuentas), '/usuarios');
    await entrarCon('cajero@ejemplo.invalid', 'clave-de-prueba-2');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta cuenta no es de administrador.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Entra con una cuenta de administrador');
    expect(screen.queryByRole('heading', { name: 'Usuarios' })).toBeNull();
  });

  it('contraseña incorrecta muestra el error y vacía la contraseña', async () => {
    mostrar(inMemoryAdminAuth(cuentas), '/reportes');
    await entrarCon('admin@ejemplo.invalid', 'incorrecta');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El correo o la contraseña no son correctos.',
    );
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  it('un correo mal escrito avisa antes de llamar al servidor', async () => {
    mostrar(inMemoryAdminAuth(cuentas), '/reportes');
    await entrarCon('esto-no-es-un-correo', 'algo');
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa tu correo y tu contraseña.');
  });

  it('una sesión de cajero ya abierta ve el aviso de falta de permiso y puede salir', async () => {
    const auth = inMemoryAdminAuth(cuentas);
    await auth.signIn('cajero@ejemplo.invalid', 'clave-de-prueba-2');
    mostrar(auth, '/configuracion');
    expect(await screen.findByRole('alert')).toHaveTextContent('no tiene permiso');
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('una sesión de administrador ya abierta se recupera al abrir la aplicación', async () => {
    const auth = inMemoryAdminAuth(cuentas);
    await auth.signIn('admin@ejemplo.invalid', 'clave-de-prueba-1');
    mostrar(auth, '/reportes');
    expect(await screen.findByRole('heading', { name: 'Reportes' })).toBeInTheDocument();
  });

  it('las secciones que no son de administrador no piden entrar', async () => {
    mostrar(inMemoryAdminAuth(cuentas), '/clientes');
    expect(await screen.findByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Entrar' })).toBeNull();
  });
});

describe('cierre de sesión por inactividad', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function conSesionDeAdministrador(
    limite: number | null,
  ): Promise<{ clock: ReturnType<typeof relojManual> }> {
    const clock = relojManual(new Date('2026-10-29T10:00:00Z'));
    const auth = inMemoryAdminAuth(cuentas);
    await auth.signIn('admin@ejemplo.invalid', 'clave-de-prueba-1');
    mostrar(auth, '/reportes', { clock, limite });
    await screen.findByRole('heading', { name: 'Reportes' });
    // Deja que termine de cargarse el límite de inactividad antes de mover el reloj.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    return { clock };
  }

  it('al cumplirse el tiempo configurado cierra la sesión', async () => {
    const { clock } = await conSesionDeAdministrador(30);
    clock.avanzar(31 * 60_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    });
  });

  it('con actividad antes de cumplirse el tiempo la sesión sigue abierta', async () => {
    const { clock } = await conSesionDeAdministrador(30);
    clock.avanzar(20 * 60_000);
    fireEvent.pointerDown(window);
    clock.avanzar(20 * 60_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByRole('heading', { name: 'Reportes' })).toBeInTheDocument();
  });

  it('sin límite configurado (por definir) no cierra la sesión por inactividad', async () => {
    const { clock } = await conSesionDeAdministrador(null);
    clock.avanzar(24 * 60 * 60_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(screen.getByRole('heading', { name: 'Reportes' })).toBeInTheDocument();
  });
});
