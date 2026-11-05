import { fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { LimiteDeErrores } from './LimiteDeErrores';

function Roto(): ReactElement {
  throw new Error('Falló para ana@ejemplo.invalid');
}

describe('límite de errores', () => {
  it('sin fallas muestra lo suyo', () => {
    render(
      <LimiteDeErrores alError={() => undefined}>
        <p>Todo bien</p>
      </LimiteDeErrores>,
    );
    expect(screen.getByText('Todo bien')).toBeTruthy();
  });

  it('si una pantalla se rompe dice qué hacer, avisa del error y deja volver a abrir', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const errores: unknown[] = [];
    const recargar = vi.fn();
    const { container } = render(
      <LimiteDeErrores alError={(e) => errores.push(e)} recargar={recargar}>
        <Roto />
      </LimiteDeErrores>,
    );
    expect(screen.getByRole('alert').textContent).toContain('no se pudo mostrar');
    expect(screen.getByRole('alert').textContent).toContain('avísale a Juanito');
    expect(errores).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Volver a abrir' }));
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(
      (await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })).violations,
    ).toEqual([]);
    consola.mockRestore();
  });
});
