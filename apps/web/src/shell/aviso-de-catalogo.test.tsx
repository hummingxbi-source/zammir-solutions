import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { AvisoDeCatalogo } from './AvisoDeCatalogo';

function montar(inicial = '/cotizador') {
  return render(
    <MemoryRouter initialEntries={[inicial]}>
      <Routes>
        <Route path="/cotizador" element={<AvisoDeCatalogo />} />
        <Route path="/catalogo" element={<p>Pantalla del catálogo</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('aviso de catálogo en el cotizador y el mostrador', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('mientras nadie visite el catálogo avisa que se revise primero', () => {
    montar();
    expect(screen.getByText(/Revisa primero tu catálogo/)).toBeTruthy();
  });

  it('el enlace lleva al catálogo', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Ir al Catálogo →' }));
    expect(screen.getByText('Pantalla del catálogo')).toBeTruthy();
  });

  it('se puede cerrar y ya no vuelve a salir en esta sesión', () => {
    const { unmount } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar este aviso' }));
    expect(screen.queryByText(/Revisa primero tu catálogo/)).toBeNull();
    unmount();
    montar();
    expect(screen.queryByText(/Revisa primero tu catálogo/)).toBeNull();
  });
});
