import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from './App';
import type { Interruptor } from './shell/secciones';

function mostrar(ruta = '/', interruptores?: ReadonlySet<Interruptor>): void {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      {interruptores === undefined ? <App /> : <App interruptores={interruptores} />}
    </MemoryRouter>,
  );
}

function navegacionPrincipal(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Secciones del trabajo' });
}

describe('App y navegación', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('muestra el nombre del negocio como logo que lleva al panel de inicio', () => {
    mostrar('/catalogo');
    const logo = screen.getByRole('link', { name: 'ZAMMIR, ir al panel de inicio' });
    expect(logo).toHaveTextContent('ZAMMIR');
    expect(logo).toHaveAttribute('href', '/');
  });

  it('las secciones del trabajo van en el orden real: Catálogo, Cotizador, Órdenes de trabajo, Mostrador y Reportes', () => {
    mostrar();
    const nombres = [...navegacionPrincipal().querySelectorAll('a')].map((enlace) =>
      enlace.textContent.replace(/[\d✓]|ya visitada/g, '').trim(),
    );
    expect(nombres).toEqual([
      'Catálogo',
      'Cotizador',
      'Órdenes de trabajo',
      'Mostrador',
      'Reportes',
    ]);
  });

  it('numera discretamente las secciones del 1 al 5', () => {
    mostrar();
    const numeros = [...navegacionPrincipal().querySelectorAll('.nav__numero')].map(
      (n) => n.textContent,
    );
    expect(numeros).toEqual(['1', '2', '3', '4', '5']);
  });

  it('clientes, cuentas por cobrar, usuarios y configuración van en el menú secundario', () => {
    mostrar();
    const secundaria = screen.getByRole('navigation', { name: 'Otras secciones', hidden: true });
    const enlaces = [...secundaria.querySelectorAll('a')].map((e) => e.textContent);
    expect(enlaces).toEqual(['Clientes', 'Cuentas por cobrar', 'Usuarios', 'Configuración']);
  });

  it('el panel de inicio ofrece accesos a las secciones, sin cifras', () => {
    mostrar();
    expect(screen.getByRole('heading', { name: 'Panel de inicio' })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getAllByRole('link')).toHaveLength(9);
    expect(main.textContent).not.toMatch(/\$|\d/);
  });

  it('una sección nueva muestra un estado vacío sin datos de relleno', () => {
    mostrar('/mostrador');
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { name: 'Mostrador' })).toBeInTheDocument();
    expect(main).toHaveTextContent('Esta sección estará lista pronto.');
  });

  it('marca como visitada la sección donde la persona entra', () => {
    mostrar('/cotizador');
    const nav = navegacionPrincipal();
    expect(within(nav).getByRole('link', { name: /Cotizador/ })).toHaveTextContent('ya visitada');
    expect(within(nav).getByRole('link', { name: /Catálogo/ })).not.toHaveTextContent(
      'ya visitada',
    );
  });

  it('recuerda las secciones visitadas aunque se vuelva a abrir', () => {
    window.localStorage.setItem('zammir.secciones-visitadas', JSON.stringify(['catalogo']));
    mostrar('/');
    expect(within(navegacionPrincipal()).getByRole('link', { name: /Catálogo/ })).toHaveTextContent(
      'ya visitada',
    );
  });

  it('ignora datos dañados del almacenamiento', () => {
    window.localStorage.setItem('zammir.secciones-visitadas', 'esto no es JSON');
    mostrar('/');
    expect(screen.getByRole('heading', { name: 'Panel de inicio' })).toBeInTheDocument();
    expect(navegacionPrincipal().querySelector('.nav__visitada')).toBeNull();
  });

  it('ignora un almacenamiento que no es una lista de textos', () => {
    window.localStorage.setItem('zammir.secciones-visitadas', JSON.stringify({ a: 1 }));
    mostrar('/');
    expect(navegacionPrincipal().querySelector('.nav__visitada')).toBeNull();
  });

  it('al elegir un acceso del panel de inicio abre esa sección', () => {
    mostrar('/');
    fireEvent.click(within(screen.getByRole('main')).getByRole('link', { name: 'Reportes' }));
    expect(screen.getByRole('heading', { name: 'Reportes' })).toBeInTheDocument();
  });

  it('una ruta desconocida regresa al panel de inicio', () => {
    mostrar('/no-existe');
    expect(screen.getByRole('heading', { name: 'Panel de inicio' })).toBeInTheDocument();
  });
});
