import axe from 'axe-core';
import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type {
  AdminCancelInput,
  AdminCancelResult,
  AdminInvoices,
  AdminIssueInput,
  AdminIssueResult,
  AdminRetryResult,
  InvoiceCandidate,
  IssuedInvoice,
  StampUsage,
  ShareableFile,
  ShareService,
} from '@zammir/core';
import { describe, expect, it, vi } from 'vitest';

import { textos } from '../../../shared/i18n/textos';
import { Facturas } from './Facturas';

vi.setConfig({ testTimeout: 30_000 });
configure({ asyncUtilTimeout: 5_000 });

const ID = '5c000000-0000-4000-8000-000000000001';

const conFicha: InvoiceCandidate = {
  sourceType: 'COUNTER_SALE',
  sourceId: 'e1000000-0000-0000-0000-000000000001',
  folio: 'V-2026-0001',
  customerName: 'Ana López',
  customerFiscal: {
    rfc: 'XAXX010101000',
    name: 'ANA LOPEZ',
    fiscalZip: '55900',
    regime: '616',
    cfdiUse: 'G03',
  },
  totalCents: 11_600,
  settledAt: '2026-11-03T18:00:00.000Z',
};

const sinFicha: InvoiceCandidate = {
  sourceType: 'WORK_ORDER',
  sourceId: 'e2000000-0000-0000-0000-000000000001',
  folio: 'OT-2026-0007',
  customerName: null,
  customerFiscal: null,
  totalCents: 100_000,
  settledAt: '2026-11-04T18:00:00.000Z',
};

/** Servidor de mentira: lo facturable, lo que responde al emitir y los archivos. */
function servidor(
  opciones: {
    lista?: readonly InvoiceCandidate[] | null;
    emision?: AdminIssueResult | AdminIssueResult[];
    archivos?: { folio: string; xml: string; pdfBase64: string } | null;
    emitidas?: readonly IssuedInvoice[] | null;
    uso?: StampUsage | null;
    reintento?: AdminRetryResult;
    cancelacion?: AdminCancelResult;
  } = {},
) {
  const solicitudes: AdminIssueInput[] = [];
  const reintentos: string[] = [];
  const cancelaciones: AdminCancelInput[] = [];
  const consultasDeArchivos: string[] = [];
  let lista = opciones.lista === undefined ? [conFicha, sinFicha] : opciones.lista;
  const respuestas = Array.isArray(opciones.emision)
    ? [...opciones.emision]
    : [opciones.emision ?? { kind: 'STAMPED' as const, folio: 'F-2026-0001', uuid: 'u-1' }];
  const facturas: AdminInvoices = {
    candidates: () => Promise.resolve(lista),
    issue: (entrada) => {
      solicitudes.push(entrada);
      const r = respuestas.length > 1 ? respuestas.shift() : respuestas[0];
      if (r?.kind === 'STAMPED') {
        // Ya facturada: sale de la lista, igual que en la base.
        lista = (lista ?? []).filter((c) => c.sourceId !== entrada.source.id);
      }
      return Promise.resolve(r ?? { kind: 'UNAVAILABLE' });
    },
    list: () => Promise.resolve(opciones.emitidas === undefined ? [] : opciones.emitidas),
    retry: (requestId) => {
      reintentos.push(requestId);
      return Promise.resolve(opciones.reintento ?? { kind: 'UNAVAILABLE' });
    },
    cancel: (entrada) => {
      cancelaciones.push(entrada);
      return Promise.resolve(opciones.cancelacion ?? { kind: 'CANCELLED' });
    },
    usage: () =>
      Promise.resolve(
        opciones.uso === undefined
          ? { used: 10, limit: 100, remaining: 90, percentBps: 1000, level: 'OK' as const }
          : opciones.uso,
      ),
    customerInvoices: () => Promise.resolve([]),
    files: (folio) => {
      consultasDeArchivos.push(folio);
      return Promise.resolve(
        opciones.archivos === undefined
          ? { folio, xml: '<cfdi/>', pdfBase64: btoa('%PDF-1.4 prueba') }
          : opciones.archivos,
      );
    },
  };
  return { facturas, solicitudes, consultasDeArchivos, reintentos, cancelaciones };
}

