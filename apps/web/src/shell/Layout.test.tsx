import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ActiveUserSession } from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { fechaLarga, Layout } from './Layout';

type Estado = { kind: 'ACTIVE'; user: { name: string } } | { kind: 'LOCKED' };

function sesionFalsa(inicial: Estado) {
  let estado = inicial;
  const oyentes = new Set<() => void>();
  const sesion = {
    state: () => estado,
    subscribe: (aviso: () => void) => {
      oyentes.add(aviso);
      return () => oyentes.delete(aviso);
    },
  } as unknown as ActiveUserSession;
  return {
    sesion,
    cambiar: (nuevo: Estado) => {
      estado = nuevo;
      oyentes.forEach((o) => {
        o();
      });
    },
  };
}

// 4 nov 2026 05:30 UTC = martes 3 de noviembre, 23:30 en México.
const AHORA = () => new Date('2026-11-04T05:30:00.000Z');

function montar(session?: ActiveUserSession) {
  return render(
    <MemoryRouter>
      <Layout interruptores={new Set()} session={session} ahora={AHORA}>
        <p>contenido</p>
      </Layout>
    </MemoryRouter>,
  );
}

describe('encabezado del marco', () => {
  it('la fecha larga es la de México, no la de UTC', () => {
    expect(fechaLarga(AHORA())).toBe('martes, 3 de noviembre de 2026');
    expect(fechaLarga(new Date('2026-11-04T06:30:00.000Z'))).toBe(
      'miércoles, 4 de noviembre de 2026',
    );
  });

  it('muestra la fecha fuera del contenido principal', () => {
    montar();
    expect(screen.getByText('martes, 3 de noviembre de 2026')).toBeTruthy();
    const main = screen.getByRole('main');
    expect(within(main).queryByText(/noviembre/)).toBeNull();
    expect(within(main).getByText('contenido')).toBeTruthy();
  });

  it('sin una persona que haya entrado con su PIN no saluda', () => {
    montar();
    expect(screen.queryByText(/^Hola,/)).toBeNull();
  });

  it('saluda con el primer nombre de quien entró, y deja de saludar al bloquearse', () => {
    const { sesion, cambiar } = sesionFalsa({ kind: 'ACTIVE', user: { name: 'Ana López Ruiz' } });
    montar(sesion);
    expect(screen.getByText('Hola, Ana.')).toBeTruthy();
    act(() => {
      cambiar({ kind: 'ACTIVE', user: { name: 'Beto' } });
    });
    expect(screen.getByText('Hola, Beto.')).toBeTruthy();
    act(() => {
      cambiar({ kind: 'LOCKED' });
    });
    expect(screen.queryByText(/^Hola,/)).toBeNull();
  });

  it('una sesión bloqueada desde el inicio tampoco saluda', () => {
    const { sesion } = sesionFalsa({ kind: 'LOCKED' });
    montar(sesion);
    expect(screen.queryByText(/^Hola,/)).toBeNull();
  });
});

describe('barra lateral', () => {
  it('agrupa el flujo de trabajo y la administración, con íconos que no se leen', () => {
    const { container } = montar();
    const principal = screen.getByRole('navigation', { name: 'Secciones del trabajo' });
    const otras = screen.getByRole('navigation', { name: 'Otras secciones' });
    expect(within(principal).getAllByRole('link')).toHaveLength(5);
    expect(within(otras).getAllByRole('link')).toHaveLength(4);
    for (const enlace of container.querySelectorAll('.nav__enlace')) {
      const icono = enlace.querySelector('svg');
      expect(icono?.getAttribute('aria-hidden')).toBe('true');
    }
    const titulos = [...container.querySelectorAll('.barra__titulo')].map((t) => t.textContent);
    expect(titulos).toEqual(['Flujo de trabajo', 'Administración']);
    expect(container.querySelector('.barra__titulo')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('el logo lleva al inicio y tiene su nombre accesible', () => {
    montar();
    const logo = screen.getByRole('link', { name: 'ZAMMIR, ir al panel de inicio' });
    expect(logo.getAttribute('href')).toBe('/');
  });
});
