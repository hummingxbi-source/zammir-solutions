import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  asId,
  err,
  fixedClock,
  inMemorySyncOutbox,
  ok,
  outboxCashShiftStore,
  outboxCounterSaleStore,
  outboxPaymentStore,
  type CashDeps,
  type QuoteActor,
} from '@zammir/core';
import { describe, expect, it, vi } from 'vitest';

import { TurnoDeCaja } from './TurnoDeCaja';

const ADMIN_ID = asId<'User'>('00000000-0000-4000-8000-00000000a0ad');
const cajero: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
  role: 'STAFF',
};
const admin: QuoteActor = { userId: ADMIN_ID, role: 'ADMIN' };

let contador = 0;
const ids = {
  newId: <E extends string>() => {
    contador += 1;
    return asId<E>(`00000000-0000-4000-8000-${String(contador).padStart(12, '0')}`);
  },
};

function montar(actor: QuoteActor = cajero, instante = '2026-10-31T18:00:00.000Z') {
  const reloj = fixedClock(new Date(instante));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const cash: CashDeps = {
    shifts: outboxCashShiftStore(outbox),
    payments: outboxPaymentStore(outbox),
    sales: outboxCounterSaleStore(outbox),
    outbox,
    idGenerator: ids,
    clock: reloj,
    device: { id: '00000000-0000-4000-8000-0000000000d1' },
  };
  const porEnviar = vi.fn();
  render(
    <TurnoDeCaja
      cash={cash}
      actor={actor}
      personas={[
        { id: cajero.userId, name: 'Beto' },
        { id: ADMIN_ID, name: 'Luis' },
      ]}
      autorizacion={{
        administradores: () => Promise.resolve([{ id: ADMIN_ID, name: 'Luis' }]),
        autorizar: (adminId, pin) =>
          Promise.resolve(
            pin === '482915'
              ? ok({
                  adminId: asId<'User'>(adminId),
                  authorizedAt: new Date('2026-10-31T18:00:00.000Z'),
                })
              : err({ code: 'AUTH_FAILED' as const }),
          ),
      }}
      version={0}
      onPorEnviar={porEnviar}
    />,
  );
  return { cash, porEnviar };
}

describe('Turno de caja', () => {
  it('sin turno pide abrirlo, y al abrir con fondo muestra lo que debe haber en el cajón', async () => {
    const { porEnviar } = montar();
    expect(await screen.findByText(/No tienes un turno abierto/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Fondo inicial en el cajón (opcional)'), {
      target: { value: '500' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir turno' }));
    expect(await screen.findByText(/Turno abierto desde las/)).toBeTruthy();
    expect(screen.getByText('Efectivo que debe haber').nextElementSibling?.textContent).toBe(
      '$500.00',
    );
    expect(porEnviar).toHaveBeenCalled();
  });

  it('al cerrar enseña el corte con el sobrante cuando el cajón trae más', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByText(/Turno abierto desde las/);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar turno' }));
    fireEvent.change(await screen.findByLabelText('Efectivo contado'), {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar y calcular el corte' }));
    // La diferencia se calcula con lo contado y, si no es cero, pide la explicación antes de cerrar [RF-M4-09].
    const paso = await screen.findByRole('group', { name: 'Explicar la diferencia' });
    expect(paso.textContent).toMatch(/Sobrante \$10\.00/);
    expect(screen.queryByText(/Corte cerrado/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cerrar y calcular el corte' })).toBeNull();
    fireEvent.change(screen.getByLabelText(/¿Por qué hay diferencia\?/), {
      target: { value: 'Un cliente dejó propina' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar el turno con esta explicación' }));
    expect(await screen.findByText(/Corte cerrado/)).toBeTruthy();
    expect(screen.getAllByText(/Sobrante \$10\.00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Un cliente dejó propina').length).toBeGreaterThan(0);
  });

  it('si se corrige lo contado mientras se explica, vuelve a revisar la diferencia', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByText(/Turno abierto desde las/);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar turno' }));
    const contado = await screen.findByLabelText('Efectivo contado');
    fireEvent.change(contado, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar y calcular el corte' }));
    await screen.findByRole('group', { name: 'Explicar la diferencia' });
    // Se equivocó al contar: corrige a cero y ya cuadra, sin explicación.
    fireEvent.change(contado, { target: { value: '0' } });
    expect(screen.queryByRole('group', { name: 'Explicar la diferencia' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar y calcular el corte' }));
    expect(await screen.findByText(/Corte cerrado/)).toBeTruthy();
    expect(screen.getAllByText('Exacto').length).toBeGreaterThan(0);
  });

  it('un corte exacto se dice exacto y un administrador puede reabrirlo con su PIN y motivo', async () => {
    montar(admin);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByText(/Turno abierto desde las/);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar turno' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar y calcular el corte' }));
    await screen.findByText(/Corte cerrado/);
    expect(screen.getAllByText('Exacto').length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByRole('button', { name: 'Reabrir corte' }));
    fireEvent.change(await screen.findByLabelText(/Motivo/), {
      target: { value: 'Faltó un cobro' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continuar|Autorizar|Confirmar/ }));
    await waitFor(() => {
      expect(screen.queryByText(/Corte reabierto/)).not.toBeNull();
    });
  });

  it('el administrador ve el corte del día', async () => {
    montar(admin);
    expect(await screen.findByText('Corte del día')).toBeTruthy();
    expect(await screen.findByText('No hubo turnos ese día.')).toBeTruthy();
  });
});

describe('Turno de caja · fechas de México', () => {
  it('la lista de turnos muestra el día y la hora de México, no el día de UTC', async () => {
    // 1 nov 03:00 UTC = 31 oct 21:00 en la Ciudad de México.
    montar(cajero, '2026-11-01T03:00:00.000Z');
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByText(/Turno abierto desde las 21:00/);
    const tabla = await screen.findByRole('table', { name: 'Turnos' });
    expect(within(tabla).getByText('2026-10-31 21:00')).toBeTruthy();
    expect(within(tabla).queryByText(/2026-11-01/)).toBeNull();
  });
});
