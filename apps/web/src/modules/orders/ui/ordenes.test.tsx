import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  asId,
  attachOrderPhoto,
  buildCustomer,
  err,
  fixedClock,
  inMemoryPhotoStore,
  inMemorySyncOutbox,
  ok,
  outboxPaymentStore,
  outboxQuoteStore,
  outboxWorkOrderStore,
  NO_FISCAL_PROFILE,
  seededRandom,
  type ManageCustomersDeps,
  type OrderDeps,
  type Quote,
  type QuoteActor,
  type QuoteLine,
} from '@zammir/core';
import { clientesEnMemoriaDePrueba } from '@zammir/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { Ordenes, type OrdenesProps } from './Ordenes';

const CLIENTE = asId<'Customer'>('00000000-0000-4000-8000-00000000c001');
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

function linea(): QuoteLine {
  return {
    id: ids.newId<'Line'>(),
    productId: null,
    name: 'Vidrio claro 6 mm',
    chargeUnit: 'SQUARE_METER',
    unitPriceCents: 11_600,
    catalogPriceCents: 11_600,
    ruleId: 'AREA',
    ruleParams: {},
    widthMm: 1000,
    heightMm: 1000,
    quantity: 1,
    displayUnit: 'cm',
    baseCents: 10_000,
    taxCents: 1_600,
    lineTotalCents: 11_600,
    isTaxExempt: false,
    detail: '1 m² × $116.00',
  };
}

function aceptada(): Quote {
  return {
    id: ids.newId<'Quote'>(),
    status: 'ACCEPTED',
    customerId: CLIENTE,
    siteAddress: null,
    lines: [linea()],
    userId: cajero.userId,
    tempFolio: 'T1-0001',
    folio: 'COT-2026-0001',
    publicCode: 'ABCDEFGH',
    issuedAt: '2026-10-31T15:00:00.000Z',
    validUntil: '2026-11-15',
    conditionsText: 'x',
    privacyNoticeVersion: null,
    catalogVersion: null,
    discountAuthorizedBy: null,
    syncStatus: 'SENT',
    reviewReason: null,
    updatedAt: '2026-10-31T15:00:00.000Z',
  };
}

async function montar(opciones: { actor?: QuoteActor | null } = {}) {
  const reloj = fixedClock(new Date('2026-10-31T18:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const deps: OrderDeps = {
    orders: outboxWorkOrderStore(outbox),
    payments: outboxPaymentStore(outbox),
    quotes: outboxQuoteStore(outbox),
    outbox,
    idGenerator: ids,
    clock: reloj,
    random: seededRandom(4),
    device: { id: '00000000-0000-4000-8000-0000000000d1', series: 1 },
    settings: {
      depositPercentBps: 5_000,
      requireDepositToStart: true,
      warrantyMonthsDefault: null,
    },
  };
  const { customers } = clientesEnMemoriaDePrueba();
  const nuevo = buildCustomer(CLIENTE, {
    name: 'Ana López',
    phone: '5512345678',
    email: null,
    notes: null,
    fiscal: NO_FISCAL_PROFILE,
    privacyNoticeVersion: null,
  });
  if (nuevo.ok) {
    await customers.create(nuevo.value);
  }
  const clientes: ManageCustomersDeps = { customers, idGenerator: ids };
  const photos = inMemoryPhotoStore();
  const cotizacion = aceptada();
  await deps.quotes.save(cotizacion);
  const porEnviar = vi.fn();
  const props: OrdenesProps = {
    deps,
    actor: opciones.actor === undefined ? cajero : opciones.actor,
    clientes,
    personas: [
      { id: cajero.userId, name: 'Ricardo' },
      { id: ADMIN_ID, name: 'Luis' },
    ],
    autorizacion: {
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
    },
    fotos: {
      listar: (orderId) => photos.listByOrder(orderId),
      agregar: async (orderId, archivo) => {
        const r = await attachOrderPhoto(
          {
            orders: deps.orders,
            photos,
            compressor: {
              compress: (o) => Promise.resolve(ok({ bytes: o.bytes, width: 800, height: 600 })),
            },
            idGenerator: ids,
            clock: reloj,
          },
          opciones.actor === undefined ? cajero : (opciones.actor ?? cajero),
          orderId,
          archivo,
        );
        return r.ok ? null : r.error.code;
      },
    },
    onPorEnviar: porEnviar,
  };
  render(
    <MemoryRouter>
      <Ordenes {...props} />
    </MemoryRouter>,
  );
  return { deps, outbox, porEnviar, cotizacion, photos };
}

async function crearOrden(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: /Crear orden de trabajo/ }));
  await screen.findByRole('heading', { name: /T1-0001 · Ana López/ });
}

