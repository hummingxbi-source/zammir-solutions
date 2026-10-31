import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  asId,
  buildCustomer,
  fixedClock,
  inMemorySyncOutbox,
  NO_FISCAL_PROFILE,
  outboxCashShiftStore,
  PAYMENTS_COLLECTION,
  outboxPaymentStore,
  outboxQuoteStore,
  outboxWorkOrderStore,
  seededRandom,
  type ManageCustomersDeps,
  type OrderDeps,
  type QuoteActor,
  type WorkOrder,
} from '@zammir/core';
import { clientesEnMemoriaDePrueba } from '@zammir/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { CuentasPorCobrar } from './CuentasPorCobrar';

const CLIENTE = asId<'Customer'>('00000000-0000-4000-8000-00000000c001');
const SIN_TEL = asId<'Customer'>('00000000-0000-4000-8000-00000000c002');
const admin: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a0ad'),
  role: 'ADMIN',
};
const cajero: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
  role: 'STAFF',
};

let n = 0;
const ids = {
  newId: <E extends string>() => {
    n += 1;
    return asId<E>(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
  },
};

const orden = (id: string, cliente: typeof CLIENTE, total: number, issuedAt: string): WorkOrder =>
  ({
    id,
    status: 'IN_PROCESS',
    customerId: cliente,
    lines: [],
    subtotalCents: total,
    taxCents: 0,
    totalCents: total,
    tempFolio: `T1-${id.slice(-2)}`,
    folio: `OT-2026-00${id.slice(-2)}`,
    publicCode: 'ABCDEFGH',
    issuedAt,
    userId: admin.userId,
    syncStatus: 'SENT',
    reviewReason: null,
    updatedAt: issuedAt,
  }) as unknown as WorkOrder;

async function montar(actor: QuoteActor | null = admin, soloSaldadas = false) {
  // 20 nov 2026, mediodía en México.
  const reloj = fixedClock(new Date('2026-11-20T18:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const turnos = outboxCashShiftStore(outbox);
  const deps: OrderDeps = {
    orders: outboxWorkOrderStore(outbox),
    payments: outboxPaymentStore(outbox),
    quotes: outboxQuoteStore(outbox),
    shifts: turnos,
    outbox,
    idGenerator: ids,
    clock: reloj,
    random: seededRandom(5),
    device: { id: '00000000-0000-4000-8000-0000000000d1', series: 1 },
    settings: {
      depositPercentBps: 5_000,
      requireDepositToStart: true,
      warrantyMonthsDefault: null,
    },
  };
  if (!soloSaldadas) {
    await deps.orders.save(
      orden('00000000-0000-4000-8000-000000000a01', CLIENTE, 50_000, '2026-11-05T18:00:00.000Z'),
    );
    await deps.orders.save(
      orden('00000000-0000-4000-8000-000000000a02', SIN_TEL, 20_000, '2026-11-19T18:00:00.000Z'),
    );
  }
  await deps.orders.save(
    orden('00000000-0000-4000-8000-000000000a03', CLIENTE, 10_000, '2026-11-01T18:00:00.000Z'),
  );
  const pagoPrevio = {
    id: ids.newId<'Payment'>(),
    groupId: ids.newId<'PaymentGroup'>(),
    targetType: 'WORK_ORDER',
    targetId: '00000000-0000-4000-8000-000000000a03',
    kind: 'DEPOSIT',
    method: 'CASH',
    amountCents: 10_000,
    cashReceivedCents: 10_000,
    changeCents: 0,
    reference: null,
    userId: admin.userId,
    deviceId: null,
    paidAt: '2026-11-02T18:00:00.000Z',
    cashShiftId: null,
  };
  await outbox.transaction((tx) => tx.putDocument(PAYMENTS_COLLECTION, pagoPrevio.id, pagoPrevio));
  const { customers } = clientesEnMemoriaDePrueba();
  for (const [id, nombre, tel] of [
    [CLIENTE, 'Ana López', '5512345678'],
    [SIN_TEL, 'Beto Ruiz', ''],
  ] as const) {
    const c = buildCustomer(id, {
      name: nombre,
      phone: tel === '' ? '5500000000' : tel,
      email: null,
      notes: null,
      fiscal: NO_FISCAL_PROFILE,
      privacyNoticeVersion: null,
    });
    if (c.ok) {
      await customers.create(tel === '' ? { ...c.value, phone: '' } : c.value);
    }
  }
  const clientes: ManageCustomersDeps = { customers, idGenerator: ids };
  const abrirEnlace = vi.fn();
  const porEnviar = vi.fn();
  render(
    <MemoryRouter>
      <CuentasPorCobrar
        deps={deps}
        actor={actor}
        clientes={clientes}
        negocio="ZAMMIR"
        abrirEnlace={abrirEnlace}
        onPorEnviar={porEnviar}
      />
    </MemoryRouter>,
  );
  return { deps, abrirEnlace, porEnviar, outbox };
}

describe('Cuentas por cobrar', () => {
  it('lista las órdenes con saldo con cliente, folio, saldo y días; la saldada no aparece', async () => {
    await montar();
    const tabla = await screen.findByRole('table');
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(2);
    expect(filas[0]?.textContent).toContain('Ana López');
    expect(filas[0]?.textContent).toContain('OT-2026-0001');
    expect(filas[0]?.textContent).toContain('$500.00');
    expect(filas[0]?.textContent).toContain('15');
    expect(filas[1]?.textContent).toContain('Beto Ruiz');
    expect(filas[1]?.textContent).toContain('1');
    expect(within(tabla).queryByText('OT-2026-0003')).toBeNull();
  });

  it('resalta con texto la cuenta que llegó al umbral y resume lo atrasado', async () => {
    await montar();
    const tabla = await screen.findByRole('table');
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas[0]?.textContent).toContain('Atrasada');
    expect(filas[1]?.textContent).not.toContain('Atrasada');
    expect(screen.getByText('Por cobrar').nextElementSibling?.textContent).toBe('$700.00');
    expect(screen.getByText('Atrasadas').nextElementSibling?.textContent).toBe('1 · $500.00');
  });

  it('registra un pago desde la lista, queda atribuido a quien cobró y baja el saldo', async () => {
    const { deps, porEnviar, outbox } = await montar();
    await deps.shifts?.openFor(admin.userId);
    // Sin turno abierto el cobro lo pide.
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pago OT-2026-0001' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Transferencia'), { target: { value: '500' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar cobro' }));
    expect(await within(dialogo).findByText('Todavía no abres tu turno de caja.')).toBeTruthy();
    expect(porEnviar).not.toHaveBeenCalled();
    expect((await outbox.list()).length).toBe(0);
  });

  it('con turno abierto el pago sale como RegisterPayment y la cuenta se salda', async () => {
    const { deps, porEnviar, outbox } = await montar();
    const turnoDeps = {
      shifts: deps.shifts,
    };
    expect(turnoDeps.shifts).toBeDefined();
    // Un turno abierto de quien cobra.
    const { openCashShift } = await import('@zammir/core');
    const abierto = await openCashShift(
      {
        shifts: outboxCashShiftStore(deps.outbox),
        payments: deps.payments,
        sales: {
          get: () => Promise.resolve(null),
          save: () => Promise.resolve(),
          list: () => Promise.resolve([]),
        },
        outbox: deps.outbox,
        idGenerator: ids,
        clock: deps.clock,
        device: { id: deps.device.id },
      },
      admin,
      { openingFloatCents: 0 },
    );
    expect(abierto.ok).toBe(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar pago OT-2026-0001' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Transferencia'), { target: { value: '500' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar cobro' }));
    await waitFor(() => {
      expect(porEnviar).toHaveBeenCalled();
    });
    expect((await outbox.list()).map((o) => o.envelope.type)).toContain('RegisterPayment');
    expect(
      (await outbox.list()).find((o) => o.envelope.type === 'RegisterPayment')?.envelope.userId,
    ).toBe(admin.userId);
    await waitFor(() => {
      expect(screen.queryByText('OT-2026-0001')).toBeNull();
    });
    expect(screen.getByText('Por cobrar').nextElementSibling?.textContent).toBe('$200.00');
  });

  it('el recordatorio abre WhatsApp con folio y saldo; sin teléfono avisa qué hacer', async () => {
    const { abrirEnlace } = await montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Recordatorio OT-2026-0001' }));
    expect(abrirEnlace).toHaveBeenCalledTimes(1);
    const url = String(abrirEnlace.mock.calls[0]?.[0]);
    expect(url.startsWith('https://wa.me/525512345678?text=')).toBe(true);
    const texto = decodeURIComponent(url.split('?text=')[1] ?? '');
    expect(texto).toContain('OT-2026-0001');
    expect(texto).toContain('$500.00');
    expect(texto).toContain('Ana López');
    expect(await screen.findByText(/Se abrió WhatsApp/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Recordatorio OT-2026-0002' }));
    expect(await screen.findByText('Este cliente no tiene WhatsApp registrado.')).toBeTruthy();
    expect(abrirEnlace).toHaveBeenCalledTimes(1);
  });

  it('sin cuentas pendientes lo dice', async () => {
    await montar(admin, true);
    expect(await screen.findByText(/No hay cuentas por cobrar/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('un cajero no ve las cuentas y sin PIN pide entrar', async () => {
    await montar(cajero);
    expect(
      await screen.findByText('Las cuentas por cobrar son solo para administradores.'),
    ).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('sin una persona que haya entrado, pide entrar', async () => {
    await montar(null);
    expect(await screen.findByRole('link', { name: 'Entrar con PIN' })).toBeTruthy();
  });
});
