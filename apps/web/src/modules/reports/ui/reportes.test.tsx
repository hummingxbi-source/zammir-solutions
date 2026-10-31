import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
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

import { formatearPorcentaje, Reportes } from './Reportes';

const admin: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a0ad'),
  role: 'ADMIN',
};
const cajero: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
  role: 'STAFF',
};

const linea = (productId: string | null, name: string, quantity: number, total: number) => ({
  id: `${name}-${String(quantity)}`,
  productId,
  name,
  quantity,
  lineTotalCents: total,
});

const orden = (
  id: string,
  estado: WorkOrder['status'],
  total: number,
  issuedAt: string,
): WorkOrder =>
  ({
    id,
    status: estado,
    customerId: 'c1',
    lines: [linea('p-vidrio', 'Vidrio 6 mm', 2, total)],
    totalCents: total,
    subtotalCents: total,
    taxCents: 0,
    folio: `OT-${id}`,
    tempFolio: `T1-${id}`,
    issuedAt,
    updatedAt: issuedAt,
  }) as unknown as WorkOrder;

const venta = (
  id: string,
  issuedAt: string,
  estado: CounterSale['status'] = 'COMPLETED',
): CounterSale =>
  ({
    id,
    status: estado,
    lines: [linea('p-chapa', 'Chapa', 1, 11_600)],
    totalCents: 11_600,
    issuedAt,
    updatedAt: issuedAt,
  }) as unknown as CounterSale;

const pago = (
  id: string,
  cobrador: string,
  centavos: number,
  paidAt: string,
  extra: object = {},
) => ({
  id,
  groupId: id,
  targetType: 'COUNTER_SALE',
  targetId: 'v1',
  kind: 'SALE',
  method: 'CASH',
  amountCents: centavos,
  userId: cobrador,
  paidAt,
  ...extra,
});

