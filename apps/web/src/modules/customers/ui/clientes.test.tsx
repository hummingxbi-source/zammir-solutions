import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  fixedClock,
  inMemoryAdminAuth,
  inMemoryAuditLog,
  inMemoryLegal,
  sequentialIdGenerator,
  type ManageCustomersDeps,
} from '@zammir/core';
import { clientesEnMemoriaDePrueba } from '@zammir/core/testing';
import { describe, expect, it } from 'vitest';

import { App } from '../../../App';
import { ProveedorSesionAdmin } from '../../identity/ui/SesionAdmin';

const instante = new Date('2026-10-30T18:00:00.000Z');

function entorno(): ManageCustomersDeps {
  return {
    customers: clientesEnMemoriaDePrueba().customers,
    idGenerator: sequentialIdGenerator('c'),
  };
}

function mostrar(deps: ManageCustomersDeps, rol: 'ADMIN' | 'STAFF' = 'ADMIN'): void {
  const auth = inMemoryAdminAuth([
    { userId: 'a-1', email: 'a@ejemplo.invalid', password: 'clave-de-prueba-1', role: rol },
  ]);
  render(
    <ProveedorSesionAdmin
      auth={auth}
      clock={fixedClock(instante)}
      cargarLimiteInactividad={() => Promise.resolve(null)}
    >
      <MemoryRouter initialEntries={['/clientes']}>
        <App clientes={deps} />
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

async function capturar(nombre: string, telefono: string): Promise<void> {
  fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: nombre } });
  fireEvent.change(screen.getByLabelText('WhatsApp o teléfono (10 dígitos)'), {
    target: { value: telefono },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));
}

