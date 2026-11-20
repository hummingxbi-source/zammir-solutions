import { fireEvent, render, screen, configure } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  fixedClock,
  inMemoryAdminAuth,
  inMemoryAgingThreshold,
  inMemoryAuditLog,
  inMemoryLegal,
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
const ETIQUETA = 'Días para marcar una cuenta como atrasada';

function mostrar(inicial: number) {
  const clock = fixedClock(instante);
  const legal: LegalDeps = {
    clock,
    legal: inMemoryLegal({
      clock,
      idGenerator: sequentialIdGenerator('l'),
      auditLog: inMemoryAuditLog(),
    }),
  };
  const umbral = inMemoryAgingThreshold(inicial);
  const avisados: number[] = [];
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
        <App
          legal={legal}
          umbralDeAtraso={umbral}
          alCambiarElUmbral={(d) => {
            avisados.push(d);
          }}
        />
      </MemoryRouter>
    </ProveedorSesionAdmin>,
  );
  return { umbral, avisados };
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

describe('días para marcar una cuenta como atrasada, en Configuración', () => {
  it('muestra los vigentes, guarda los nuevos y avisa a las pantallas', async () => {
    const { umbral, avisados } = mostrar(10);
    await entrar();
    const campo = await screen.findByLabelText(ETIQUETA);
    expect((campo as HTMLInputElement).value).toBe('10');

    fireEvent.change(campo, { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar días' }));

    expect(await screen.findByText(/Las cuentas se resaltan con los días nuevos/)).toBeTruthy();
    expect(umbral.current()).toBe(15);
    expect(avisados).toEqual([15]);
  });

  it('un valor que no vale no se guarda y dice qué hacer', async () => {
    const { umbral, avisados } = mostrar(10);
    await entrar();
    const campo = await screen.findByLabelText(ETIQUETA);
    fireEvent.change(campo, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar días' }));

    expect(await screen.findByText('Los días no valen.')).toBeTruthy();
    expect(screen.getByText('Escribe un número entero de 1 a 365.')).toBeTruthy();
    expect(umbral.current()).toBe(10);
    expect(avisados).toEqual([]);
  });
});
