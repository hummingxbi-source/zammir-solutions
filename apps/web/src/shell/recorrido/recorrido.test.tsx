import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

import { App } from '../../App';
import { pasosDelRecorrido } from './pasos';
import { CLAVE_DEL_RECORRIDO } from './Recorrido';

vi.setConfig({ testTimeout: 30_000 });

let ruta = '/';
function Ruta(): ReactElement | null {
  ruta = useLocation().pathname;
  return null;
}

function mostrar(automatico = false, inicio = '/'): void {
  render(
    <MemoryRouter initialEntries={[inicio]}>
      <App recorridoAutomatico={automatico} />
      <Ruta />
    </MemoryRouter>,
  );
}

const dialogo = (): HTMLElement => screen.getByRole('dialog', { name: /./ });

describe('recorrido guiado', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('recorre el inicio, las cinco secciones del trabajo y las de administración, sin facturas si está apagada', () => {
    const ids = pasosDelRecorrido(new Set()).map((p) => p.id);
    expect(ids[0]).toBe('bienvenida');
    expect(ids.at(-1)).toBe('final');
    expect(ids).toEqual(
      expect.arrayContaining([
        'seccion-catalogo',
        'seccion-cotizador',
        'seccion-ordenes',
        'seccion-mostrador',
        'seccion-reportes',
        'seccion-usuarios',
        'seccion-configuracion',
        'repetir',
      ]),
    );
    expect(ids).not.toContain('seccion-facturas');
    expect(pasosDelRecorrido(new Set(['FACTURACION'])).map((p) => p.id)).toContain(
      'seccion-facturas',
    );
    for (const paso of pasosDelRecorrido(new Set())) {
      expect(paso.titulo, paso.id).not.toBe('');
      expect(paso.texto, paso.id).not.toBe('');
    }
  });

  it('el botón de la barra lo inicia, avanza navegando por las secciones y regresa', () => {
    mostrar();
    fireEvent.click(screen.getByRole('button', { name: 'Recorrido guiado' }));
    expect(dialogo().textContent).toMatch(/Bienvenido a ZAMMIR/);
    expect(dialogo().textContent).toMatch(/Paso 1 de/);

    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    expect(dialogo().textContent).toMatch(/Tres formas de entrar/);

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(dialogo().textContent).toMatch(/Catálogo/);
    expect(ruta).toBe('/catalogo');

    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(ruta).toBe('/cotizador');
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(ruta).toBe('/catalogo');
  });

  it('con el teclado: flechas para avanzar y regresar, Escape para salir; queda como visto', () => {
    mostrar();
    fireEvent.click(screen.getByRole('button', { name: 'Recorrido guiado' }));
    fireEvent.keyDown(dialogo(), { key: 'ArrowRight' });
    expect(dialogo().textContent).toMatch(/Tres formas de entrar/);
    fireEvent.keyDown(dialogo(), { key: 'ArrowLeft' });
    expect(dialogo().textContent).toMatch(/Bienvenido/);
    fireEvent.keyDown(dialogo(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem(CLAVE_DEL_RECORRIDO)).toBe('1');
  });

  it('se puede saltar desde el primer paso y llegar hasta el final con Terminar', () => {
    mostrar();
    fireEvent.click(screen.getByRole('button', { name: 'Recorrido guiado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Saltar el recorrido' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Recorrido guiado' }));
    const total = pasosDelRecorrido(new Set()).length;
    for (let i = 1; i < total; i += 1) {
      fireEvent.keyDown(dialogo(), { key: 'ArrowRight' });
    }
    expect(dialogo().textContent).toMatch(/¡Listo!/);
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(ruta).toBe('/');
  });

  it('arranca solo la primera vez que se abre', () => {
    vi.useFakeTimers();
    mostrar(true);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(dialogo().textContent).toMatch(/Bienvenido a ZAMMIR/);
  });

  it('no arranca solo si ya se vio', () => {
    window.localStorage.setItem(CLAVE_DEL_RECORRIDO, '1');
    vi.useFakeTimers();
    mostrar(true);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('no arranca solo en la pantalla de entrar con PIN', () => {
    vi.useFakeTimers();
    mostrar(true, '/entrar');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