function montar(
  s: ReturnType<typeof servidor>,
  extra: Partial<Parameters<typeof Facturas>[0]> = {},
) {
  const archivos: ShareableFile[] = [];
  const resultado = render(
    <MemoryRouter>
      <Facturas
        facturas={s.facturas}
        nuevoId={() => ID}
        guardarArchivo={(a) => {
          archivos.push(a);
        }}
        {...extra}
      />
    </MemoryRouter>,
  );
  return { ...resultado, archivos };
}

async function abrirFormulario(folio: string): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole('button', { name: `Facturar ${folio}` }));
  return screen.findByRole('dialog', { name: `Facturar ${folio}` });
}

describe('Facturas del administrador', () => {
  it('lista lo facturable con su folio, tipo, cliente, total y fecha de liquidación en hora de México', async () => {
    montar(servidor());
    expect(await screen.findByText('V-2026-0001')).toBeTruthy();
    expect(screen.getByText('Venta de mostrador')).toBeTruthy();
    expect(screen.getByText('Ana López')).toBeTruthy();
    expect(screen.getByText('$116.00')).toBeTruthy();
    expect(screen.getByText('OT-2026-0007')).toBeTruthy();
    expect(screen.getByText('Orden de trabajo')).toBeTruthy();
    expect(screen.getByText('Sin cliente')).toBeTruthy();
    expect(screen.getByText('$1,000.00')).toBeTruthy();
  });

  it('sin nada por facturar enseña qué pasa y no muestra ceros de relleno', async () => {
    montar(servidor({ lista: [] }));
    expect(await screen.findByText('No hay nada por facturar')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('si no se pudo leer lo facturable lo dice y dice qué hacer', async () => {
    montar(servidor({ lista: null }));
    expect(await screen.findByText('No se pudo leer lo facturable.')).toBeTruthy();
    expect(screen.getByText(/Revisa tu conexión a internet/)).toBeTruthy();
  });

  it('el receptor se precarga con los datos de la ficha del cliente y se puede corregir', async () => {
    montar(servidor());
    const ventana = within(await abrirFormulario('V-2026-0001'));
    expect(ventana.getByText(/se tomaron de la ficha del cliente/)).toBeTruthy();
    expect(ventana.getByLabelText<HTMLInputElement>('RFC').value).toBe('XAXX010101000');
    expect(ventana.getByLabelText<HTMLInputElement>('Nombre o razón social').value).toBe(
      'ANA LOPEZ',
    );
    expect(ventana.getByLabelText<HTMLInputElement>('Código postal fiscal').value).toBe('55900');
    expect(ventana.getByLabelText<HTMLSelectElement>('Régimen fiscal').value).toBe('616');
    expect(ventana.getByLabelText<HTMLSelectElement>('Uso de la factura').value).toBe('G03');
    fireEvent.change(ventana.getByLabelText('Nombre o razón social'), {
      target: { value: 'OTRO NOMBRE' },
    });
    expect(ventana.getByLabelText<HTMLInputElement>('Nombre o razón social').value).toBe(
      'OTRO NOMBRE',
    );
  });

  it('un cliente sin datos fiscales los pide vacíos y valida formatos antes de mandar nada', async () => {
    const s = servidor();
    montar(s);
    const ventana = within(await abrirFormulario('OT-2026-0007'));
    expect(ventana.getByText(/no tiene datos fiscales en su ficha/)).toBeTruthy();
    expect(ventana.getByLabelText<HTMLInputElement>('RFC').value).toBe('');
    fireEvent.click(ventana.getByRole('button', { name: 'Timbrar factura' }));
    expect(
      await ventana.findByText('El RFC no tiene el formato correcto (12 o 13 caracteres).'),
    ).toBeTruthy();
    expect(ventana.getByText('Falta el nombre o la razón social.')).toBeTruthy();
    expect(ventana.getByText('El código postal debe tener 5 números.')).toBeTruthy();
    expect(ventana.getByText('Elige el régimen fiscal.')).toBeTruthy();
    expect(ventana.getByText('Elige el uso de la factura.')).toBeTruthy();
    expect(s.solicitudes).toHaveLength(0);
  });

  it('el administrador puede usar cualquier uso del catálogo y el régimen depende del RFC', async () => {
    montar(servidor());
    const ventana = within(await abrirFormulario('OT-2026-0007'));
    const usos = within(ventana.getByLabelText('Uso de la factura'))
      .getAllByRole('option')
      .map((o) => o.getAttribute('value'));
    expect(usos).toContain('G02');
    expect(usos).toContain('CP01');
    const regimenes = () =>
      within(ventana.getByLabelText('Régimen fiscal'))
        .getAllByRole('option')
        .map((o) => o.getAttribute('value'));
    fireEvent.change(ventana.getByLabelText('RFC'), { target: { value: 'ABC010101AB1' } });
    expect(regimenes()).toContain('601');
    expect(regimenes()).not.toContain('612');
  });

  it('timbra con el receptor normalizado y un identificador de solicitud, y muestra el folio', async () => {
    const s = servidor();
    montar(s);
    const ventana = within(await abrirFormulario('V-2026-0001'));
    fireEvent.change(ventana.getByLabelText('RFC'), { target: { value: ' xaxx 010101 000 ' } });
    fireEvent.click(ventana.getByRole('button', { name: 'Timbrar factura' }));
    expect(await screen.findByRole('dialog', { name: 'Factura emitida' })).toBeTruthy();
    expect(screen.getByText('F-2026-0001')).toBeTruthy();
    expect(s.solicitudes[0]).toEqual({
      source: { type: 'COUNTER_SALE', id: conFicha.sourceId },
      requestId: ID,
      recipient: {
        rfc: 'XAXX010101000',
        name: 'ANA LOPEZ',
        fiscalZip: '55900',
        regime: '616',
        cfdiUse: 'G03',
      },
    });
    // Ya facturada: sale de la lista.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Facturar V-2026-0001' })).toBeNull();
    });
  });

  it('avisa que las facturas de prueba no tienen validez fiscal', async () => {
    montar(servidor());
    const ventana = within(await abrirFormulario('V-2026-0001'));
    fireEvent.click(ventana.getByRole('button', { name: 'Timbrar factura' }));
    expect(await screen.findByText(/no tienen validez fiscal/)).toBeTruthy();
  });

  it('un pago mixto pide elegir la forma de pago y vuelve a mandar con la misma solicitud', async () => {
    const s = servidor({
      emision: [
        { kind: 'PAYMENT_FORM_REQUIRED' },
        { kind: 'STAMPED', folio: 'F-2026-0002', uuid: 'u-2' },
      ],
    });
    montar(s);
    const ventana = within(await abrirFormulario('V-2026-0001'));
    expect(ventana.queryByLabelText('Forma de pago de la factura')).toBeNull();
    fireEvent.click(ventana.getByRole('button', { name: 'Timbrar factura' }));
    expect(await ventana.findByText(/se pagó con efectivo y transferencia/)).toBeTruthy();
    // Sin elegir, no se manda.
    fireEvent.click(ventana.getByRole('button', { name: 'Timbrar factura' }));
    expect(await ventana.findByText('Elige la forma de pago.')).toBeTruthy();
    expect(s.solicitudes).toHaveLength(1);
    fireEvent.change(ventana.getByLabelText('Forma de pago de la factura'), {
      target: { value: '03' },
    });
    fireEvent.click(ventana.getByRole('button', { name: 'Timbrar factura' }));
    expect(await screen.findByText('F-2026-0002')).toBeTruthy();
    expect(s.solicitudes.map((x) => x.requestId)).toEqual([ID, ID]);
    expect(s.solicitudes[1]?.paymentForm).toBe('03');
  });

  it('los datos que el servidor rechaza se marcan en su campo', async () => {
    const s = servidor({
      emision: { kind: 'INVALID', fields: ['recipient.rfc', 'recipient.regime'] },
    });
    montar(s);
    const ventana = within(await abrirFormulario('V-2026-0001'));
    fireEvent.click(ventana.getByRole('button', { name: 'Timbrar factura' }));
    expect(
      await ventana.findByText('El RFC no tiene el formato correcto (12 o 13 caracteres).'),
    ).toBeTruthy();
    expect(ventana.getByText('Elige el régimen fiscal.')).toBeTruthy();
  });

  it('cada motivo por el que no se pudo emitir se explica y dice qué hacer', async () => {
    const casos: [AdminIssueResult, string][] = [
      [{ kind: 'IN_PROCESS' }, 'La factura se está procesando.'],
      [{ kind: 'NOT_BILLABLE' }, 'A algún producto le faltan las claves del SAT.'],
      [{ kind: 'REJECTED' }, 'El proveedor rechazó la factura con esos datos.'],
      [{ kind: 'NOT_AUTHORIZED' }, 'Tu cuenta no puede facturar.'],
      [{ kind: 'NOT_FOUND' }, 'Ya no se encontró esa venta u orden.'],
      [{ kind: 'UNAVAILABLE' }, 'El servicio de facturas no está disponible en este momento.'],
      [{ kind: 'NO_NETWORK' }, 'No hay conexión a internet.'],
      [{ kind: 'INELIGIBLE', reason: 'CANCELLED' }, 'Esa compra está cancelada.'],
      [{ kind: 'INELIGIBLE', reason: 'ALREADY_INVOICED' }, 'Esa compra ya tiene una factura.'],
      [{ kind: 'INELIGIBLE', reason: 'NOT_SETTLED' }, 'Esa compra todavía tiene saldo.'],
      [
        { kind: 'INELIGIBLE', reason: 'RARA' },
        'El servicio de facturas no está disponible en este momento.',
      ],
    ];
    for (const [emision, texto] of casos) {
      const { unmount } = montar(servidor({ emision }));
      const ventana = within(await abrirFormulario('V-2026-0001'));
      fireEvent.click(ventana.getByRole('button', { name: 'Timbrar factura' }));
      expect(await ventana.findByText(texto)).toBeTruthy();
      unmount();
    }
  });

  it('se puede cancelar sin timbrar nada', async () => {
    const s = servidor();
    montar(s);
    const ventana = within(await abrirFormulario('V-2026-0001'));
    fireEvent.click(ventana.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(s.solicitudes).toHaveLength(0);
  });
});

describe('factura emitida: descargar y enviar', () => {
  async function emitir(s: ReturnType<typeof servidor>) {
    const m = montar(s);
    const ventana = within(await abrirFormulario('V-2026-0001'));
    fireEvent.click(ventana.getByRole('button', { name: 'Timbrar factura' }));
    await screen.findByRole('dialog', { name: 'Factura emitida' });
    return m;
  }

  it('baja el PDF y el XML con el folio de la factura', async () => {
    const s = servidor();
    const m = await emitir(s);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    expect(await screen.findByText('Se descargó F-2026-0001.pdf.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar XML' }));
    await waitFor(() => {
      expect(m.archivos).toHaveLength(2);
    });
    expect(m.archivos.map((a) => a.name)).toEqual(['F-2026-0001.pdf', 'F-2026-0001.xml']);
    expect(m.archivos[0]?.mimeType).toBe('application/pdf');
    expect(new TextDecoder().decode(m.archivos[0]?.bytes)).toContain('%PDF');
    expect(new TextDecoder().decode(m.archivos[1]?.bytes)).toBe('<cfdi/>');
    expect(s.consultasDeArchivos).toEqual(['F-2026-0001', 'F-2026-0001']);
  });

  it('si no se pueden leer los archivos lo dice y dice qué hacer', async () => {
    const m = await emitir(servidor({ archivos: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    expect(await screen.findByText('No se pudieron leer los archivos de la factura.')).toBeTruthy();
    expect(m.archivos).toHaveLength(0);
  });

  it('sin servicio para compartir no ofrece WhatsApp', async () => {
    await emitir(servidor());
    expect(screen.queryByRole('button', { name: 'Enviar por WhatsApp' })).toBeNull();
  });

  it('con menú de compartir del dispositivo manda el PDF con un mensaje', async () => {
    const compartidos: { archivo: ShareableFile; mensaje: string }[] = [];
    const compartir: ShareService = {
      canShareFile: () => true,
      shareFile: (archivo, mensaje) => {
        compartidos.push({ archivo, mensaje });
        return Promise.resolve({ ok: true, value: undefined });
      },
      openLink: vi.fn(),
      download: vi.fn(),
    };
    const s = servidor();
    montar(s, { compartir });
    const ventana = within(await abrirFormulario('V-2026-0001'));
    fireEvent.click(ventana.getByRole('button', { name: 'Timbrar factura' }));
    await screen.findByRole('dialog', { name: 'Factura emitida' });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }));
    await waitFor(() => {
      expect(compartidos).toHaveLength(1);
    });
    expect(compartidos[0]?.archivo.name).toBe('F-2026-0001.pdf');
    expect(compartidos[0]?.mensaje).toBe('Te comparto tu factura F-2026-0001.');
  });

  it('sin menú de compartir descarga el PDF y abre WhatsApp con el mensaje', async () => {
    const descargados: ShareableFile[] = [];
    const enlaces: string[] = [];
    const compartir: ShareService = {
      canShareFile: () => false,
      shareFile: () => Promise.resolve({ ok: true, value: undefined }),
      openLink: (url) => {
        enlaces.push(url);
      },
      download: (a) => {
        descargados.push(a);
      },
    };
    montar(servidor(), { compartir });
    const ventana = within(await abrirFormulario('V-2026-0001'));
    fireEvent.click(ventana.getByRole('button', { name: 'Timbrar factura' }));
    await screen.findByRole('dialog', { name: 'Factura emitida' });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }));
    await waitFor(() => {
      expect(enlaces).toHaveLength(1);
    });
    expect(descargados[0]?.name).toBe('F-2026-0001.pdf');
    expect(enlaces[0]).toBe(
      `https://wa.me/?text=${encodeURIComponent('Te comparto tu factura F-2026-0001.')}`,
    );
  });
});

