import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  fixedClock,
  inMemoryAdminAuth,
  inMemoryAuditLog,
  inMemoryLegal,
  inMemoryQuoteConditions,
  sequentialIdGenerator,
  type LegalDeps,
} from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { App } from '../../../App';
import { ProveedorSesionAdmin } from '../../identity/ui/SesionAdmin';

const instante = new Date('2026-10-31T18:00:00.000Z');

function mostrar(inicial: string, rol: 'ADMIN' | 'STAFF' = 'ADMIN') {
  const clock = fixedClock(instante);
  const legal: LegalDeps = {
    clock,
    legal: inMemoryLegal({
      clock,
      idGenerator: sequentialIdGenerator('l'),
      auditLog: inMemoryAuditLog(),
    }),
  };
  const condiciones = inMemoryQuoteConditions(inicial);
  const auth = inMemoryAdminAuth([
    { userId: 'a-1', email: 'a@ejemplo.invalid', password: 'clave-de-prueba-1', role: rol },
  ]);
  render(
    <ProveedorSesionAdmin
      auth={auth}
      clock={clock}
      cargarLimiteInactividad={() => Promise.resolve(null)}
    >
      <MemoryRouter initialEntries={['/configuracion']}>
        <App legal={legal} condiciones={condiciones} />
      </MemoryRouter>
    </ProveedorSesionAdmin>,
  );
  return condiciones;
}

async function entrar(): Promise<void> {
  fireEvent.change(await screen.findByLabelText('Correo'), {
    target: { value: 'a@ejemplo.invalid' },
  });
  fireEvent.change(screen.getByLabelText('Contraseña'), {
    target: { value: 'clave-de-prueba-1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('condiciones de la cotización en Configuración', () => {
  it('muestra las vigentes y guarda las nuevas con confirmación', async () => {
    const condiciones = mostrar('Condición uno.\nCondición dos.');
    await entrar();
    const campo = await screen.findByLabelText('Condiciones (una por línea)');
    expect((campo as HTMLTextAreaElement).value).toBe('Condición uno.\nCondición dos.');

    fireEvent.change(campo, { target: { value: 'Solo una condición nueva.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }));

    expect(await screen.findByText(/Condiciones guardadas/)).toBeTruthy();
    expect(condiciones.current()).toBe('Solo una condición nueva.');
  });

  it('un texto vacío no se guarda y dice qué hacer', async () => {
    const condiciones = mostrar('Condición uno.');
    await entrar();
    const campo = await screen.findByLabelText('Condiciones (una por línea)');
    fireEvent.change(campo, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }));

    expect(await screen.findByText('Falta al menos una condición.')).toBeTruthy();
    expect(screen.getByText('Escribe una condición por línea.')).toBeTruthy();
    expect(condiciones.current()).toBe('Condición uno.');
  });
});
