import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  buildCustomerHistory,
  createCustomer,
  fixedClock,
  inMemoryAdminAuth,
  sequentialIdGenerator,
  type CounterSale,
  type Customer,
  type CustomerHistory,
  type ManageCustomersDeps,
  type Payment,
  type Quote,
  type Warranty,
  type WorkOrder,
} from '@zammir/core';
import { clientesEnMemoriaDePrueba } from '@zammir/core/testing';
import { describe, expect, it } from 'vitest';

import { App } from '../../../App';
import { ProveedorSesionAdmin } from '../../identity/ui/SesionAdmin';
import { FichaDelCliente } from './FichaDelCliente';

const cliente = { id: 'c-ana', name: 'Ana López' } as unknown as Customer;

const orden = (id: string, estado: WorkOrder['status'], total: number) =>
  ({
    id,
    customerId: 'c-ana',
    status: estado,
    totalCents: total,
    folio: `OT-2026-000${id}`,
    tempFolio: `T1-000${id}`,
    issuedAt: `2026-10-0${id}T10:00:00.000Z`,
  }) as unknown as WorkOrder;

function historial(): CustomerHistory {
  return buildCustomerHistory('c-ana' as never, {
    quotes: [
      {
        id: 'q1',
        customerId: 'c-ana',
        status: 'ACCEPTED',
        folio: 'COT-2026-0001',
        tempFolio: 'T1-0001',
        updatedAt: '2026-09-01T10:00:00.000Z',
      } as unknown as Quote,
    ],
    orders: [orden('1', 'DELIVERED', 20_000), orden('2', 'DELIVERED', 30_000)],
    sales: [
      {
        id: 'v1',
        customerId: 'c-ana',
        status: 'CANCELLED',
        folio: null,
        tempFolio: 'T1-0007',
        totalCents: 4_000,
        issuedAt: '2026-10-05T18:00:00.000Z',
      } as unknown as CounterSale,
    ],
    payments: [
      {
        id: 'p1',
        targetType: 'WORK_ORDER',
        targetId: '1',
        kind: 'DEPOSIT',
        method: 'CASH',
        amountCents: 10_000,
        paidAt: '2026-10-02T18:00:00.000Z',
      } as unknown as Payment,
    ],
    warranties: [
      { workOrderId: '1', startsOn: '2026-10-03', durationMonths: 12 } as unknown as Warranty,
    ],
  });
}

describe('Ficha del cliente', () => {
  it('muestra sus cotizaciones, órdenes, ventas, pagos y garantías, y que es recurrente', async () => {
    render(
      <FichaDelCliente
        cliente={cliente}
        cargar={() => Promise.resolve(historial())}
        onCerrar={() => undefined}
      />,
    );
    expect(await screen.findByText(/Cliente recurrente/)).toBeTruthy();
    expect(screen.getByText('Órdenes entregadas').nextElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Lo que ha comprado').nextElementSibling?.textContent).toBe('$500.00');
    expect(screen.getByText(/COT-2026-0001 · Aceptada/)).toBeTruthy();
    expect(screen.getByText(/OT-2026-0001 · Entregada · \$200\.00/)).toBeTruthy();
    expect(screen.getByText(/T1-0007 · 05\/10\/2026 · \$40\.00 · cancelada/)).toBeTruthy();
    expect(screen.getByText(/02\/10\/2026 · Anticipo · Efectivo · \$100\.00/)).toBeTruthy();
    expect(screen.getByText(/Desde 2026-10-03 · 12 meses/)).toBeTruthy();
  });

  it('un cliente sin nada lo dice y no es recurrente', async () => {
    render(
      <FichaDelCliente
        cliente={cliente}
        cargar={() =>
          Promise.resolve(
            buildCustomerHistory('c-ana' as never, {
              quotes: [],
              orders: [],
              sales: [],
              payments: [],
              warranties: [],
            }),
          )
        }
        onCerrar={() => undefined}
      />,
    );
    expect(await screen.findAllByText('Todavía no hay nada.')).toHaveLength(5);
    expect(screen.queryByText(/Cliente recurrente/)).toBeNull();
  });

  it('se abre desde la lista de clientes y se cierra', async () => {
    const deps: ManageCustomersDeps = {
      customers: clientesEnMemoriaDePrueba().customers,
      idGenerator: sequentialIdGenerator('c'),
    };
    await createCustomer(
      deps,
      { role: 'ADMIN' },
      {
        name: 'Ana López',
        phone: '5512345678',
        email: '',
        notes: '',
        fiscal: { rfc: '', legalName: '', fiscalZip: '', regime: '', cfdiUse: '' },
        privacyNoticeVersion: null,
      },
    );
    const auth = inMemoryAdminAuth([
      { userId: 'a-1', email: 'a@ejemplo.invalid', password: 'clave-de-prueba-1', role: 'ADMIN' },
    ]);
    render(
      <ProveedorSesionAdmin
        auth={auth}
        clock={fixedClock(new Date('2026-10-30T18:00:00.000Z'))}
        cargarLimiteInactividad={() => Promise.resolve(null)}
      >
        <MemoryRouter initialEntries={['/clientes']}>
          <App clientes={deps} historialDeCliente={() => Promise.resolve(historial())} />
        </MemoryRouter>
      </ProveedorSesionAdmin>,
    );
    fireEvent.change(await screen.findByLabelText('Correo'), {
      target: { value: 'a@ejemplo.invalid' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'clave-de-prueba-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver historial Ana López' }));
    const ficha = await screen.findByRole('region', { name: 'Historial de Ana López' });
    expect(await within(ficha).findByText(/Cliente recurrente/)).toBeTruthy();
    fireEvent.click(within(ficha).getByRole('button', { name: 'Cerrar historial' }));
    expect(screen.queryByRole('region', { name: 'Historial de Ana López' })).toBeNull();
  });
});
