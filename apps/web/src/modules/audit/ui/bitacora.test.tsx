import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  asId,
  fixedClock,
  inMemoryAdminAuth,
  inMemoryAuditLog,
  type AuditEntry,
  type InMemoryAuditLog,
} from '@zammir/core';
import { entradaDePrueba } from '@zammir/core/testing';
import { describe, expect, it } from 'vitest';

import { App } from '../../../App';
import { ProveedorSesionAdmin } from '../../identity/ui/SesionAdmin';
import { describirValor } from './Bitacora';

const instante = new Date('2026-10-30T18:00:00.000Z');
const ana = asId<'User'>('00000000-0000-4000-8000-0000000000a1');

async function guardar(log: InMemoryAuditLog, n: number, cambios: Partial<AuditEntry> = {}) {
  await log.append(
    entradaDePrueba(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, {
      occurredAt: new Date(Date.UTC(2026, 9, 30, 12, n)),
      ...cambios,
    }),
  );
}

function mostrar(log: InMemoryAuditLog, rol: 'ADMIN' | 'STAFF' = 'ADMIN'): void {
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
        <App
          bitacora={{
            reader: log,
            cargarNombres: () => Promise.resolve(new Map([[ana, 'Ana López']])),
          }}
        />
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

/** Lo que hay dentro de la tabla de movimientos (el texto de una acción también sale en el filtro). */
async function tabla() {
  return within(await screen.findByRole('table'));
}

describe('describirValor', () => {
  it.each([
    [null, '—'],
    [{ nombre: 'Tablet', estado: 'activo' }, 'Nombre: Tablet; Estado: activo'],
    [{ precio_centavos: 31_500 }, 'Precio: $315.00'],
    [{ activo: false }, 'Activo: no'],
    [{ clave_nueva: 1 }, 'clave_nueva: 1'],
    ['texto', 'texto'],
  ] as const)('%j → %s', (valor, esperado) => {
    expect(describirValor(valor)).toBe(esperado);
  });
});

describe('pantalla de bitácora', () => {
  it('sin movimientos dice que no hay', async () => {
    mostrar(inMemoryAuditLog());
    await entrar();
    expect(await screen.findByText('No hay movimientos con esos filtros.')).toBeTruthy();
  });

  it('muestra persona, tablet, fecha en hora de México, acción y valores anterior y nuevo', async () => {
    const log = inMemoryAuditLog();
    await guardar(log, 1, {
      userId: ana,
      deviceId: asId<'Device'>('00000000-0000-4000-8000-0000000000d1'),
      action: 'PRODUCT_PRICE_CHANGED',
      oldValue: { precio_centavos: 28_000 },
      newValue: { precio_centavos: 31_500 },
      occurredAt: new Date('2026-10-30T19:45:00.000Z'),
    });
    mostrar(log);
    await entrar();
    const celdas = await tabla();
    const fila = (await celdas.findByText('Cambió un precio')).closest('tr');
    if (fila === null) throw new Error('fila');
    expect(within(fila).getByText('30 oct 2026, 13:45')).toBeTruthy();
    expect(within(fila).getByText('Ana López')).toBeTruthy();
    expect(within(fila).getByText('00000000…')).toBeTruthy();
    expect(within(fila).getByText('Precio: $280.00')).toBeTruthy();
    expect(within(fila).getByText('Precio: $315.00')).toBeTruthy();
  });

  it('las acciones del sistema, sin persona, se marcan como Sistema', async () => {
    const log = inMemoryAuditLog();
    await guardar(log, 1, { userId: null, deviceId: null, action: 'DEVICES_LISTED' });
    mostrar(log);
    await entrar();
    expect(await (await tabla()).findByText('Sistema')).toBeTruthy();
  });

  it('filtra por acción', async () => {
    const log = inMemoryAuditLog();
    await guardar(log, 1, { action: 'DEVICE_REGISTERED' });
    await guardar(log, 2, { action: 'DEVICE_REVOKED' });
    mostrar(log);
    await entrar();
    await (await tabla()).findByText('Registró una tablet');
    fireEvent.change(screen.getByLabelText('Acción'), { target: { value: 'DEVICE_REVOKED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(async () => {
      expect((await tabla()).queryByText('Registró una tablet')).toBeNull();
    });
    expect((await tabla()).getByText('Revocó una tablet')).toBeTruthy();
  });

  it('filtra por fechas del día de México (el día final se incluye)', async () => {
    const log = inMemoryAuditLog();
    await guardar(log, 1, {
      action: 'DEVICE_REGISTERED',
      occurredAt: new Date('2026-10-28T20:00:00.000Z'),
    });
    await guardar(log, 2, {
      action: 'DEVICE_REVOKED',
      occurredAt: new Date('2026-10-29T20:00:00.000Z'),
    });
    await guardar(log, 3, {
      action: 'DEVICES_LISTED',
      occurredAt: new Date('2026-10-30T20:00:00.000Z'),
    });
    mostrar(log);
    await entrar();
    await (await tabla()).findByText('Consultó la lista de tablets');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-29' } });
    fireEvent.change(screen.getByLabelText('Hasta (incluido)'), {
      target: { value: '2026-10-29' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(async () => {
      expect((await tabla()).queryByText('Consultó la lista de tablets')).toBeNull();
    });
    const celdas = await tabla();
    expect(celdas.getByText('Revocó una tablet')).toBeTruthy();
    expect(celdas.queryByText('Registró una tablet')).toBeNull();
  });

  it('carga más cuando hay más de una página', async () => {
    const log = inMemoryAuditLog();
    for (let i = 1; i <= 30; i += 1) {
      await guardar(log, i, { action: 'DEVICES_LISTED' });
    }
    mostrar(log);
    await entrar();
    await (await tabla()).findAllByText('Consultó la lista de tablets');
    expect((await tabla()).getAllByText('Consultó la lista de tablets')).toHaveLength(25);
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
    await waitFor(async () => {
      expect((await tabla()).getAllByText('Consultó la lista de tablets')).toHaveLength(30);
    });
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('muestra quién autorizó una acción', async () => {
    const log = inMemoryAuditLog();
    await guardar(log, 1, { action: 'PRODUCT_PRICE_CHANGED', authorizedBy: ana });
    mostrar(log);
    await entrar();
    const fila = (await (await tabla()).findByText('Cambió un precio')).closest('tr');
    if (fila === null) throw new Error('fila');
    expect(within(fila).getByText('Ana López')).toBeTruthy();
  });

  it('una cuenta que no es de administrador no tiene acceso', async () => {
    mostrar(inMemoryAuditLog(), 'STAFF');
    await entrar();
    expect(await screen.findByText('Esta cuenta no es de administrador.')).toBeTruthy();
    expect(screen.queryByText('Cargar más')).toBeNull();
  });
});
