import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { Layout } from './Layout';

function montar(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/catalogo']}>
      <Layout interruptores={new Set()}>
        <p>contenido de la sección</p>
      </Layout>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('ocultar la barra de navegación', () => {
  it('por omisión la barra está a la vista y el botón ofrece ocultarla', () => {
    const { container } = montar();
    const boton = screen.getByRole('button', { name: 'Ocultar menú' });
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(boton.getAttribute('aria-controls')).toBe('barra-lateral');
    expect(container.querySelector('.marco--sin-barra')).toBeNull();
    expect(container.querySelector('#barra-lateral')).not.toBeNull();
  });

  it('al ocultarla la sección ocupa toda la pantalla y el botón ofrece mostrarla', () => {
    const { container } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar menú' }));
    expect(container.querySelector('.marco--sin-barra')).not.toBeNull();
    const boton = screen.getByRole('button', { name: 'Mostrar menú' });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('contenido de la sección')).toBeTruthy();
    fireEvent.click(boton);
    expect(container.querySelector('.marco--sin-barra')).toBeNull();
  });

  it('se acuerda en esta tablet, aunque se cierre y se vuelva a abrir', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar menú' }));
    cleanup();
    const { container } = montar();
    expect(container.querySelector('.marco--sin-barra')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Mostrar menú' })).toBeTruthy();
  });

  it('si el navegador no deja guardar, sigue funcionando mientras está abierta', () => {
    const guardar = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sin almacenamiento');
    });
    try {
      const { container } = montar();
      fireEvent.click(screen.getByRole('button', { name: 'Ocultar menú' }));
      expect(container.querySelector('.marco--sin-barra')).not.toBeNull();
    } finally {
      guardar.mockRestore();
    }
  });
});
