import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { BotonPorDondeEmpiezo, pasosDeLaGuia, PrimerosPasos, siguientePaso } from './PrimerosPasos';

const SIN_INTERRUPTORES = new Set<never>();
const TODAS = ['catalogo', 'cotizador', 'ordenes', 'mostrador', 'reportes'];

function titulos(): (string | null | undefined)[] {
  return screen
    .getAllByRole('link')
    .map((enlace) => enlace.querySelector('.guia__titulo')?.textContent);
}

describe('primeros pasos', () => {
  it('son cinco tarjetas numeradas en el orden del flujo de trabajo', () => {
    render(
      <MemoryRouter>
        <PrimerosPasos interruptores={SIN_INTERRUPTORES} visitadas={new Set()} />
      </MemoryRouter>,
    );
    expect(titulos()).toEqual([
      'Catálogo',
      'Cotizador',
      'Órdenes de trabajo',
      'Mostrador',
      'Reportes',
    ]);
    const primero = screen.getAllByRole('link')[0];
    expect(primero?.textContent).toContain('Paso 1 · Pendiente');
    expect(primero?.className).toContain('guia__paso--siguiente');
  });

  it('marca como hechos los pasos visitados y resalta el siguiente', () => {
    render(
      <MemoryRouter>
        <PrimerosPasos
          interruptores={SIN_INTERRUPTORES}
          visitadas={new Set(['catalogo', 'cotizador'])}
        />
      </MemoryRouter>,
    );
    expect(screen.getAllByText(/Ya lo visitaste/)).toHaveLength(2);
    const pasos = screen.getAllByRole('link');
    expect(pasos[0]?.className).toContain('guia__paso--hecho');
    expect(pasos[2]?.className).toContain('guia__paso--siguiente');
  });

  it('se oculta sola cuando ya se visitaron todas las secciones', () => {
    const { container } = render(
      <MemoryRouter>
        <PrimerosPasos interruptores={SIN_INTERRUPTORES} visitadas={new Set(TODAS)} />
      </MemoryRouter>,
    );
    expect(container.textContent).toBe('');
  });

  it('el siguiente paso es la primera sección sin visitar', () => {
    const pasos = pasosDeLaGuia(SIN_INTERRUPTORES);
    expect(siguientePaso(pasos, new Set())?.id).toBe('catalogo');
    expect(siguientePaso(pasos, new Set(['catalogo', 'ordenes']))?.id).toBe('cotizador');
    expect(siguientePaso(pasos, new Set(TODAS))).toBeNull();
  });
});

describe('botón "¿Por dónde empiezo?"', () => {
  it('abre una ventana que dice cuál es el siguiente paso y lleva a él', () => {
    render(
      <MemoryRouter>
        <BotonPorDondeEmpiezo interruptores={SIN_INTERRUPTORES} visitadas={new Set(['catalogo'])} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: '¿Por dónde empiezo?' }));
    const ventana = within(screen.getByRole('dialog', { name: '¿Por dónde empiezo?' }));
    expect(ventana.getByText('Sigue por Cotizador.')).toBeTruthy();
    expect(ventana.getByRole('link', { name: 'Ir ahora' }).getAttribute('href')).toBe('/cotizador');
    fireEvent.click(ventana.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('con todo visitado lo dice y no ofrece ir a ningún lado', () => {
    render(
      <MemoryRouter>
        <BotonPorDondeEmpiezo interruptores={SIN_INTERRUPTORES} visitadas={new Set(TODAS)} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: '¿Por dónde empiezo?' }));
    expect(screen.getByText(/Ya visitaste las cinco secciones/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Ir ahora' })).toBeNull();
  });
});
