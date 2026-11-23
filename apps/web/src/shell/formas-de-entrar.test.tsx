import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { FormasDeEntrar } from './FormasDeEntrar';

function mostrar(props: { conectar: boolean; entrar: boolean; tabletConectada: boolean }) {
  return render(
    <MemoryRouter>
      <FormasDeEntrar {...props} />
    </MemoryRouter>,
  );
}

describe('¿Cómo se entra? en el inicio', () => {
  it('explica las tres llaves con su momento y su botón', () => {
    mostrar({ conectar: true, entrar: true, tabletConectada: false });
    expect(screen.getByRole('heading', { name: '¿Cómo se entra?' })).toBeTruthy();
    expect(screen.getByText('Una sola vez por tablet')).toBeTruthy();
    expect(screen.getByText('Todos los días')).toBeTruthy();
    expect(screen.getByText('Para configurar')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Conectar esta tablet' }).getAttribute('href')).toBe(
      '/conectar',
    );
    expect(screen.getByRole('link', { name: 'Entrar con PIN' }).getAttribute('href')).toBe(
      '/entrar',
    );
    expect(
      screen.getByRole('link', { name: 'Entrar como administrador' }).getAttribute('href'),
    ).toBe('/administrador');
  });

  it('la tablet ya conectada se muestra cumplida, sin botón', () => {
    mostrar({ conectar: false, entrar: true, tabletConectada: true });
    expect(screen.getByText('Esta tablet ya está conectada.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Conectar esta tablet' })).toBeNull();
  });

  it('trae el orden de la configuración inicial', () => {
    mostrar({ conectar: true, entrar: true, tabletConectada: false });
    const pasos = within(screen.getByRole('group')).getAllByRole('listitem');
    expect(pasos.length).toBe(6);
    expect(pasos[0]?.textContent).toMatch(/Entra como administrador/);
    expect(pasos[4]?.textContent).toMatch(/Conectar esta tablet/);
  });

  it('cuando ya no falta nada, no aparece', () => {
    const { container } = mostrar({ conectar: false, entrar: false, tabletConectada: true });
    expect(container.textContent).toBe('');
  });
});
