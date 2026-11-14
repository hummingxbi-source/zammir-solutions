import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { inicialesDe } from '../shared/ui/Inicial';
import { Layout } from './Layout';
import { CuentaAdmin } from './CuentaAdmin';
import { dondeEstaba, recordarDondeEstaba } from './donde-estaba';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe('dónde estaba la persona', () => {
  it('sin nada guardado vuelve al inicio', () => {
    expect(dondeEstaba()).toBe('/');
  });

  it('devuelve la sección que se recordó y la olvida al volver al inicio', () => {
    recordarDondeEstaba('/cotizador');
    expect(dondeEstaba()).toBe('/cotizador');
    recordarDondeEstaba(null);
    expect(dondeEstaba()).toBe('/');
  });

  it('no acepta direcciones que salgan de la aplicación', () => {
    sessionStorage.setItem('zammir-donde-estaba', '//otro-sitio.example');
    expect(dondeEstaba()).toBe('/');
    sessionStorage.setItem('zammir-donde-estaba', 'https://otro-sitio.example');
    expect(dondeEstaba()).toBe('/');
  });
});

describe('iniciales de una persona', () => {
  it('toma la primera letra de las dos primeras palabras', () => {
    expect(inicialesDe('Ana Pérez')).toBe('AP');
    expect(inicialesDe('  luis   Ángel  Ríos ')).toBe('LÁ');
    expect(inicialesDe('Marta')).toBe('M');
    expect(inicialesDe('')).toBe('?');
  });
});

describe('navegación y cuenta', () => {
  it('el panel de inicio tiene su propio enlace, fuera de la lista del flujo de trabajo', () => {
    render(
      <MemoryRouter initialEntries={['/catalogo']}>
        <Layout interruptores={new Set()}>
          <p>contenido</p>
        </Layout>
      </MemoryRouter>,
    );
    const inicio = screen.getByRole('link', { name: 'Panel de inicio' });
    expect(inicio.getAttribute('href')).toBe('/');
    expect(inicio.closest('nav')).toBeNull();
  });

  it('sin sesión de administrador ofrece entrar, desde cualquier pantalla', () => {
    render(
      <MemoryRouter>
        <CuentaAdmin />
      </MemoryRouter>,
    );
    const entrar = screen.getByRole('link', { name: 'Entrar como administrador' });
    expect(entrar.getAttribute('href')).toBe('/administrador');
  });
});