describe('pantalla de clientes', () => {
  it('sin clientes, el estado vacío dice qué hacer', async () => {
    mostrar(entorno());
    await entrar();
    expect(await screen.findByText(/Todavía no hay clientes/)).toBeTruthy();
    expect(screen.getByText(/toca "Guardar cliente"/)).toBeTruthy();
  });

  it('guarda a un cliente con solo nombre y WhatsApp y lo lista con el teléfono normalizado', async () => {
    mostrar(entorno());
    await entrar();
    await capturar('Ana López', '55 1234 5678');
    const fila = (await screen.findByRole('rowheader', { name: 'Ana López' })).closest('tr');
    expect(fila).not.toBeNull();
    if (fila === null) return;
    expect(within(fila).getByText('5512345678')).toBeTruthy();
    expect(within(fila).getByText('Sin correo')).toBeTruthy();
    expect(screen.getByText('Cliente guardado.')).toBeTruthy();
  });

  it.each([
    ['', '5512345678', 'Falta el nombre.'],
    ['Ana', '', 'El WhatsApp no es válido.'],
    ['Ana', '551234567', 'El WhatsApp no es válido.'],
  ])('no guarda con nombre "%s" y teléfono "%s"', async (nombre, telefono, mensaje) => {
    mostrar(entorno());
    await entrar();
    await capturar(nombre, telefono);
    expect(await screen.findByText(mensaje)).toBeTruthy();
    expect(screen.queryByRole('rowheader', { name: 'Ana' })).toBeNull();
  });

  it('un RFC o código postal fiscal mal escritos se rechazan con qué hacer, y vacíos se aceptan', async () => {
    const deps = entorno();
    mostrar(deps);
    await entrar();
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('WhatsApp o teléfono (10 dígitos)'), {
      target: { value: '5512345678' },
    });
    fireEvent.change(screen.getByLabelText('RFC'), { target: { value: 'ABC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));
    expect(await screen.findByText('El RFC no es válido.')).toBeTruthy();
    expect(screen.getByText('Debe tener 12 o 13 caracteres, o déjalo vacío.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('RFC'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Código postal fiscal (5 dígitos)'), {
      target: { value: '556' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));
    expect(await screen.findByText('El código postal fiscal no es válido.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Código postal fiscal (5 dígitos)'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));
    expect(await screen.findByText('Cliente guardado.')).toBeTruthy();
  });

  it('guarda los datos fiscales cuando son válidos', async () => {
    const deps = entorno();
    mostrar(deps);
    await entrar();
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('WhatsApp o teléfono (10 dígitos)'), {
      target: { value: '5512345678' },
    });
    fireEvent.change(screen.getByLabelText('RFC'), { target: { value: 'xaxx010101000' } });
    fireEvent.change(screen.getByLabelText('Código postal fiscal (5 dígitos)'), {
      target: { value: '55600' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));
    await screen.findByText('Cliente guardado.');
    const lista = await deps.customers.list();
    expect(lista.ok && lista.value[0]?.fiscal).toMatchObject({
      rfc: 'XAXX010101000',
      fiscalZip: '55600',
    });
  });

  it('avisa si el teléfono ya está registrado, escrito en otro formato, y deja guardar de todos modos', async () => {
    const deps = entorno();
    mostrar(deps);
    await entrar();
    await capturar('Ana López', '5512345678');
    await screen.findByRole('rowheader', { name: 'Ana López' });

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana (esposo)' } });
    fireEvent.change(screen.getByLabelText('WhatsApp o teléfono (10 dígitos)'), {
      target: { value: '+52 55 1234-5678' },
    });
    expect(await screen.findByText(/Ya hay un cliente con este teléfono: Ana López/)).toBeTruthy();
    expect(screen.getByText(/guarda de todos modos/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));
    expect(await screen.findByRole('rowheader', { name: 'Ana (esposo)' })).toBeTruthy();
  });

  it('no avisa cuando el teléfono todavía está incompleto o nadie lo tiene', async () => {
    mostrar(entorno());
    await entrar();
    await capturar('Ana López', '5512345678');
    await screen.findByRole('rowheader', { name: 'Ana López' });
    fireEvent.change(screen.getByLabelText('WhatsApp o teléfono (10 dígitos)'), {
      target: { value: '55123' },
    });
    fireEvent.change(screen.getByLabelText('WhatsApp o teléfono (10 dígitos)'), {
      target: { value: '5500000000' },
    });
    expect(screen.queryByText(/Ya hay un cliente con este teléfono/)).toBeNull();
  });

  it('busca por nombre parcial sin acentos y por teléfono, y dice cuando no hay resultados', async () => {
    mostrar(entorno());
    await entrar();
    await capturar('Ana López', '5512345678');
    await screen.findByRole('rowheader', { name: 'Ana López' });
    await capturar('Juan Pérez', '5598765432');
    await screen.findByRole('rowheader', { name: 'Juan Pérez' });

    const buscador = screen.getByLabelText('Buscar cliente por nombre, teléfono o correo');
    fireEvent.change(buscador, { target: { value: 'perez' } });
    expect(screen.queryByRole('rowheader', { name: 'Ana López' })).toBeNull();
    expect(screen.getByRole('rowheader', { name: 'Juan Pérez' })).toBeTruthy();

    fireEvent.change(buscador, { target: { value: '55 1234' } });
    expect(screen.getByRole('rowheader', { name: 'Ana López' })).toBeTruthy();
    expect(screen.queryByRole('rowheader', { name: 'Juan Pérez' })).toBeNull();

    fireEvent.change(buscador, { target: { value: 'zzzz' } });
    expect(screen.getByText('Ningún cliente coincide con la búsqueda.')).toBeTruthy();
  });

  it('anonimiza con confirmación: se vacían los datos personales y la fila se conserva', async () => {
    mostrar(entorno());
    await entrar();
    await capturar('Ana López', '5512345678');
    fireEvent.click(await screen.findByRole('button', { name: 'Anonimizar Ana López' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'No, dejarlo' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('rowheader', { name: 'Ana López' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Anonimizar Ana López' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, anonimizar' }));
    expect(await screen.findByText('Cliente anonimizado.')).toBeTruthy();
    expect(screen.queryByRole('rowheader', { name: 'Ana López' })).toBeNull();
    expect(screen.getByRole('rowheader', { name: /Cliente anonimizado/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Anonimizar/ })).toBeNull();
  });

  it('muestra el aviso de privacidad vigente y guarda su versión en el cliente nuevo', async () => {
    const clock = fixedClock(instante);
    const legal = inMemoryLegal({
      clock,
      idGenerator: sequentialIdGenerator('l'),
      auditLog: inMemoryAuditLog(),
    });
    await legal.publish({ type: 'PRIVACY_NOTICE', body: 'Texto uno', effectiveFrom: new Date(0) });
    await legal.publish({
      type: 'PRIVACY_NOTICE',
      body: 'Texto del aviso vigente',
      effectiveFrom: new Date(0),
    });
    const deps = { ...entorno(), privacy: { legal, clock } };
    mostrar(deps);
    await entrar();
    expect(
      await screen.findByText(/Aviso de privacidad que se le informa \(versión 2\)/),
    ).toBeTruthy();
    expect(screen.getByText('Texto del aviso vigente')).toBeTruthy();

    await capturar('Ana López', '5512345678');
    await screen.findByRole('rowheader', { name: 'Ana López' });
    const lista = await deps.customers.list();
    expect(lista.ok && lista.value[0]?.privacyNoticeVersion).toBe(2);
  });

  it('una cuenta que no es de administrador no ve la pantalla', async () => {
    mostrar(entorno(), 'STAFF');
    await entrar();
    expect(await screen.findByText('Esta cuenta no es de administrador.')).toBeTruthy();
    expect(screen.queryByText('Guardar cliente')).toBeNull();
  });
});