const vigente: IssuedInvoice = {
  requestId: 'r1000000-0000-4000-8000-000000000001',
  status: 'STAMPED',
  folio: 'F-2026-0001',
  channel: 'SYSTEM',
  sourceType: 'COUNTER_SALE',
  sourceFolio: 'V-2026-0001',
  customerName: 'Ana López',
  totalCents: 11_600,
  stampedAt: '2026-11-04T18:00:00.000Z',
  createdAt: '2026-11-04T18:00:00.000Z',
  attempts: 1,
  lastError: null,
  cancelMotive: null,
  cancellationRequested: false,
  cancelledAt: null,
};

const enProceso: IssuedInvoice = {
  ...vigente,
  requestId: 'r2000000-0000-4000-8000-000000000002',
  status: 'IN_PROCESS',
  folio: null,
  stampedAt: null,
  attempts: 3,
};

async function irAEmitidas(): Promise<void> {
  fireEvent.click(await screen.findByRole('tab', { name: 'Emitidas' }));
}

describe('Facturas emitidas, reintentos, cancelación y timbres', () => {
  it('en la pestaña Emitidas muestra el estado de cada factura y avisa de las que están en proceso', async () => {
    montar(servidor({ emitidas: [vigente, enProceso] }));
    await irAEmitidas();
    expect(await screen.findByText('Vigente')).toBeTruthy();
    expect(screen.getAllByText('En proceso').length).toBeGreaterThan(0);
    expect(screen.getByText('3 intentos')).toBeTruthy();
    expect(screen.getByText(/Hay 1 factura en proceso/)).toBeTruthy();
  });

  it('reintentar una en proceso usa su mismo identificador y avisa cuando queda timbrada', async () => {
    const s = servidor({
      emitidas: [enProceso],
      reintento: { kind: 'STAMPED', folio: 'F-2026-0002' },
    });
    montar(s);
    await irAEmitidas();
    fireEvent.click(await screen.findByRole('button', { name: /^Reintentar/ }));
    expect(await screen.findByText('La factura quedó timbrada: F-2026-0002.')).toBeTruthy();
    expect(s.reintentos).toEqual([enProceso.requestId]);
  });

  it('si el reintento no se logra lo dice sin dar la factura por perdida', async () => {
    montar(servidor({ emitidas: [enProceso], reintento: { kind: 'IN_PROCESS' } }));
    await irAEmitidas();
    fireEvent.click(await screen.findByRole('button', { name: /^Reintentar/ }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
  });

  it('cancelar con el motivo 01 exige el folio de la factura que la sustituye', async () => {
    const s = servidor({ emitidas: [vigente] });
    montar(s);
    await irAEmitidas();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar F-2026-0001' }));
    const ventana = within(await screen.findByRole('dialog'));
    fireEvent.click(
      ventana.getByRole('button', { name: /^Cancelar factura|^Confirmar|^Cancelar$/ }),
    );
    expect(s.cancelaciones).toHaveLength(0);
    fireEvent.change(ventana.getByRole('combobox'), { target: { value: '01' } });
    fireEvent.click(
      ventana.getByRole('button', { name: /^Cancelar factura|^Confirmar|^Cancelar$/ }),
    );
    expect(s.cancelaciones).toHaveLength(0);
    fireEvent.change(ventana.getByRole('textbox'), { target: { value: 'f-2026-0009' } });
    fireEvent.click(
      ventana.getByRole('button', { name: /^Cancelar factura|^Confirmar|^Cancelar$/ }),
    );
    await waitFor(() => {
      expect(s.cancelaciones).toEqual([
        { folio: 'F-2026-0001', motive: '01', substituteFolio: 'F-2026-0009' },
      ]);
    });
  });

  it('con el motivo 02 cancela sin pedir factura sustituta', async () => {
    const s = servidor({ emitidas: [vigente] });
    montar(s);
    await irAEmitidas();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar F-2026-0001' }));
    const ventana = within(await screen.findByRole('dialog'));
    fireEvent.change(ventana.getByRole('combobox'), { target: { value: '02' } });
    expect(ventana.queryByRole('textbox')).toBeNull();
    fireEvent.click(
      ventana.getByRole('button', { name: /^Cancelar factura|^Confirmar|^Cancelar$/ }),
    );
    await waitFor(() => {
      expect(s.cancelaciones).toEqual([{ folio: 'F-2026-0001', motive: '02' }]);
    });
  });

  it('avisa cuando los timbres llegan al porcentaje de aviso y cuando se agotan', async () => {
    const { unmount } = montar(
      servidor({
        uso: { used: 80, limit: 100, remaining: 20, percentBps: 8000, level: 'WARNING' },
      }),
    );
    expect(await screen.findByText(textos.facturas.timbres.aviso)).toBeTruthy();
    unmount();
    montar(
      servidor({
        uso: { used: 100, limit: 100, remaining: 0, percentBps: 10_000, level: 'REACHED' },
      }),
    );
    expect(await screen.findByText(textos.facturas.timbres.agotados)).toBeTruthy();
  });
});

describe('accesibilidad de Facturas', () => {
  it('la lista y el formulario no tienen violaciones de accesibilidad', async () => {
    const { container } = montar(servidor());
    await screen.findByText('V-2026-0001');
    const revisar = async (): Promise<string[]> =>
      (
        await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
      ).violations.map((v) => `${v.id}: ${v.help}`);
    expect(await revisar()).toEqual([]);
    await abrirFormulario('V-2026-0001');
    expect(await revisar()).toEqual([]);
  });
});
