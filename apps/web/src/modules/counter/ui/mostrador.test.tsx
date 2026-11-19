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
  type CashDeps,
  type CounterDeps,
  type DocumentPrinter,
  type ManageCustomersDeps,
  type OrderDeps,
  type ProductReader,
  type ShareService,
  type Quote,
  type QuoteActor,
  type QuoteDocument,
  type QuoteLine,
  type SellableProduct,
} from '@zammir/core';
import { clientesEnMemoriaDePrueba } from '@zammir/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { Mostrador, type ComprobanteDelMostrador, type MostradorProps } from './Mostrador';
import { marcarComoImpresa } from '../../documents/ui/registro-de-impresiones';

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
    comprobante?: ComprobanteDelMostrador;
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
    ...(opciones.comprobante === undefined ? {} : { comprobante: opciones.comprobante }),
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

  it('la franja de ventas de hoy cuenta lo vendido y, al cancelar, lo saca del total', async () => {
    await montar({ actor: admin });
    await agregarChapa();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar cobro' }));
    await screen.findByText(/Venta registrada/, { selector: 'strong' });
    const franja = within(
      await screen.findByRole('region', { name: 'Resumen de las ventas de hoy' }),
    );
    expect(
      within(franja.getByRole('group', { name: 'Vendido hoy' })).getByText('$116.00'),
    ).toBeTruthy();
    expect(within(franja.getByRole('group', { name: 'Tickets' })).getByText('1')).toBeTruthy();
    const sinCancelar = within(franja.getByRole('group', { name: 'Canceladas' }));
    expect(sinCancelar.getByText('0')).toBeTruthy();
    expect(sinCancelar.getByText('Ninguna')).toBeTruthy();
    // La cancelación es una acción destructiva por renglón: contorno rojo, no un botón lleno.
    const cancelar = screen.getByRole('button', { name: 'Cancelar venta' });
    expect(cancelar).toHaveClass('boton--peligro-suave');
    fireEvent.click(cancelar);
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Motivo'), { target: { value: 'Equivocada' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Continuar' }));
    await waitFor(() => {
      expect(screen.getByText('Cancelada')).toBeTruthy();
    });
    const despues = within(screen.getByRole('region', { name: 'Resumen de las ventas de hoy' }));
    expect(
      within(despues.getByRole('group', { name: 'Vendido hoy' })).getByText('$0.00'),
    ).toBeTruthy();
    expect(within(despues.getByRole('group', { name: 'Tickets' })).getByText('0')).toBeTruthy();
    const canceladas = within(despues.getByRole('group', { name: 'Canceladas' }));
    expect(canceladas.getByText('1')).toBeTruthy();
    expect(canceladas.getByText('No suman al total')).toBeTruthy();
  });

  it('la venta va antes que el historial de turnos, para que lo importante quede arriba', async () => {
    await montar({ actor: admin });
    const venta = await screen.findByRole('region', { name: 'Venta rápida' });
    const turnos = screen.getByRole('region', { name: 'Turnos' });
    const hoy = screen.getByRole('region', { name: 'Ventas de hoy' });
    const antes = (a: HTMLElement, b: HTMLElement): boolean =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(antes(venta, hoy)).toBe(true);
    expect(antes(hoy, turnos)).toBe(true);
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
      name: /Cobrar saldo · T1-0001 · Ana López.*\$116\.00/,
    });
    fireEvent.click(boton);
    const dialogo = await screen.findByRole('dialog', { name: 'Cobrar' });
    fireEvent.change(within(dialogo).getByLabelText('Transferencia'), { target: { value: '58' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar cobro' }));
    expect(await screen.findByRole('button', { name: /Cobrar saldo · .*\$58\.00/ })).toBeTruthy();
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

describe('Mostrador · comprobante en hoja carta', () => {
  async function primerGrupo(): Promise<HTMLElement> {
    const grupos = await screen.findAllByRole('group', { name: 'Enviar o imprimir' });
    const primero = grupos[0];
    if (primero === undefined) {
      throw new Error('falta el grupo de acciones');
    }
    return primero;
  }

  function comprobanteFalso(opciones: { falla?: boolean; autofacturacion?: boolean } = {}) {
    const impresos: { documento: QuoteDocument; copia: boolean }[] = [];
    const compartidos: string[] = [];
    const impresora: DocumentPrinter = {
      print: (documento, o) => {
        if (opciones.falla === true) {
          return Promise.resolve(err({ code: 'PRINT_FAILED' as const }));
        }
        impresos.push({ documento, copia: o?.copia === true });
        return Promise.resolve(ok(undefined));
      },
    };
    const share: ShareService = {
      canShareFile: () => true,
      shareFile: (archivo, mensaje) => {
        compartidos.push(`${archivo.name} | ${mensaje}`);
        return Promise.resolve(ok(undefined));
      },
      openLink: vi.fn(),
      download: vi.fn(),
    };
    const comprobante: ComprobanteDelMostrador = {
      deps: {
        negocio: { name: 'ZAMMIR (datos de prueba)', phone: null, address: null },
        condiciones: 'Sin cambios ni devoluciones.',
        autofacturacion: opciones.autofacturacion ?? false,
        leyendaDeAutofacturacion: null,
        direccionBase: null,
        qrMatrix: () => [[true]],
      },
      renderer: { render: () => Promise.resolve(ok(Uint8Array.of(0x25, 0x50, 0x44, 0x46))) },
      share,
      impresora,
    };
    return { comprobante, impresos, compartidos };
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

  it('sin comprobante configurado no se ofrece enviar ni imprimir', async () => {
    await montar();
    await cobrarUnaChapa();
    expect(screen.queryByRole('group', { name: 'Enviar o imprimir' })).toBeNull();
  });

  it('al cobrar, "Enviar por WhatsApp" e "Imprimir" aparecen juntos, con el envío primero', async () => {
    const { comprobante } = comprobanteFalso();
    await montar({ comprobante });
    await cobrarUnaChapa();
    const grupo = await primerGrupo();
    const botones = within(grupo).getAllByRole('button');
    expect(botones.map((b) => b.textContent)).toEqual(['Enviar por WhatsApp', 'Imprimir']);
  });

  it('imprimir abre la impresión con el comprobante de la venta, al centavo y sin factura', async () => {
    const { comprobante, impresos } = comprobanteFalso();
    await montar({ comprobante });
    await cobrarUnaChapa();
    const grupo = await primerGrupo();
    fireEvent.click(within(grupo).getByRole('button', { name: 'Imprimir' }));
    expect(await screen.findByText('Se abrió la impresión. Elija su impresora.')).toBeTruthy();
    expect(impresos).toHaveLength(1);
    const { documento, copia } = impresos[0] as { documento: QuoteDocument; copia: boolean };
    expect(documento.labels.title).toBe('Comprobante de venta');
    expect(documento.folioLabel).toBe('Folio provisional T1-0001');
    expect(documento.total).toBe('$116.00');
    expect(documento.receipt?.attendedBy).toBe('Atendió: Beto');
    expect(documento.receipt?.paymentLines[0]).toContain('Cambio $84.00');
    expect(documento.receipt?.qr).toBeNull();
    expect(copia).toBe(false);
  });

  it('la segunda vez que se imprime la misma venta sale marcada COPIA', async () => {
    const { comprobante, impresos } = comprobanteFalso();
    await montar({ comprobante });
    await cobrarUnaChapa();
    const imprimir = async (): Promise<void> => {
      const grupo = await primerGrupo();
      fireEvent.click(within(grupo).getByRole('button', { name: 'Imprimir' }));
    };
    await imprimir();
    await waitFor(() => {
      expect(impresos).toHaveLength(1);
    });
    await imprimir();
    await waitFor(() => {
      expect(impresos).toHaveLength(2);
    });
    expect(impresos.map((i) => i.copia)).toEqual([false, true]);
  });

  it('una venta ya impresa en esta tablet sale como copia aunque se abra la pantalla de nuevo', async () => {
    const { comprobante, impresos } = comprobanteFalso();
    const { deps } = await montar({ comprobante });
    await cobrarUnaChapa();
    const venta = await primerGrupo();
    // Como si ya se hubiera impreso antes: se marca desde otra apertura de la pantalla.
    marcarComoImpresa((await deps.sales.list())[0]?.id ?? '');
    fireEvent.click(within(venta).getByRole('button', { name: 'Imprimir' }));
    await waitFor(() => {
      expect(impresos).toHaveLength(1);
    });
    expect(impresos[0]?.copia).toBe(true);
  });

  it('enviar por WhatsApp comparte el PDF del comprobante con el menú del dispositivo', async () => {
    const { comprobante, compartidos } = comprobanteFalso();
    await montar({ comprobante });
    await cobrarUnaChapa();
    const grupo = await primerGrupo();
    fireEvent.click(within(grupo).getByRole('button', { name: 'Enviar por WhatsApp' }));
    expect(await screen.findByText('Listo: elige WhatsApp en el menú.')).toBeTruthy();
    expect(compartidos).toHaveLength(1);
    expect(compartidos[0]).toContain('Comprobante-T1-0001.pdf');
    expect(compartidos[0]).toContain('Hola, le comparto el comprobante de su compra T1-0001');
  });

  it('si no se puede imprimir dice qué hacer y la venta sigue guardada', async () => {
    const { comprobante } = comprobanteFalso({ falla: true });
    await montar({ comprobante });
    await cobrarUnaChapa();
    const grupo = await primerGrupo();
    fireEvent.click(within(grupo).getByRole('button', { name: 'Imprimir' }));
    expect(await screen.findByText('No se pudo abrir la impresión.')).toBeTruthy();
    expect(screen.getByText(/Guarde el PDF o compártalo por WhatsApp/)).toBeTruthy();
    expect(screen.getAllByText('T1-0001').length).toBeGreaterThan(0);
  });

  it('con la facturación encendida el comprobante lleva el QR', async () => {
    const { comprobante, impresos } = comprobanteFalso({ autofacturacion: true });
    await montar({ comprobante });
    await cobrarUnaChapa();
    const grupo = await primerGrupo();
    fireEvent.click(within(grupo).getByRole('button', { name: 'Imprimir' }));
    await waitFor(() => {
      expect(impresos).toHaveLength(1);
    });
    expect(impresos[0]?.documento.receipt?.qr).not.toBeNull();
  });
});