describe('Órdenes de trabajo', () => {
  it('sin una persona que haya entrado con su PIN, pide entrar', async () => {
    await montar({ actor: null });
    expect(await screen.findByRole('link', { name: 'Entrar con PIN' })).toBeTruthy();
  });

  it('una lista vacía enseña qué hacer', async () => {
    await montar();
    expect(await screen.findByText(/Cuando un cliente acepte una cotización/)).toBeTruthy();
  });

  it('convierte la cotización aceptada en un toque: orden en espera con folio provisional y anticipo', async () => {
    const { outbox } = await montar();
    await crearOrden();
    expect(screen.getByText(/En espera/)).toBeTruthy();
    expect(screen.getByText(/Folio provisional T1-0001/)).toBeTruthy();
    // Anticipo exigido: 50 % de $116.00, redondeado hacia arriba.
    const totales = screen.getByText('Anticipo exigido').nextElementSibling;
    expect(totales?.textContent).toBe('$58.00');
    expect((await outbox.list()).map((o) => o.envelope.type)).toEqual(['CreateWorkOrder']);
  });

  it('cobra el anticipo sugerido por transferencia y deja el saldo calculado', async () => {
    const { porEnviar } = await montar();
    await crearOrden();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Cobrar' });
    expect(within(dialogo).getByText('$58.00', { selector: 'strong' })).toBeTruthy();
    fireEvent.change(within(dialogo).getByLabelText('Referencia de la transferencia (opcional)'), {
      target: { value: 'SPEI 99' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar cobro' }));
    await waitFor(() => {
      expect(screen.getByText('Pagado').nextElementSibling?.textContent).toBe('$58.00');
    });
    expect(screen.getByText('Saldo', { selector: 'dt' }).nextElementSibling?.textContent).toBe(
      '$58.00',
    );
    expect(screen.getByText(/Anticipo · Transferencia · \$58\.00/)).toBeTruthy();
    expect(porEnviar).toHaveBeenCalled();
  });

  it('en efectivo muestra el cambio antes de registrar y lo guarda en el pago', async () => {
    await montar();
    await crearOrden();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Cobrar' });
    fireEvent.change(within(dialogo).getByLabelText('Transferencia'), { target: { value: '0' } });
    fireEvent.change(within(dialogo).getByLabelText('Efectivo recibido'), {
      target: { value: '100' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Efectivo que se aplica'), {
      target: { value: '58' },
    });
    expect(within(dialogo).getByRole('status').textContent).toContain('$42.00');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar cobro' }));
    expect(
      await screen.findByText(/Anticipo · Efectivo · \$58\.00 · Cambio \$42\.00/),
    ).toBeTruthy();
  });

  it('un cobro mayor al saldo dice qué hacer y no guarda nada', async () => {
    const { outbox } = await montar();
    await crearOrden();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Cobrar' });
    fireEvent.change(within(dialogo).getByLabelText('Transferencia'), { target: { value: '500' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar cobro' }));
    expect(await screen.findByText('El cobro es mayor que el saldo.')).toBeTruthy();
    expect((await outbox.list()).length).toBe(1);
  });

  it('un cajero no puede empezar sin anticipo: pide el PIN de un administrador', async () => {
    await montar();
    await crearOrden();
    fireEvent.click(screen.getByRole('button', { name: /Avanzar a En proceso/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/necesita el PIN de un administrador/)).toBeTruthy();
    fireEvent.change(within(dialogo).getByLabelText('PIN del administrador'), {
      target: { value: '000000' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('El PIN no es correcto.')).toBeTruthy();
    fireEvent.change(within(dialogo).getByLabelText('PIN del administrador'), {
      target: { value: '482915' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Continuar' }));
    await waitFor(() => {
      expect(screen.getByText(/En proceso/, { selector: 'strong' })).toBeTruthy();
    });
  });

  it('con anticipo registrado avanza sin pedir PIN, hasta listo', async () => {
    await montar();
    await crearOrden();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }));
    await screen.findByText(/Anticipo · Transferencia/);
    fireEvent.click(screen.getByRole('button', { name: /Avanzar a En proceso/ }));
    await waitFor(() => {
      expect(screen.getByText('En proceso', { selector: 'strong' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Avanzar a Listo/ }));
    await waitFor(() => {
      expect(screen.getByText('Listo', { selector: 'strong' })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Entregar' })).toBeTruthy();
  });

  it('entregar con saldo pide el PIN de un administrador y un motivo; con ellos se entrega', async () => {
    await montar();
    await crearOrden();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }));
    await screen.findByText(/Anticipo · Transferencia/);
    fireEvent.click(screen.getByRole('button', { name: /Avanzar a En proceso/ }));
    await screen.findByText('En proceso', { selector: 'strong' });
    fireEvent.click(screen.getByRole('button', { name: /Avanzar a Listo/ }));
    await screen.findByText('Listo', { selector: 'strong' });
    fireEvent.click(screen.getByRole('button', { name: 'Entregar' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Motivo'), {
      target: { value: 'Liquida el viernes' },
    });
    fireEvent.change(within(dialogo).getByLabelText('PIN del administrador'), {
      target: { value: '482915' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Continuar' }));
    await waitFor(() => {
      expect(screen.getByText('Entregado', { selector: 'strong' })).toBeTruthy();
    });
  });

  it('un administrador cancela con motivo; el motivo es obligatorio', async () => {
    await montar({ actor: admin });
    await crearOrden();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar la orden' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Falta el motivo.')).toBeTruthy();
    fireEvent.change(within(dialogo).getByLabelText('Motivo'), { target: { value: 'Duplicada' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Continuar' }));
    await waitFor(() => {
      expect(screen.getByText('Cancelado', { selector: 'strong' })).toBeTruthy();
    });
  });

  it('guarda responsables, fecha y notas', async () => {
    const { outbox } = await montar();
    await crearOrden();
    fireEvent.change(screen.getByLabelText('Quién mide'), { target: { value: cajero.userId } });
    fireEvent.change(screen.getByLabelText('Fecha estimada de entrega'), {
      target: { value: '2026-11-20' },
    });
    fireEvent.change(screen.getByLabelText('Notas'), { target: { value: 'Llevar escalera' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar datos' }));
    expect(await screen.findByText('Datos guardados en la tablet.')).toBeTruthy();
    const ops = (await outbox.list()).map((o) => o.envelope.type);
    expect(ops).toEqual(['CreateWorkOrder', 'UpdateWorkOrder']);
  });

  it('guarda una foto de la medición en la tablet, sin tocar la cola de envío', async () => {
    const { outbox, photos } = await montar();
    await crearOrden();
    expect(screen.getByText(/Todavía no hay fotos/)).toBeTruthy();
    const antes = (await outbox.list()).length;
    const archivo = new File([new Uint8Array([1, 2, 3, 4])], 'medicion.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Agregar foto'), { target: { files: [archivo] } });
    expect(await screen.findByText('Foto guardada en la tablet.')).toBeTruthy();
    expect(screen.getByText(/Fotos de la medición 1 · 0 KB · Guardada en la tablet/)).toBeTruthy();
    expect(await photos.pending()).toHaveLength(1);
    expect((await outbox.list()).length).toBe(antes);
  });

  it('la lista filtra por estatus y muestra el saldo de cada orden', async () => {
    await montar();
    await crearOrden();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a las órdenes' }));
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getAllByText('$116.00', { selector: 'td' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /^Listo \(0\)$/ }));
    await waitFor(() => {
      expect(screen.queryByRole('table')).toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: /^En espera \(1\)$/ }));
    expect(await screen.findByRole('table')).toBeTruthy();
  });
});
