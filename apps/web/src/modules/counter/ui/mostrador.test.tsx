import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  asId,
  buildCustomer,
  convertQuoteToWorkOrder,
  createPriceRegistry,
  defaultRules,
  err,
  fixedClock,
  inMemorySyncOutbox,
  money,
  NO_FISCAL_PROFILE,
  ok,
  outboxCashShiftStore,
  outboxCounterSaleStore,
  outboxPaymentStore,
  outboxQuoteStore,
  outboxWorkOrderStore,
  seededRandom,
  toPlainLines,
  type CashDeps,
  type CounterDeps,
  type ManageCustomersDeps,
  type OrderDeps,
  type PrintDocument,
  type ProductReader,
  type Quote,
  type QuoteActor,
  type QuoteLine,
  type SellableProduct,
} from '@zammir/core';
import { clientesEnMemoriaDePrueba } from '@zammir/core/testing';
import { describe, expect, it, vi } from 'vitest';

import type { ImpresionDeTickets } from '../../printing/ui/impresion';
import { Mostrador, type MostradorProps } from './Mostrador';

const registro = (() => {
  const r = createPriceRegistry(defaultRules);
  if (!r.ok) {
    throw new Error('registro');
  }
  return r.value;
})();

const precio = (c: number) => {
  const r = money(c);
  if (!r.ok) {
    throw new Error('dinero');
  }
  return r.value;
};

const vidrio: SellableProduct = {
  id: asId<'Product'>('00000000-0000-4000-8000-00000000f001'),
  code: 'VC-6',
  name: 'Vidrio claro 6 mm',
  categoryId: asId<'Category'>('c-1'),
  kind: 'CUSTOM',
  chargeUnit: 'SQUARE_METER',
  listPrice: precio(28_000),
  isTaxExempt: false,
  ruleId: 'AREA',
  ruleParams: {},
};
const chapa: SellableProduct = {
  ...vidrio,
  id: asId<'Product'>('00000000-0000-4000-8000-00000000f002'),
  code: 'CH',
  name: 'Chapa de baño',
  kind: 'STANDARD',
  chargeUnit: 'PIECE',
  listPrice: precio(11_600),
  ruleId: 'PIECE',
};

function catalogo(productos: readonly SellableProduct[]): ProductReader {
  return {
    listSellable: () => Promise.resolve(ok(productos)),
    findSellable: (id) => {
      const p = productos.find((x) => x.id === id);
      return Promise.resolve(p === undefined ? err({ code: 'NOT_FOUND' as const }) : ok(p));
    },
  };
}

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

function lineaDeOrden(): QuoteLine {
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
    detail: '1 m²',
  };
}

