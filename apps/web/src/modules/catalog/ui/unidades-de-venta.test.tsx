import { fireEvent, render, screen, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  fixedClock,
  inMemoryAdminAuth,
  inMemoryAuditLog,
  inMemoryLegal,
  inMemorySaleUnitSuggestions,
  sequentialIdGenerator,
  type LegalDeps,
} from '@zammir/core';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../../../App';
import { ProveedorSesionAdmin } from '../../identity/ui/SesionAdmin';

// La primera pantalla de cada archivo arma toda la aplicación y, con cientos de pruebas en paralelo, puede
// pasar de los 5 s por omisión. Solo cambia cuánto se espera, no lo que se comprueba.
vi.setConfig({ testTimeout: 30_000 });
configure({ asyncUtilTimeout: 5_000 });

const instante = new Date('2026-11-20T18:00:00.000Z');
const ETIQUETA = 'Unidades de venta, una por renglón';

function mostrar() {
  const clock = fixedClock(instante);
  const legal: LegalDeps = {
    clock,
    legal: inMemoryLegal({
      clock,
      idGenerator: sequentialIdGenerator('l'),
      auditLog: inMemoryAuditLog(),
    }),
  };
  const unidades = inMemorySaleUnitSuggestions(['rollo', 'kilo']);
  const auth = inMemoryAdminAuth([
    { userId: 'a-1', email: 'a@ejemplo.invalid', password: 'clave-de-prueba-1', role: 'ADMIN' },
  ]);
  render(
    <ProveedorSesionAdmin
      auth={auth}
      clock={clock}
      cargarLimiteInactividad={() => Promise.resolve(null)}
    >
      <MemoryRouter initialEntries={['/configuracion']}>
        <App legal={legal} unidadesDeVenta={unidades} />
      </MemoryRouter>
    </ProveedorSesionAdmin>,
  );
  return { unidades };
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

describe('unidades de venta sugeridas, en Configuración [PP-40]', () => {
  it('muestra las vigentes, una por renglón, y guarda las nuevas ya limpias', async () => {
    const { unidades } = mostrar();
    await entrar();
    const campo = await screen.findByLabelText(ETIQUETA);
    expect((campo as HTMLTextAreaElement).value).toBe('rollo\nkilo');

    fireEvent.change(campo, { target: { value: 'rollo\n galón \n\nRollo\ncartucho' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar unidades' }));

    expect(await screen.findByText('Listo. Se sugieren las unidades nuevas.')).toBeTruthy();
    expect(unidades.current()).toEqual(['rollo', 'galón', 'cartucho']);
    expect((campo as HTMLTextAreaElement).value).toBe('rollo\ngalón\ncartucho');
  });

  it('una unidad muy larga no se guarda y dice qué hacer', async () => {
    const { unidades } = mostrar();
    await entrar();
    const campo = await screen.findByLabelText(ETIQUETA);
    fireEvent.change(campo, { target: { value: 'a'.repeat(21) } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar unidades' }));

    expect(await screen.findByText('La lista no vale.')).toBeTruthy();
    expect(unidades.current()).toEqual(['rollo', 'kilo']);
  });
});
