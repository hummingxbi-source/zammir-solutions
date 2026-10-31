import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  asId,
  createPriceRegistry,
  defaultRules,
  err,
  fixedClock,
  inMemorySyncOutbox,
  money,
  ok,
  outboxQuoteStore,
  seededRandom,
  type IssueQuoteDeps,
  type ManageCustomersDeps,
  type ProductReader,
  type QuoteActor,
  type SellableProduct,
  type ShareableFile,
  type ShareService,
} from '@zammir/core';
import { clientesEnMemoriaDePrueba } from '@zammir/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { Cotizador, type CotizadorProps } from './Cotizador';

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
const instalacion: SellableProduct = {
  ...vidrio,
  id: asId<'Product'>('00000000-0000-4000-8000-00000000f002'),
  code: 'INST',
  name: 'Instalación',
  kind: 'SERVICE',
  chargeUnit: 'SERVICE',
  listPrice: precio(50_000),
  ruleId: 'SERVICE',
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

const cajero: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
  role: 'STAFF',
};
const admin: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a002'),
  role: 'ADMIN',
};

let contador = 0;
const ids = {
  newId: <E extends string>() => {
    contador += 1;
    return asId<E>(`00000000-0000-4000-8000-${String(contador).padStart(12, '0')}`);
  },
};