async function montar(
  opciones: {
    actor?: QuoteActor | null;
    productos?: readonly SellableProduct[];
    conOrden?: boolean;
    impresion?: ImpresionDeTickets;
  } = {},
) {
  const reloj = fixedClock(new Date('2026-10-31T18:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const comunes = {
    idGenerator: ids,
    clock: reloj,
    random: seededRandom(6),
    device: { id: '00000000-0000-4000-8000-0000000000d1', series: 1 },
    outbox,
  };
  const deps: CounterDeps = {
    ...comunes,
    sales: outboxCounterSaleStore(outbox),
    payments: outboxPaymentStore(outbox),
  };
  const orderDeps: OrderDeps = {
    ...comunes,
    orders: outboxWorkOrderStore(outbox),
    payments: outboxPaymentStore(outbox),
    quotes: outboxQuoteStore(outbox),
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
  if (opciones.conOrden === true) {
    const q: Quote = {
      id: ids.newId<'Quote'>(),
      status: 'ACCEPTED',
      customerId: CLIENTE,
      siteAddress: null,
      lines: [lineaDeOrden()],
      userId: cajero.userId,
      tempFolio: 'T9-0001',
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
    await orderDeps.quotes.save(q);
    await convertQuoteToWorkOrder(orderDeps, cajero, q.id);
  }
  const porEnviar = vi.fn();
  const cash: CashDeps = {
    shifts: outboxCashShiftStore(outbox),
    payments: deps.payments,
    sales: deps.sales,
    outbox,
    idGenerator: ids,
    clock: reloj,
    device: { id: comunes.device.id },
  };
  const props: MostradorProps = {
    deps,
    orderDeps,
    cash,
    personas: [
      { id: cajero.userId, name: 'Beto' },
      { id: ADMIN_ID, name: 'Luis' },
    ],
    actor: opciones.actor === undefined ? cajero : opciones.actor,
    catalogo: catalogo(opciones.productos ?? [vidrio, chapa]),
    clientes,
    registry: registro,
    taxRateBps: 1600,
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
    ...(opciones.impresion === undefined ? {} : { impresion: opciones.impresion }),
    onPorEnviar: porEnviar,
  };
  render(
    <MemoryRouter>
      <Mostrador {...props} />
    </MemoryRouter>,
  );
  return { deps, orderDeps, outbox, porEnviar };
}

async function agregarChapa(): Promise<void> {
  fireEvent.change(await screen.findByLabelText('Buscar producto o servicio'), {
    target: { value: 'chapa' },
  });
  fireEvent.click(await screen.findByRole('button', { name: /Chapa de baño/ }));
  await screen.findByText('Chapa de baño', { selector: 'strong' });
}

describe('Mostrador', () => {
  it('sin una persona que haya entrado con su PIN, pide entrar', async () => {
    await montar({ actor: null });
    expect(await screen.findByRole('link', { name: 'Entrar con PIN' })).toBeTruthy();
  });

  it('un ticket vacío enseña qué hacer, y un catálogo vacío avisa que se revise primero', async () => {
    await montar({ productos: [] });
    expect(await screen.findByText('Busca un producto para empezar el ticket.')).toBeTruthy();
    expect(await screen.findByText(/Revisa primero tu catálogo/)).toBeTruthy();
  });

  it('una pieza entra al ticket con su importe y el total se actualiza al cambiar la cantidad', async () => {
    await montar();
    await agregarChapa();
    const total = () =>
      screen.getByText('Total', { selector: 'dt' }).nextElementSibling?.textContent;
    expect(total()).toBe('$116.00');
    fireEvent.click(screen.getByRole('button', { name: 'Una más: Chapa de baño' }));
    await waitFor(() => {
      expect(total()).toBe('$232.00');
    });
    expect(screen.getByLabelText('Cantidad: Chapa de baño').textContent).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Una menos: Chapa de baño' }));
    await waitFor(() => {
      expect(total()).toBe('$116.00');
    });
    expect(screen.getByRole('button', { name: 'Una menos: Chapa de baño' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('el vidrio a medida pide medidas y muestra el cálculo al centavo', async () => {
    await montar();
    fireEvent.change(await screen.findByLabelText('Buscar producto o servicio'), {
      target: { value: 'vidrio' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Vidrio claro 6 mm/ }));
    fireEvent.change(screen.getByLabelText('Ancho (cm)'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Alto (cm)'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al ticket' }));
    await screen.findByText(/120 cm × 80 cm × 2 = 1\.92 m² × \$280\.00 = \$537\.60/);
    expect(screen.getByText('Total', { selector: 'dt' }).nextElementSibling?.textContent).toBe(
      '$537.60',
    );
  });

  it('una medida mal escrita no agrega nada y dice qué hacer', async () => {
    await montar();
    fireEvent.change(await screen.findByLabelText('Buscar producto o servicio'), {
      target: { value: 'vidrio' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Vidrio claro 6 mm/ }));
    fireEvent.change(screen.getByLabelText('Ancho (cm)'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('Alto (cm)'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar al ticket' }));
    expect(await screen.findByText('Las medidas no son válidas.')).toBeTruthy();
    expect(screen.getByText('Busca un producto para empezar el ticket.')).toBeTruthy();
  });

  it('cobra en efectivo: muestra el cambio, el folio provisional y deja la venta en las de hoy', async () => {
    const { outbox, porEnviar } = await montar();
    await agregarChapa();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Cobrar' });
    fireEvent.change(within(dialogo).getByLabelText('Transferencia'), { target: { value: '0' } });
    fireEvent.change(within(dialogo).getByLabelText('Efectivo recibido'), {
      target: { value: '200' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Efectivo que se aplica'), {
      target: { value: '116' },
    });
    expect(within(dialogo).getByRole('status').textContent).toContain('$84.00');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar cobro' }));
    const aviso = await screen.findByText(/Venta registrada/, { selector: 'strong' });
    expect(aviso.parentElement?.textContent).toContain('Folio provisional T1-0001');
    expect(aviso.parentElement?.textContent).toContain('Cambio $84.00');
    expect(screen.getByText('Busca un producto para empezar el ticket.')).toBeTruthy();
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('T1-0001')).toBeTruthy();
    expect(within(tabla).getByText('Completada')).toBeTruthy();
    expect((await outbox.list()).map((o) => o.envelope.type)).toEqual(['CreateCounterSale']);
    expect(porEnviar).toHaveBeenCalled();
  });

  it('un cobro mixto suma efectivo y transferencia', async () => {
    const { deps } = await montar();
    await agregarChapa();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Cobrar' });
    fireEvent.change(within(dialogo).getByLabelText('Efectivo recibido'), {
      target: { value: '50' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Efectivo que se aplica'), {
      target: { value: '50' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Transferencia'), { target: { value: '66' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar cobro' }));
    await screen.findByText(/Venta registrada/, { selector: 'strong' });
    const pagos = await deps.payments.list();
    expect(pagos.map((p) => p.method).sort()).toEqual(['CASH', 'TRANSFER']);
    expect(pagos.reduce((s, p) => s + p.amountCents, 0)).toBe(11_600);
  });

  it('un cobro que no cubre el total dice que la venta se paga completa y no guarda nada', async () => {
    const { outbox } = await montar();
    await agregarChapa();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Cobrar' });
    fireEvent.change(within(dialogo).getByLabelText('Transferencia'), { target: { value: '50' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar cobro' }));
    expect(await screen.findByText('La venta se paga completa.')).toBeTruthy();
    expect(await outbox.list()).toHaveLength(0);
  });

  it('cobra el saldo de una orden desde el mostrador con el mismo cobro y cuenta a quien lo recibió', async () => {
    const { orderDeps } = await montar({ conOrden: true });
    const boton = await screen.findByRole('button', {
      name: /Cobrar saldo · T1-0001 · Ana López · \$116\.00/,
    });
    fireEvent.click(boton);
    const dialogo = await screen.findByRole('dialog', { name: 'Cobrar' });
    fireEvent.change(within(dialogo).getByLabelText('Transferencia'), { target: { value: '58' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar cobro' }));
    expect(
      await screen.findByRole('button', { name: /Cobrar saldo · .* · \$58\.00/ }),
    ).toBeTruthy();
    const pagos = await orderDeps.payments.list();
    expect(pagos).toHaveLength(1);
    expect(pagos[0]).toMatchObject({ userId: cajero.userId, kind: 'DEPOSIT', amountCents: 5_800 });
  });

  it('sin saldos por cobrar lo dice', async () => {
    await montar();
    expect(await screen.findByText('No hay órdenes con saldo por cobrar.')).toBeTruthy();
  });

  it('un administrador cancela una venta con motivo; un cajero necesita el PIN de uno', async () => {
    await montar({ actor: admin });
    await agregarChapa();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }));
    await screen.findByText(/Venta registrada/, { selector: 'strong' });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar venta' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Falta el motivo.')).toBeTruthy();
    fireEvent.change(within(dialogo).getByLabelText('Motivo'), { target: { value: 'Equivocada' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Continuar' }));
    await waitFor(() => {
      expect(screen.getByText('Cancelada')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Cancelar venta' })).toBeNull();
  });

  it('un cajero cancela solo con el PIN de un administrador', async () => {
    await montar();
    await agregarChapa();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }));
    await screen.findByText(/Venta registrada/, { selector: 'strong' });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar venta' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Motivo'), { target: { value: 'Equivocada' } });
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
      expect(screen.getByText('Cancelada')).toBeTruthy();
    });
  });
});

describe('Mostrador · impresión', () => {
  function impresionFalsa(falla: string | null = null) {
    const impresos: PrintDocument[] = [];
    const impresion: ImpresionDeTickets = {
      width: 32,
      business: { name: 'ZAMMIR (datos de prueba)', phone: null, address: null },
      selfInvoicingLegend: 'Factura en 30 días.',
      publicBaseUrl: null,
      estado: () => Promise.resolve({ state: 'READY', name: 'PT-210' }),
      conectar: () => Promise.resolve(null),
      imprimir: (doc) => {
        if (falla !== null) {
          return Promise.resolve({ error: falla });
        }
        impresos.push(doc);
        return Promise.resolve({ via: 'Impresora Bluetooth' });
      },
    };
    return { impresion, impresos };
  }

  async function cobrarUnaChapa(): Promise<void> {
    await agregarChapa();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Cobrar' });
    fireEvent.change(within(dialogo).getByLabelText('Transferencia'), { target: { value: '0' } });
    fireEvent.change(within(dialogo).getByLabelText('Efectivo recibido'), {
      target: { value: '200' },
    });
    fireEvent.change(within(dialogo).getByLabelText('Efectivo que se aplica'), {
      target: { value: '116' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar cobro' }));
    await screen.findByText(/Venta registrada/, { selector: 'strong' });
  }

  it('sin impresora configurada no se ofrece imprimir', async () => {
    await montar();
    await cobrarUnaChapa();
    expect(screen.queryByRole('button', { name: 'Imprimir ticket' })).toBeNull();
    expect(screen.queryByText('Impresora de tickets')).toBeNull();
  });

  it('muestra el estado de la impresora y manda una página de prueba', async () => {
    const { impresion, impresos } = impresionFalsa();
    await montar({ impresion });
    expect(await screen.findByText(/Lista · PT-210/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir prueba' }));
    expect(await screen.findByText(/Ticket enviado a la impresora/)).toBeTruthy();
    expect(impresos[0]?.title).toBe('PRUEBA DE IMPRESORA');
  });

  it('imprime el ticket de la venta recién cobrada, con su cambio y el nombre de quien cobró', async () => {
    const { impresion, impresos } = impresionFalsa();
    await montar({ impresion });
    await cobrarUnaChapa();
    fireEvent.click(await screen.findByRole('button', { name: 'Imprimir ticket' }));
    await waitFor(() => {
      expect(impresos).toHaveLength(1);
    });
    const texto = toPlainLines(impresos[0]!).join(' | ');
    expect(texto).toContain('VENTA');
    expect(texto).toContain('Folio T1-0001');
    expect(texto).toContain('Atendió: Beto');
    expect(texto).toContain('Chapa de baño');
    expect(texto).toContain('Cambio');
    expect(texto).not.toContain('REIMPRESIÓN');
    expect(texto).toContain('Factura en 30 días.');
  });

  it('reimprimir una venta de hoy marca el ticket como reimpresión', async () => {
    const { impresion, impresos } = impresionFalsa();
    await montar({ impresion });
    await cobrarUnaChapa();
    fireEvent.click(await screen.findByRole('button', { name: 'Reimprimir ticket' }));
    await waitFor(() => {
      expect(impresos).toHaveLength(1);
    });
    expect(toPlainLines(impresos[0]!).join(' | ')).toContain('REIMPRESIÓN');
  });

  it('si el ticket no sale dice qué hacer y la venta sigue guardada', async () => {
    const { impresion } = impresionFalsa('PRINTER_UNAVAILABLE');
    await montar({ impresion });
    await cobrarUnaChapa();
    fireEvent.click(await screen.findByRole('button', { name: 'Imprimir ticket' }));
    expect(await screen.findByText('No se pudo hablar con la impresora.')).toBeTruthy();
    expect(screen.getAllByText('T1-0001').length).toBeGreaterThan(0);
  });
});
