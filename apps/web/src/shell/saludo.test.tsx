import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { Layout } from './Layout';
import { PanelDeInicio } from './Paginas';
import { saludoDeLaHora } from './saludo';

afterEach(cleanup);

describe('saludo según la hora de México', () => {
  it('cambia en la mañana, la tarde y la noche', () => {
    // México no tiene horario de verano: UTC-6 todo el año [RN-17].
    expect(saludoDeLaHora(new Date('2026-11-14T14:00:00.000Z'))).toBe('Buenos días'); // 08:00
    expect(saludoDeLaHora(new Date('2026-11-14T17:59:00.000Z'))).toBe('Buenos días'); // 11:59
    expect(saludoDeLaHora(new Date('2026-11-14T18:00:00.000Z'))).toBe('Buenas tardes'); // 12:00
    expect(saludoDeLaHora(new Date('2026-11-15T00:59:00.000Z'))).toBe('Buenas tardes'); // 18:59
    expect(saludoDeLaHora(new Date('2026-11-15T01:00:00.000Z'))).toBe('Buenas noches'); // 19:00
    expect(saludoDeLaHora(new Date('2026-11-14T09:00:00.000Z'))).toBe('Buenos días'); // 03:00
  });
});

describe('encabezado de bienvenida del inicio', () => {
  const tarde = (): Date => new Date('2026-11-14T20:00:00.000Z');

  it('saluda por el nombre de pila de quien usa la tablet', () => {
    render(
      <MemoryRouter>
        <PanelDeInicio interruptores={new Set()} nombre="Ana Pérez" ahora={tarde} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Buenas tardes, Ana')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Panel de inicio' })).toBeTruthy();
  });

  it('sin nadie dentro saluda sin nombre', () => {
    render(
      <MemoryRouter>
        <PanelDeInicio interruptores={new Set()} ahora={tarde} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Buenas tardes')).toBeTruthy();
  });
});

describe('pantallas de acceso', () => {
  it('no muestran la barra de secciones', () => {
    render(
      <MemoryRouter initialEntries={['/entrar']}>
        <Layout interruptores={new Set()}>
          <p>pantalla de entrada</p>
        </Layout>
      </MemoryRouter>,
    );
    expect(screen.getByText('pantalla de entrada')).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByText('Cotiza, cobra y entrega, con o sin internet.')).toBeTruthy();
  });

  it('el resto de las pantallas sí llevan la barra', () => {
    render(
      <MemoryRouter initialEntries={['/catalogo']}>
        <Layout interruptores={new Set()}>
          <p>catálogo</p>
        </Layout>
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('navigation').length).toBeGreaterThan(0);
  });
});
