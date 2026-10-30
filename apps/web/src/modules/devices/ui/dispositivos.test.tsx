import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  fixedClock,
  inMemoryAdminAuth,
  inMemoryAuditLog,
  inMemoryDeviceRepository,
  sequentialIdGenerator,
  type DeviceRepository,
} from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { App } from '../../../App';
import { ProveedorSesionAdmin } from '../../identity/ui/SesionAdmin';

const instante = new Date('2026-10-29T18:00:00.000Z');

function repositorioConUnaTablet(): DeviceRepository {
  const repo = inMemoryDeviceRepository({
    clock: fixedClock(instante),
    idGenerator: sequentialIdGenerator('d'),
    auditLog: inMemoryAuditLog(),
  });
  return repo;
}

async function conTablet(repo: DeviceRepository): Promise<void> {
  const codigo = await repo.issueCode(15);
  if (!codigo.ok) throw new Error('no se pudo emitir');
  await repo.redeemCode({
    code: codigo.value.code,
    name: 'Tablet del mostrador',
    authUserId: 'c-1',
  });
}

function mostrar(
  repo: DeviceRepository,
  rol: 'ADMIN' | 'STAFF' = 'ADMIN',
  vigencia?: () => Promise<number | null>,
): void {
  const auth = inMemoryAdminAuth([
    { userId: 'u-1', email: 'a@ejemplo.invalid', password: 'clave-de-prueba-1', role: rol },
  ]);
  render(
    <ProveedorSesionAdmin
      auth={auth}
      clock={fixedClock(instante)}
      cargarLimiteInactividad={() => Promise.resolve(null)}
    >
      <MemoryRouter initialEntries={['/usuarios']}>
        <App dispositivos={repo} cargarVigenciaDeCodigo={vigencia} />
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

describe('pantalla de tablets', () => {
  it('sin tablets dice cómo registrar la primera', async () => {
    mostrar(repositorioConUnaTablet());
    await entrar();
    expect(await screen.findByText(/Todavía no hay tablets registradas/)).toBeTruthy();
  });

  it('lista las tablets con su estado', async () => {
    const repo = repositorioConUnaTablet();
    await conTablet(repo);
    mostrar(repo);
    await entrar();
    const fila = (await screen.findByRole('rowheader', { name: 'Tablet del mostrador' })).closest(
      'tr',
    );
    expect(fila).not.toBeNull();
    if (fila === null) return;
    expect(within(fila).getByText('Activa')).toBeTruthy();
    expect(within(fila).getByText('Aún no ha enviado')).toBeTruthy();
  });

  it('sugiere la vigencia de los ajustes y se puede cambiar', async () => {
    mostrar(repositorioConUnaTablet(), 'ADMIN', () => Promise.resolve(15));
    await entrar();
    const campo = await screen.findByLabelText<HTMLInputElement>('Minutos que sirve el código');
    await waitFor(() => {
      expect(campo.value).toBe('15');
    });
    fireEvent.change(campo, { target: { value: '5' } });
    expect(campo.value).toBe('5');
  });

  it('genera un código con los minutos que se escriben y lo muestra', async () => {
    mostrar(repositorioConUnaTablet());
    await entrar();
    fireEvent.change(await screen.findByLabelText('Minutos que sirve el código'), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generar código' }));
    expect(await screen.findByText('CODIGO001')).toBeTruthy();
    expect(screen.getByText(/Sirve una sola vez/)).toBeTruthy();
  });

  it.each(['', '0', 'abc', '1.5'])('rechaza "%s" minutos y dice qué hacer', async (valor) => {
    mostrar(repositorioConUnaTablet());
    await entrar();
    fireEvent.change(await screen.findByLabelText('Minutos que sirve el código'), {
      target: { value: valor },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generar código' }));
    expect(await screen.findByText('Escribe un número entero mayor que cero.')).toBeTruthy();
  });

  it('pide confirmación antes de revocar y no revoca si se cancela', async () => {
    const repo = repositorioConUnaTablet();
    await conTablet(repo);
    mostrar(repo);
    await entrar();
    fireEvent.click(await screen.findByRole('button', { name: 'Revocar Tablet del mostrador' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'No, dejarla' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('Activa')).toBeTruthy();
  });

  it('al confirmar revoca la tablet y ya no ofrece revocarla', async () => {
    const repo = repositorioConUnaTablet();
    await conTablet(repo);
    mostrar(repo);
    await entrar();
    fireEvent.click(await screen.findByRole('button', { name: 'Revocar Tablet del mostrador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, revocar' }));
    await waitFor(() => {
      expect(screen.getByText('Revocada')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /Revocar Tablet/ })).toBeNull();
  });

  it('una cuenta que no es de administrador no ve la pantalla', async () => {
    mostrar(repositorioConUnaTablet(), 'STAFF');
    await entrar();
    expect(await screen.findByText('Esta cuenta no es de administrador.')).toBeTruthy();
    expect(screen.queryByText('Generar código')).toBeNull();
  });
});
