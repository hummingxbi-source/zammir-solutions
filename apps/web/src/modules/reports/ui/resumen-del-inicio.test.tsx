import { render, screen, within } from '@testing-library/react';
import {
  asId,
  fixedClock,
  inMemorySyncOutbox,
  outboxCounterSaleStore,
  outboxPaymentStore,
  outboxWorkOrderStore,
  PAYMENTS_COLLECTION,
  type CounterSale,
  type QuoteActor,
  type WorkOrder,
} from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { ResumenDelInicio } from './ResumenDelInicio';

const admin: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a0ad'),
  role: 'ADMIN',
};
const ana: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
  role: 'STAFF',
};

const linea = (nombre: string, total: number) => ({
  id: nombre,
  productId: null,
  name: nombre,
  quantity: 1,
  lineTotalCents: total,
});

const orden = (id: string, estado: WorkOrder['status'], total: number, emitida: string) =>
  ({
    id,
    status: estado,
    customerId: 'c1',
    lines: [linea('Vidrio', total)],
    totalCents: total,
    subtotalCents: total,
    taxCents: 0,
    folio: `OT-${id}`,
    tempFolio: `T1-${id}`,
    issuedAt: emitida,
    updatedAt: emitida,
  }) as unknown as WorkOrder;

const venta = (id: string, emitida: string, estado: CounterSale['status'] = 'COMPLETED') =>
  ({
    id,
    status: estado,
    lines: [linea('Chapa', 11_600)],
    totalCents: 11_600,
    issuedAt: emitida,
    updatedAt: emitida,
  }) as unknown as CounterSale;

const pago = (id: string, cobrador: string, centavos: number, pagado: string, extra = {}) => ({
  id,
  groupId: id,
  targetType: 'COUNTER_SALE',
  targetId: 'v1',
  kind: 'SALE',
  method: 'CASH',
  amountCents: centavos,
  userId: cobrador,
  paidAt: pagado,
  ...extra,
});

async function montar(actor: QuoteActor | null, conDatos = true) {
  // Viernes 20 nov 2026, mediodía en México.
  const reloj = fixedClock(new Date('2026-11-20T18:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const orders = outboxWorkOrderStore(outbox);
  const payments = outboxPaymentStore(outbox);
  const sales = outboxCounterSaleStore(outbox);
  if (conDatos) {
    await orders.save(orden('1', 'IN_PROCESS', 100_000, '2026-11-18T18:00:00.000Z'));
    await sales.save(venta('v1', '2026-11-20T15:00:00.000Z'));
    await sales.save(venta('vx', '2026-11-20T15:00:00.000Z', 'CANCELLED'));
    const guardar = (p: { id: string }) =>
      outbox.transaction((tx) => tx.putDocument(PAYMENTS_COLLECTION, p.id, p));
    await guardar(pago('p1', ana.userId, 11_600, '2026-11-20T15:00:00.000Z'));
    await guardar(
      pago('p2', 'beto', 30_000, '2026-11-20T16:00:00.000Z', {
        method: 'TRANSFER',
        targetType: 'WORK_ORDER',
        targetId: '1',
      }),
    );
    await guardar(pago('p3', ana.userId, 9_999, '2026-11-20T16:30:00.000Z', { targetId: 'vx' }));
    await guardar(pago('p4', ana.userId, 20_000, '2026-11-19T16:30:00.000Z'));
  }
  return render(
    <ResumenDelInicio
      deps={{ orders, payments, clock: reloj }}
      sales={sales}
      personas={[]}
      actor={actor}
    />,
  );
}

describe('resumen del inicio', () => {
  it('sin una persona que haya entrado no muestra nada', async () => {
    const { container } = await montar(null);
    expect(container.textContent).toBe('');
  });

  it('el administrador ve las ventas de hoy contra ayer, lo que le deben y la producción', async () => {
    await montar(admin);
    const hoy = within(await screen.findByRole('region', { name: 'Ventas de hoy' }));
    // Hoy: venta 116 + transferencia 300; la venta cancelada no suma. Ayer: 200.
    expect(hoy.getByText('$416.00')).toBeTruthy();
    expect(hoy.getByText('Ayer: $200.00')).toBeTruthy();
    expect(hoy.getByText('Sube 108.00 %')).toBeTruthy();
    // Orden de $1,000 con $300 pagados: se deben $700.
    const cobrar = within(screen.getByRole('region', { name: 'Por cobrar' }));
    expect(cobrar.getByText('$700.00')).toBeTruthy();
    expect(cobrar.getByText('1 cuenta')).toBeTruthy();
    const produccion = within(screen.getByRole('region', { name: 'En producción' }));
    expect(produccion.getByText('$1,000.00')).toBeTruthy();
    expect(produccion.getByText('1 trabajo')).toBeTruthy();
  });

  it('muestra los medios de pago de hoy y la tendencia de 31 días con su tabla equivalente', async () => {
    await montar(admin);
    const medios = within(
      await screen.findByRole('region', { name: 'Cobros de hoy por medio de pago' }),
    );
    expect(medios.getByText('$116.00')).toBeTruthy();
    expect(medios.getByText('$300.00')).toBeTruthy();
    expect(medios.getByText('2 cobros')).toBeTruthy();
    const tendencia = within(
      screen.getByRole('region', { name: 'Ingresos de los últimos 31 días' }),
    );
    const filas = tendencia.getAllByRole('row');
    expect(filas).toHaveLength(31);
    expect(filas.at(-1)?.textContent).toContain('20/11');
    expect(filas.at(-1)?.textContent).toContain('$416.00');
  });

  it('cada tarjeta con cifras trae su ayuda que se abre con un toque', async () => {
    await montar(admin);
    await screen.findByRole('region', { name: 'Ventas de hoy' });
    expect(screen.getAllByRole('button', { name: /^Ayuda sobre/ }).length).toBeGreaterThanOrEqual(
      3,
    );
  });

  it('el cajero ve solo lo que cobró él hoy, sin cifras del negocio', async () => {
    await montar(ana);
    const suyos = within(await screen.findByRole('region', { name: 'Tus cobros de hoy' }));
    expect(suyos.getByText('$116.00')).toBeTruthy();
    expect(suyos.getByText('1 cobro')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Por cobrar' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Ventas de hoy' })).toBeNull();
    expect(screen.getByRole('region', { name: 'En producción' })).toBeTruthy();
  });

  it('sin movimiento enseña qué hacer en vez de mostrar ceros de relleno', async () => {
    await montar(admin, false);
    expect(await screen.findByText('Todavía no hay movimiento')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Ventas de hoy' })).toBeNull();
  });
});