async function montar(actor: QuoteActor | null = admin, conDatos = true) {
  // Viernes 20 nov 2026, mediodía en México.
  const reloj = fixedClock(new Date('2026-11-20T18:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const orders = outboxWorkOrderStore(outbox);
  const payments = outboxPaymentStore(outbox);
  const sales = outboxCounterSaleStore(outbox);
  if (conDatos) {
    await orders.save(orden('1', 'IN_PROCESS', 100_000, '2026-11-18T18:00:00.000Z'));
    await orders.save(orden('2', 'DELIVERED', 50_000, '2026-11-02T18:00:00.000Z'));
    await sales.save(venta('v1', '2026-11-20T15:00:00.000Z'));
    await sales.save(venta('vx', '2026-11-20T15:00:00.000Z', 'CANCELLED'));
    const guardar = (p: { id: string }) =>
      outbox.transaction((tx) => tx.putDocument(PAYMENTS_COLLECTION, p.id, p));
    await guardar(pago('p1', 'ana', 11_600, '2026-11-20T15:00:00.000Z'));
    await guardar(
      pago('p2', 'beto', 30_000, '2026-11-20T16:00:00.000Z', {
        method: 'TRANSFER',
        targetType: 'WORK_ORDER',
        targetId: '1',
      }),
    );
    await guardar(pago('p3', 'ana', 9_999, '2026-11-20T16:30:00.000Z', { targetId: 'vx' }));
    await guardar(pago('p4', 'ana', 20_000, '2026-10-20T16:30:00.000Z'));
  }
  render(
    <MemoryRouter>
      <Reportes
        deps={{ orders, payments, clock: reloj }}
        sales={sales}
        personas={[
          { id: 'ana', name: 'Ana' },
          { id: 'beto', name: 'Beto' },
        ]}
        actor={actor}
      />
    </MemoryRouter>,
  );
  if (conDatos && actor?.role === 'ADMIN') {
    // Los datos llegan después del primer dibujo: se espera a que ya haya productos.
    await screen.findByText('Por importe');
  }
}

const celdaDe = (tabla: HTMLElement, fila: string, rotulo: string): string => {
  const f = within(tabla)
    .getAllByRole('row')
    .find((r) => r.textContent.includes(fila));
  return f?.querySelector(`[data-label="${rotulo}"]`)?.textContent ?? '';
};

describe('Reportes', () => {
  it('un cajero no tiene acceso y sin persona pide entrar', async () => {
    await montar(cajero);
    expect(await screen.findByText('Los reportes son solo para administradores.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('sin una persona que haya entrado pide entrar con su PIN', async () => {
    await montar(null);
    expect(await screen.findByRole('link', { name: 'Entrar con PIN' })).toBeTruthy();
  });

  it('explica que "ventas" es el efectivo recibido', async () => {
    await montar();
    expect(await screen.findByText(/"ventas" es el efectivo recibido/)).toBeTruthy();
    expect(screen.getByText(/semana va de lunes a domingo/)).toBeTruthy();
  });

  it('ventas de hoy, la semana y el mes al centavo, con la venta cancelada fuera', async () => {
    await montar();
    const [tabla] = await screen.findAllByRole('table');
    if (tabla === undefined) {
      throw new Error('tabla');
    }
    // Hoy: venta 116 + transferencia de orden 300.
    expect(celdaDe(tabla, 'Hoy', 'Ventas')).toBe('$416.00');
    expect(celdaDe(tabla, 'Esta semana', 'Ventas')).toBe('$416.00');
    expect(celdaDe(tabla, 'Este mes', 'Ventas')).toBe('$416.00');
    // El mes anterior (octubre) vendió $200: el mes sube 108.00 %.
    expect(celdaDe(tabla, 'Este mes', 'Comparado con el anterior')).toContain('Sube 108.00 %');
    expect(celdaDe(tabla, 'Este mes', 'Periodo anterior')).toContain('$200.00');
    // Ayer no hubo ventas: no hay contra qué comparar y no sale un porcentaje infinito.
    expect(celdaDe(tabla, 'Hoy', 'Comparado con el anterior')).toBe(
      'Sin ventas en el periodo anterior para comparar',
    );
  });

  it('los productos más vendidos salen por importe y por cantidad', async () => {
    await montar();
    expect(await screen.findByText('Por importe')).toBeTruthy();
    expect(screen.getByText('Por cantidad')).toBeTruthy();
    expect(screen.getAllByText('Vidrio 6 mm').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Chapa').length).toBeGreaterThanOrEqual(2);
  });

  it('los trabajos por estatus dan conteo y valor, y suman los pendientes', async () => {
    await montar();
    const tabla = (await screen.findAllByRole('table')).find((t) =>
      t.textContent.includes('En proceso'),
    );
    if (tabla === undefined) {
      throw new Error('tabla de estatus');
    }
    expect(celdaDe(tabla, 'En proceso', 'Trabajos')).toBe('1');
    expect(celdaDe(tabla, 'En proceso', 'Valor')).toBe('$1,000.00');
    expect(celdaDe(tabla, 'Entregado', 'Trabajos')).toBe('1');
    expect(screen.getByText(/Pendientes en producción: 1 · \$1,000\.00/)).toBeTruthy();
  });

  it('las cuentas por cobrar se agrupan por antigüedad y se resalta lo atrasado', async () => {
    await montar();
    expect(await screen.findByText('Cuentas por cobrar por antigüedad')).toBeTruthy();
    expect(screen.getByText('De 0 a 9 días')).toBeTruthy();
    expect(screen.getByText('De 10 a 19 días')).toBeTruthy();
    expect(screen.getByText('20 días o más')).toBeTruthy();
    expect(screen.getAllByText(/Atrasadas/).length).toBeGreaterThan(0);
  });

  it('los cobros por persona se suman por cajero con su nombre', async () => {
    await montar();
    const tablas = await screen.findAllByRole('table');
    const deHoy = tablas.find(
      (t) => t.textContent.includes('Persona') && t.textContent.includes('Ana'),
    );
    if (deHoy === undefined) {
      throw new Error('tabla de cajeros');
    }
    expect(celdaDe(deHoy, 'Ana', 'Total')).toBe('$116.00');
    expect(celdaDe(deHoy, 'Beto', 'Transferencia')).toBe('$300.00');
    expect(celdaDe(deHoy, 'Todas', 'Total')).toBe('$416.00');
  });

  it('los cobros por método cambian al elegir otro periodo', async () => {
    await montar();
    await screen.findByText('Cobros por método de pago');
    const selector = screen.getAllByLabelText('Periodo').at(-1);
    if (selector === undefined) {
      throw new Error('selector');
    }
    const resumen = (): string =>
      screen.getByText('Efectivo', { selector: 'dt' }).nextElementSibling?.textContent ?? '';
    expect(resumen()).toBe('$116.00');
    fireEvent.change(selector, { target: { value: 'DAY' } });
    expect(resumen()).toBe('$116.00');
    expect(screen.getByText('Cobros', { selector: 'dt' }).nextElementSibling?.textContent).toBe(
      '2',
    );
  });

  it('sin datos todo sale en cero y con avisos claros', async () => {
    await montar(admin, false);
    expect(await screen.findByText('Todavía no hay ventas en este periodo.')).toBeTruthy();
    expect(screen.getAllByText('No hubo cobros en este periodo.')).toHaveLength(3);
  });

  it('en el celular las tablas se apilan: todas llevan la clase y cada celda su rótulo', async () => {
    await montar();
    const tablas = await screen.findAllByRole('table');
    expect(tablas.length).toBeGreaterThan(4);
    for (const tabla of tablas) {
      expect(tabla.className).toContain('tabla--apilada');
      for (const celda of tabla.querySelectorAll('tbody td')) {
        expect(celda.getAttribute('data-label')).toBeTruthy();
      }
    }
    const css = readFileSync(resolve(process.cwd(), 'apps/web/src/shared/ui/estilos.css'), 'utf8');
    expect(css).toMatch(/@media \(max-width: 40rem\)[\s\S]*\.tabla--apilada td::before/);
    expect(css).toMatch(/\.tabla--apilada tr[\s\S]*display: block/);
  });
});

describe('porcentaje exacto', () => {
  it('se escribe con dos decimales, sin signo', () => {
    expect(formatearPorcentaje(1250)).toBe('12.50 %');
    expect(formatearPorcentaje(-2500)).toBe('25.00 %');
    expect(formatearPorcentaje(5)).toBe('0.05 %');
    expect(formatearPorcentaje(0)).toBe('0.00 %');
    expect(formatearPorcentaje(41_667)).toBe('416.67 %');
  });
});