function montar(
  opciones: { actor?: QuoteActor | null; productos?: readonly SellableProduct[] } = {},
) {
  const reloj = fixedClock(new Date('2026-10-30T18:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const store = outboxQuoteStore(outbox);
  const deps: IssueQuoteDeps = {
    store,
    idGenerator: ids,
    clock: reloj,
    registry: registro,
    taxRateBps: 1600,
    outbox,
    random: seededRandom(3),
    device: { id: '00000000-0000-4000-8000-0000000000d1', series: 1 },
    settings: {
      validityDays: 15,
      conditionsText: 'Anticipo del 50%.\nSaldo contra entrega.',
      privacyNoticeVersion: 1,
      catalogVersion: 1,
    },
  };
  const { customers } = clientesEnMemoriaDePrueba();
  const clientes: ManageCustomersDeps = { customers, idGenerator: ids };
  const llamadas: string[] = [];
  const archivos: ShareableFile[] = [];
  const share: ShareService = {
    canShareFile: () => true,
    shareFile: (archivo) => {
      archivos.push(archivo);
      llamadas.push('compartir');
      return Promise.resolve(ok(undefined));
    },
    openLink: (url) => llamadas.push(`enlace:${url}`),
    download: () => llamadas.push('descarga'),
  };
  const porEnviar = vi.fn();
  const props: CotizadorProps = {
    deps,
    actor: opciones.actor === undefined ? cajero : opciones.actor,
    catalogo: catalogo(opciones.productos ?? [vidrio, instalacion]),
    clientes,
    renderer: { render: () => Promise.resolve(ok(Uint8Array.of(0x25, 0x50, 0x44, 0x46))) },
    share,
    negocio: { name: 'Vidriería de prueba', phone: null, address: null },
    condicionesPorDefecto: 'Condiciones por defecto',
    autorizacion: {
      administradores: () => Promise.resolve([{ id: admin.userId, name: 'Luis' }]),
      autorizar: (adminId, pin) =>
        Promise.resolve(
          pin === '482915'
            ? ok({
                adminId: asId<'User'>(adminId),
                authorizedAt: new Date('2026-10-30T18:00:00.000Z'),
              })
            : err({ code: 'AUTH_FAILED' as const }),
        ),
    },
    onPorEnviar: porEnviar,
  };
  render(
    <MemoryRouter>
      <Cotizador {...props} />
    </MemoryRouter>,
  );
  return { deps, outbox, store, llamadas, archivos, porEnviar };
}

async function empezarConClienteNuevo(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: 'Nueva cotización' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cliente nuevo' }));
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana López' } });
  fireEvent.change(screen.getByLabelText('WhatsApp (10 dígitos)'), {
    target: { value: '55 1234 5678' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }));
  await screen.findByRole('heading', { name: /Cotizador · Ana López/ });
}

async function agregarVidrio(): Promise<void> {
  fireEvent.change(await screen.findByLabelText('Buscar producto o servicio'), {
    target: { value: 'vidrio' },
  });
  fireEvent.click(await screen.findByRole('button', { name: /Vidrio claro 6 mm/ }));
  fireEvent.change(screen.getByLabelText('Ancho (cm)'), { target: { value: '120' } });
  fireEvent.change(screen.getByLabelText('Alto (cm)'), { target: { value: '80' } });
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar a la cotización' }));
  await waitFor(() => {
    expect(screen.getAllByText(/1\.92 m²/).length).toBeGreaterThan(0);
  });
}

describe('Cotizador', () => {
  it('sin una persona que haya entrado con su PIN, pide entrar', async () => {
    montar({ actor: null });
    expect(await screen.findByRole('link', { name: 'Entrar con PIN' })).toBeTruthy();
  });

  it('arma una cotización con un cliente nuevo y muestra el cálculo y el total al centavo', async () => {
    montar();
    await empezarConClienteNuevo();
    await agregarVidrio();
    // El cálculo visible: 120 cm × 80 cm × 2 = 1.92 m² × $280.00 = $537.60
    expect(
      screen.getAllByText(/120 cm × 80 cm × 2 = 1\.92 m² × \$280\.00 = \$537\.60/).length,
    ).toBeGreaterThan(0);
    const totales = screen.getAllByText('$537.60');
    expect(totales.length).toBeGreaterThan(0);
    // La vista previa en vivo ya trae el cliente y el concepto.
    const vista = screen.getByRole('article', { name: 'Vista previa del documento' });
    expect(within(vista).getByText('Ana López', { exact: false })).toBeTruthy();
    expect(within(vista).getByText('Vidrio claro 6 mm')).toBeTruthy();
  });

  it('una medida mal escrita no agrega el concepto y dice qué hacer', async () => {
    montar();
    await empezarConClienteNuevo();
    fireEvent.change(await screen.findByLabelText('Buscar producto o servicio'), {
      target: { value: 'vidrio' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Vidrio claro 6 mm/ }));
    fireEvent.change(screen.getByLabelText('Ancho (cm)'), { target: { value: '12x' } });
    fireEvent.change(screen.getByLabelText('Alto (cm)'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la cotización' }));
    expect(await screen.findByText('Una medida no es válida.')).toBeTruthy();
    expect(screen.getByText('Todavía no hay conceptos. Agrega el primero.')).toBeTruthy();
  });

  it('los campos de medida abren el teclado numérico', async () => {
    montar();
    await empezarConClienteNuevo();
    fireEvent.change(await screen.findByLabelText('Buscar producto o servicio'), {
      target: { value: 'vidrio' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Vidrio claro 6 mm/ }));
    expect(screen.getByLabelText('Ancho (cm)').getAttribute('inputmode')).toBe('decimal');
    expect(screen.getByLabelText('Cantidad').getAttribute('inputmode')).toBe('numeric');
  });

  it('un servicio se agrega solo con su cantidad', async () => {
    montar();
    await empezarConClienteNuevo();
    fireEvent.change(await screen.findByLabelText('Buscar producto o servicio'), {
      target: { value: 'instal' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Instalación/ }));
    expect(screen.queryByLabelText('Ancho (cm)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la cotización' }));
    await waitFor(() => {
      expect(screen.getAllByText('$500.00').length).toBeGreaterThan(0);
    });
  });

  it('un cajero necesita el PIN de un administrador para un descuento; con el PIN correcto se aplica', async () => {
    montar();
    await empezarConClienteNuevo();
    await agregarVidrio();
    fireEvent.click(screen.getByRole('button', { name: 'Dar descuento' }));
    const dialogo = await screen.findByRole('dialog');
    expect(
      within(dialogo).getByText('Un descuento necesita el PIN de un administrador.'),
    ).toBeTruthy();
    fireEvent.change(within(dialogo).getByLabelText('Precio nuevo por unidad (con IVA)'), {
      target: { value: '250' },
    });
    fireEvent.change(within(dialogo).getByLabelText('PIN del administrador'), {
      target: { value: '000000' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar descuento' }));
    expect(await within(dialogo).findByText('El PIN no es correcto.')).toBeTruthy();
    fireEvent.change(within(dialogo).getByLabelText('PIN del administrador'), {
      target: { value: '482915' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar descuento' }));
    // 1.92 m² × $250.00 = $480.00
    await waitFor(() => {
      expect(screen.getAllByText('$480.00').length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByText(/con descuento autorizado/).length).toBeGreaterThan(0);
  });

  it('un administrador da el descuento sin pedir PIN', async () => {
    montar({ actor: admin });
    await empezarConClienteNuevo();
    await agregarVidrio();
    fireEvent.click(screen.getByRole('button', { name: 'Dar descuento' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).queryByLabelText('PIN del administrador')).toBeNull();
    fireEvent.change(within(dialogo).getByLabelText('Precio nuevo por unidad (con IVA)'), {
      target: { value: '250' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar descuento' }));
    await waitFor(() => {
      expect(screen.getAllByText('$480.00').length).toBeGreaterThan(0);
    });
  });

  it('un descuento mayor al precio del catálogo se rechaza y dice qué hacer', async () => {
    montar({ actor: admin });
    await empezarConClienteNuevo();
    await agregarVidrio();
    fireEvent.click(screen.getByRole('button', { name: 'Dar descuento' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText('Precio nuevo por unidad (con IVA)'), {
      target: { value: '999' },
    });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Aplicar descuento' }));
    expect(
      await within(dialogo).findByText(/no puede ser negativo ni mayor que el del catálogo/),
    ).toBeTruthy();
  });

  it('emite: folio provisional, "Guardado en la tablet", pide enviar y encola la operación', async () => {
    const e = montar();
    await empezarConClienteNuevo();
    await agregarVidrio();
    fireEvent.click(screen.getByRole('button', { name: 'Emitir cotización' }));
    expect((await screen.findAllByText(/Folio provisional T1-0001/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Guardado en la tablet/).length).toBeGreaterThan(0);
    expect(e.porEnviar).toHaveBeenCalled();
    expect(await e.outbox.pendingCount()).toBe(1);
    // Ya emitida: no se agregan conceptos.
    expect(screen.queryByLabelText('Buscar producto o servicio')).toBeNull();
  });

  it('una cotización emitida se comparte por el menú del dispositivo con el PDF', async () => {
    const e = montar();
    await empezarConClienteNuevo();
    await agregarVidrio();
    fireEvent.click(screen.getByRole('button', { name: 'Emitir cotización' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Compartir por WhatsApp' }));
    await waitFor(() => {
      expect(e.llamadas).toEqual(['compartir']);
    });
    expect(e.archivos[0]?.name).toBe('Cotizacion-T1-0001.pdf');
    expect(await screen.findByText('Listo: elige WhatsApp en el menú.')).toBeTruthy();
  });

  it('se puede marcar como aceptada y deja de ofrecer aceptar o rechazar', async () => {
    const e = montar();
    await empezarConClienteNuevo();
    await agregarVidrio();
    fireEvent.click(screen.getByRole('button', { name: 'Emitir cotización' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como aceptada' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Marcar como aceptada' })).toBeNull();
    });
    expect((await e.outbox.list()).map((o) => o.envelope.type)).toEqual([
      'IssueQuote',
      'MarkQuoteAccepted',
    ]);
  });

  it('duplicar abre un borrador nuevo sin folio', async () => {
    montar();
    await empezarConClienteNuevo();
    await agregarVidrio();
    fireEvent.click(screen.getByRole('button', { name: 'Emitir cotización' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicar' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Emitir cotización' })).toBeTruthy();
    });
    expect(screen.queryByText(/Folio provisional/)).toBeNull();
    expect(screen.getAllByText(/1\.92 m²/).length).toBeGreaterThan(0);
  });

  it('un borrador a medias se recupera al volver a la lista', async () => {
    montar();
    await empezarConClienteNuevo();
    await agregarVidrio();
    fireEvent.click(screen.getByRole('button', { name: 'Volver a las cotizaciones' }));
    const borrador = await screen.findByRole('button', { name: /Ana López · \$537\.60/ });
    fireEvent.click(borrador);
    expect(await screen.findByRole('heading', { name: /Cotizador · Ana López/ })).toBeTruthy();
    expect(screen.getAllByText(/1\.92 m²/).length).toBeGreaterThan(0);
  });

  it('con el catálogo vacío avisa "Revisa primero tu catálogo" y se puede cerrar', async () => {
    montar({ productos: [] });
    await empezarConClienteNuevo();
    expect(await screen.findByText(/Revisa primero tu catálogo/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(screen.queryByText(/Revisa primero tu catálogo/)).toBeNull();
  });

  it('tiene dos paneles (datos y vista previa) y pestañas para pantalla chica', async () => {
    montar();
    await empezarConClienteNuevo();
    expect(screen.getByRole('tab', { name: 'Datos' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Vista previa' }));
    expect(document.querySelector('.cotizador__paneles')?.getAttribute('data-pestana')).toBe(
      'vista',
    );
    expect(screen.getByRole('article', { name: 'Vista previa del documento' })).toBeTruthy();
  });

  it('el historial lista las cotizaciones emitidas con folio, estado y total', async () => {
    montar();
    await empezarConClienteNuevo();
    await agregarVidrio();
    fireEvent.click(screen.getByRole('button', { name: 'Emitir cotización' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a las cotizaciones' }));
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('T1-0001')).toBeTruthy();
    expect(within(tabla).getByText('Enviada')).toBeTruthy();
    expect(within(tabla).getByText('$537.60')).toBeTruthy();
  });

  it('el historial se acota por cliente, por nombre o por WhatsApp', async () => {
    montar();
    await empezarConClienteNuevo();
    await agregarVidrio();
    fireEvent.click(screen.getByRole('button', { name: 'Emitir cotización' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Volver a las cotizaciones' }));
    const filtro = await screen.findByLabelText('Buscar por cliente (nombre o WhatsApp)');

    fireEvent.change(filtro, { target: { value: 'Beto' } });
    expect(await screen.findByText('Ninguna cotización coincide con esa búsqueda.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.change(filtro, { target: { value: 'ana' } });
    expect(within(await screen.findByRole('table')).getByText('T1-0001')).toBeTruthy();

    fireEvent.change(filtro, { target: { value: '5512345678' } });
    expect(within(await screen.findByRole('table')).getByText('T1-0001')).toBeTruthy();
  });
});
