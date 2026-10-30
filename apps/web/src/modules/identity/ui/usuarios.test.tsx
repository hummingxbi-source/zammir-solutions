import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  fakePinHasher,
  fixedClock,
  inMemoryAdminAuth,
  inMemoryAuditLog,
  inMemoryUsers,
  sequentialIdGenerator,
  type ManageUsersDeps,
  type UserPolicy,
} from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { App } from '../../../App';
import { ProveedorSesionAdmin } from './SesionAdmin';

const instante = new Date('2026-10-30T18:00:00.000Z');
const politica: UserPolicy = { adminMinDigits: 6, pbkdf2Iterations: 1000 };

function entorno(): ManageUsersDeps {
  return {
    users: inMemoryUsers({
      clock: fixedClock(instante),
      idGenerator: sequentialIdGenerator('b'),
      auditLog: inMemoryAuditLog(),
    }),
    hasher: fakePinHasher(),
    idGenerator: sequentialIdGenerator('u'),
  };
}

function mostrar(
  deps: ManageUsersDeps,
  rol: 'ADMIN' | 'STAFF' = 'ADMIN',
  cargarPolitica: () => Promise<UserPolicy | null> = () => Promise.resolve(politica),
): void {
  const auth = inMemoryAdminAuth([
    { userId: 'a-1', email: 'a@ejemplo.invalid', password: 'clave-de-prueba-1', role: rol },
  ]);
  render(
    <ProveedorSesionAdmin
      auth={auth}
      clock={fixedClock(instante)}
      cargarLimiteInactividad={() => Promise.resolve(null)}
    >
      <MemoryRouter initialEntries={['/usuarios']}>
        <App usuarios={{ deps, cargarPolitica }} />
      </MemoryRouter>
    </ProveedorSesionAdmin>,
  );
}

async function entrar(): Promise<void> {
  fireEvent.change(await screen.findByLabelText('Correo'), {
    target: { value: 'a@ejemplo.invalid' },
  });
  fireEvent.change(screen.getByLabelText('Contraseña'), {
    target: { value: 'clave-de-prueba-1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

async function darDeAlta(nombre: string, pin: string, rol?: 'ADMIN'): Promise<void> {
  fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: nombre } });
  if (rol !== undefined) {
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: rol } });
  }
  fireEvent.change(screen.getByLabelText('PIN'), { target: { value: pin } });
  fireEvent.click(screen.getByRole('button', { name: 'Dar de alta' }));
}

describe('pantalla de personas del mostrador', () => {
  it('sin personas dice cómo dar de alta a la primera', async () => {
    mostrar(entorno());
    await entrar();
    expect(await screen.findByText(/Todavía no hay personas registradas/)).toBeTruthy();
  });

  it('da de alta a un cajero y lo muestra activo, sin mostrar su PIN', async () => {
    const deps = entorno();
    mostrar(deps);
    await entrar();
    await darDeAlta('Ana', '4829');
    const fila = (await screen.findByRole('rowheader', { name: 'Ana' })).closest('tr');
    expect(fila).not.toBeNull();
    if (fila === null) return;
    expect(within(fila).getByText('Cajero / vendedor')).toBeTruthy();
    expect(within(fila).getByText('Activo')).toBeTruthy();
    expect(screen.getByText('Persona dada de alta.')).toBeTruthy();
    const guardado = await deps.users.list();
    expect(JSON.stringify(guardado)).not.toContain('4829');
  });

  it.each([
    ['0000', 'Ese PIN es muy fácil de adivinar.'],
    ['1234', 'Ese PIN es muy fácil de adivinar.'],
    ['12', 'El PIN no es válido.'],
  ])('rechaza el PIN %s y dice qué hacer', async (pin, mensaje) => {
    mostrar(entorno());
    await entrar();
    await darDeAlta('Ana', pin);
    expect(await screen.findByText(mensaje)).toBeTruthy();
    expect(screen.queryByRole('rowheader', { name: 'Ana' })).toBeNull();
  });

  it('un administrador necesita un PIN de 6 dígitos', async () => {
    mostrar(entorno());
    await entrar();
    await darDeAlta('Luis', '4829', 'ADMIN');
    expect(await screen.findByText('El PIN de un administrador es más largo.')).toBeTruthy();
  });

  it('no deja repetir el nombre', async () => {
    mostrar(entorno());
    await entrar();
    await darDeAlta('Ana', '4829');
    await screen.findByRole('rowheader', { name: 'Ana' });
    await darDeAlta('ana', '7391');
    expect(await screen.findByText('Ya hay alguien con ese nombre.')).toBeTruthy();
  });

  it('desactiva con confirmación y permite reactivar; nadie se borra', async () => {
    mostrar(entorno());
    await entrar();
    await darDeAlta('Ana', '4829');
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar Ana' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'No, dejarlo' }));
    expect(screen.getByText('Activo')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar Ana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, desactivar' }));
    await waitFor(() => {
      expect(screen.getByText('Desactivado')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Activar Ana' }));
    await waitFor(() => {
      expect(screen.getByText('Activo')).toBeTruthy();
    });
  });

  it('restablece el PIN validando el nuevo', async () => {
    const deps = entorno();
    mostrar(deps);
    await entrar();
    await darDeAlta('Ana', '4829');
    const antes = await deps.users.list();
    const hashAntes = antes.ok ? antes.value[0]?.pin.hash : undefined;

    fireEvent.click(await screen.findByRole('button', { name: 'Restablecer PIN Ana' }));
    fireEvent.change(screen.getByLabelText('PIN nuevo'), { target: { value: '1111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar PIN' }));
    expect(await screen.findByText('Ese PIN es muy fácil de adivinar.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('PIN nuevo'), { target: { value: '7391' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar PIN' }));
    expect(await screen.findByText('PIN restablecido.')).toBeTruthy();
    const despues = await deps.users.list();
    expect(despues.ok && despues.value[0]?.pin.hash).not.toBe(hashAntes);
  });

  it('si la configuración tarda en cargar, al enviar la pide y valida el PIN igual', async () => {
    let nunca = true;
    const tardia = () =>
      new Promise<UserPolicy | null>((resolver) => {
        // Responde solo a partir de la segunda vez que se la pide: la primera (al abrir) no termina.
        if (nunca) {
          nunca = false;
          return;
        }
        resolver(politica);
      });
    mostrar(entorno(), 'ADMIN', tardia);
    await entrar();
    await darDeAlta('Ana', '0000');
    expect(await screen.findByText('Ese PIN es muy fácil de adivinar.')).toBeTruthy();
    expect(screen.queryByText('No hay conexión con el servidor.')).toBeNull();
  });

  it('si la configuración no se puede leer, dice que no hay conexión', async () => {
    mostrar(entorno(), 'ADMIN', () => Promise.resolve(null));
    await entrar();
    await darDeAlta('Ana', '4829');
    expect(await screen.findByText('No hay conexión con el servidor.')).toBeTruthy();
  });

  it('una cuenta que no es de administrador no ve la pantalla', async () => {
    mostrar(entorno(), 'STAFF');
    await entrar();
    expect(await screen.findByText('Esta cuenta no es de administrador.')).toBeTruthy();
    expect(screen.queryByText('Dar de alta')).toBeNull();
  });
});
