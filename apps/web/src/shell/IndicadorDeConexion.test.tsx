import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IndicadorDeConexion } from './IndicadorDeConexion';

function ponerInternet(hay: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(hay);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('indicador de conexión', () => {
  it('con internet no muestra nada', () => {
    ponerInternet(true);
    render(<IndicadorDeConexion />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sin internet avisa que se puede seguir trabajando', () => {
    ponerInternet(false);
    render(<IndicadorDeConexion />);
    expect(screen.getByRole('status').textContent).toBe(
      'Sin internet. Sigues trabajando: lo que captures queda guardado en la tablet.',
    );
  });

  it('aparece al perder el internet y desaparece al volver', () => {
    ponerInternet(true);
    render(<IndicadorDeConexion />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toBeTruthy();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
