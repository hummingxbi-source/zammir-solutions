import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  fixedClock,
  inMemoryAdminAuth,
  inMemoryAuditLog,
  inMemoryLegal,
  sequentialIdGenerator,
  type LegalDeps,
} from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { App } from '../../../App';
import { ProveedorSesionAdmin } from '../../identity/ui/SesionAdmin';

const instante = new Date('2026-10-30T18:00:00.000Z');

function entorno(): LegalDeps {
  const clock = fixedClock(instante);
  return {
    clock,
    legal: inMemoryLegal({
      clock,
      idGenerator: sequentialIdGenerator('l'),
      auditLog: inMemoryAuditLog(),
    }),
  };
}

function mostrar(deps: LegalDeps, rol: 'ADMIN' | 'STAFF' = 'ADMIN'): void {
  const auth = inMemoryAdminAuth([
    { userId: 'a-1', email: 'a@ejemplo.invalid', password: 'clave-de-prueba-1', role: rol },
  ]);
  render(
    <ProveedorSesionAdmin
      auth={auth}
      clock={fixedClock(instante)}
      cargarLimiteInactividad={() => Promise.resolve(null)}
    >
      <MemoryRouter initialEntries={['/configuracion']}>
        <App legal={deps} />
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

describe('pantalla del aviso de privacidad', () => {
  it('sin aviso publicado dice cómo publicar el primero', async () => {
    mostrar(entorno());
    await entrar();
    expect(await screen.findByText(/Todavía no hay aviso de privacidad publicado/)).toBeTruthy();
  });

  it('publica una versión y la muestra como vigente', async () => {
    mostrar(entorno());
    await entrar();
    fireEvent.change(await screen.findByLabelText('Texto del aviso'), {
      target: { value: 'Primer texto del aviso' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar versión nueva' }));
    expect(await screen.findByText('Versión publicada.')).toBeTruthy();
    expect(screen.getByText(/Versión vigente: Versión 1/)).toBeTruthy();
    expect(screen.getByText('Primer texto del aviso')).toBeTruthy();
  });

  it('editar publica otra versión y conserva la anterior en el historial', async () => {
    const deps = entorno();
    mostrar(deps);
    await entrar();
    for (const texto of ['Texto uno', 'Texto dos']) {
      fireEvent.change(await screen.findByLabelText('Texto del aviso'), {
        target: { value: texto },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Publicar versión nueva' }));
      await screen.findByText('Versión publicada.');
    }
    expect(screen.getByText(/Versión vigente: Versión 2/)).toBeTruthy();
    expect(screen.getByText('Texto dos')).toBeTruthy();
    expect(screen.getByText('Versiones anteriores')).toBeTruthy();
    const lista = await deps.legal.list('PRIVACY_NOTICE');
    expect(lista.ok && lista.value.map((v) => v.body)).toEqual(['Texto uno', 'Texto dos']);
  });

  it('un texto en blanco no se publica y dice qué hacer', async () => {
    mostrar(entorno());
    await entrar();
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar versión nueva' }));
    expect(await screen.findByText('Falta el texto del aviso.')).toBeTruthy();
    expect(screen.getByText('Escríbelo antes de publicar.')).toBeTruthy();
  });

  it('avisa cuando el texto vigente todavía es un borrador', async () => {
    const deps = entorno();
    await deps.legal.publish({
      type: 'PRIVACY_NOTICE',
      body: 'BORRADOR — pendiente de revisión',
      effectiveFrom: new Date(0),
    });
    mostrar(deps);
    await entrar();
    expect(await screen.findByText(/falta que lo revise el asesor de ZAMMIR/)).toBeTruthy();
  });

  it('una cuenta que no es de administrador no ve la pantalla', async () => {
    mostrar(entorno(), 'STAFF');
    await entrar();
    expect(await screen.findByText('Esta cuenta no es de administrador.')).toBeTruthy();
    expect(screen.queryByText('Publicar versión nueva')).toBeNull();
  });
});
