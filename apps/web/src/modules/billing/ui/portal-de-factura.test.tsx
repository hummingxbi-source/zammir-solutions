import axe from 'axe-core';
import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type {
  PortalArchivo,
  PortalConsulta,
  PortalConsultaEntrada,
  PortalConsultaResultado,
  PortalDescarga,
  PortalDescargaResultado,
  PortalSolicitud,
  PortalSolicitudEntrada,
  PortalSolicitudResultado,
} from '@zammir/core';
import { describe, expect, it, vi } from 'vitest';

import { App } from '../../../App';
import { PortalDeFactura } from './PortalDeFactura';

vi.setConfig({ testTimeout: 30_000 });
configure({ asyncUtilTimeout: 5_000 });

const documento = {
  type: 'COUNTER_SALE' as const,
  folio: 'V-2026-0001',
  totalCents: 11_600,
  lines: [{ name: 'Chapa de seguridad', quantity: 1, lineTotalCents: 11_600 }],
  deadline: '2026-11-30',
};

const ID = '5b000000-0000-4000-8000-000000000001';

interface Espias {
  readonly consultas: PortalConsultaEntrada[];
  readonly solicitudes: PortalSolicitudEntrada[];
  readonly descargas: { entrada: PortalConsultaEntrada; formato: string }[];
  readonly archivos: PortalArchivo[];
}

/** Servidor de mentira: guarda lo que se le manda y responde lo que se le pida. */
function servidor(
  opciones: {
    consulta?: PortalConsultaResultado;
    solicitud?: PortalSolicitudResultado | PortalSolicitudResultado[];
    descarga?: PortalDescargaResultado;
  } = {},
) {
  const espias: Espias = { consultas: [], solicitudes: [], descargas: [], archivos: [] };
  const respuestasDeSolicitud = Array.isArray(opciones.solicitud)
    ? [...opciones.solicitud]
    : [opciones.solicitud ?? { kind: 'STAMPED' as const, folio: 'F-2026-0001', uuid: 'u-1' }];
  const consultar: PortalConsulta = (entrada) => {
    espias.consultas.push(entrada);
    return Promise.resolve(opciones.consulta ?? { kind: 'OK', document: documento });
  };
  const solicitar: PortalSolicitud = (entrada) => {
    espias.solicitudes.push(entrada);
    const siguiente =
      respuestasDeSolicitud.length > 1 ? respuestasDeSolicitud.shift() : respuestasDeSolicitud[0];
    return Promise.resolve(siguiente ?? { kind: 'UNAVAILABLE' });
  };
  const descargar: PortalDescarga = (entrada, formato) => {
    espias.descargas.push({ entrada, formato });
    return Promise.resolve(
      opciones.descarga ?? {
        kind: 'FILE',
        file: {
          filename: `F-2026-0001.${formato}`,
          contentType: 'application/octet-stream',
          encoding: 'utf8',
          content: 'contenido',
        },
      },
    );
  };
  return { consultar, solicitar, descargar, espias };
}

// El reloj de la página: abierta en 0 y cada llamada 10 s después, como lo haría una persona.
function reloj(): () => number {
  let t = -10_000;
  return () => {
    t += 10_000;
    return t;
  };
}

function montar(
  s: ReturnType<typeof servidor>,
  extra: Partial<Parameters<typeof PortalDeFactura>[0]> = {},
) {
  return render(
    <PortalDeFactura
      consultar={s.consultar}
      solicitar={s.solicitar}
      descargar={s.descargar}
      ahora={reloj()}
      nuevoId={() => ID}
      guardarArchivo={(a) => {
        s.espias.archivos.push(a);
      }}
      {...extra}
    />,
  );
}

function escribir(etiqueta: string, valor: string): void {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

function elegir(etiqueta: string, valor: string): void {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

async function pasarAlFormulario(s: ReturnType<typeof servidor>): Promise<void> {
  escribir('Folio de su ticket', ' v-2026-0001 ');
  escribir('Código de verificación', 'bbbb-bbbb');
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByText('Chapa de seguridad');
  expect(s.espias.consultas).toHaveLength(1);
}

function llenarDatos(): void {
  escribir('RFC', ' xaxx 010101 000 ');
  escribir('Nombre o razón social', '  CLIENTE DE PRUEBA ');
  escribir('Código postal fiscal', ' 55900 ');
  elegir('Régimen fiscal', '616');
  elegir('Uso de la factura', 'S01');
  fireEvent.click(screen.getByRole('checkbox'));
}

describe('paso 1: el ticket', () => {
  it('con folio y código correctos pasa a los datos y muestra conceptos, total y plazo', async () => {
    const s = servidor();
    montar(s);
    await pasarAlFormulario(s);
    expect(screen.getByText('$116.00', { selector: 'strong' })).toBeTruthy();
    expect(screen.getByText('Puede pedir su factura hasta el 30 nov 2026.')).toBeTruthy();
    // Se manda normalizado, con el campo trampa vacío y el tiempo que tardó.
    expect(s.espias.consultas[0]).toMatchObject({
      folio: 'V-2026-0001',
      code: 'BBBBBBBB',
      honeypot: '',
      token: null,
    });
    expect(s.espias.consultas[0]?.elapsedMs).toBe(10_000);
  });

  it('el QR trae el folio y el código ya puestos, y también se pueden teclear a mano', () => {
    const s = servidor();
    montar(s, { inicial: { folio: 'OT-2026-0007', code: 'CCCCCCCC' } });
    expect(screen.getByLabelText<HTMLInputElement>('Folio de su ticket').value).toBe(
      'OT-2026-0007',
    );
    expect(screen.getByLabelText<HTMLInputElement>('Código de verificación').value).toBe(
      'CCCCCCCC',
    );
    escribir('Folio de su ticket', 'V-2026-0002');
    expect(screen.getByLabelText<HTMLInputElement>('Folio de su ticket').value).toBe('V-2026-0002');
  });

  it('un folio o código que no cuadran dan siempre el mismo mensaje, que dice qué hacer', async () => {
    const s = servidor({ consulta: { kind: 'NOT_AVAILABLE' } });
    montar(s);
    escribir('Folio de su ticket', 'V-2026-0999');
    escribir('Código de verificación', 'ZZZZZZZZ');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText('No encontramos una compra con ese folio y ese código.'),
    ).toBeTruthy();
    expect(screen.getByText(/se hizo sin internet, puede tardar un poco/)).toBeTruthy();
  });

  it('cada motivo por el que no se puede facturar se explica con amabilidad', async () => {
    const motivos = [
      ['CANCELLED', 'Esta compra fue cancelada, por eso no se puede facturar.'],
      ['ALREADY_INVOICED', 'Esta compra ya tiene una factura.'],
      ['NOT_SETTLED', 'Esta compra todavía tiene saldo pendiente.'],
      ['EXPIRED', 'Ya pasó el plazo para pedir esta factura por aquí.'],
    ] as const;
    for (const [razon, texto] of motivos) {
      const s = servidor({ consulta: { kind: 'INELIGIBLE', reason: razon } });
      const { unmount } = montar(s);
      escribir('Folio de su ticket', 'V-2026-0001');
      escribir('Código de verificación', 'BBBBBBBB');
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      expect(await screen.findByText(texto)).toBeTruthy();
      unmount();
    }
  });

  it('con demasiados intentos, sin red o con el servicio caído avisa y dice qué hacer', async () => {
    const casos: [PortalConsultaResultado, string][] = [
      [{ kind: 'BLOCKED', retryAfterSeconds: 900 }, 'Hizo demasiados intentos.'],
      [{ kind: 'NO_NETWORK' }, 'No hay conexión a internet.'],
      [{ kind: 'UNAVAILABLE' }, 'El servicio de facturas no está disponible en este momento.'],
    ];
    for (const [consulta, texto] of casos) {
      const s = servidor({ consulta });
      const { unmount } = montar(s);
      escribir('Folio de su ticket', 'V-2026-0001');
      escribir('Código de verificación', 'BBBBBBBB');
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      expect(await screen.findByText(texto)).toBeTruthy();
      unmount();
    }
    const bloqueado = servidor({ consulta: { kind: 'BLOCKED', retryAfterSeconds: 900 } });
    montar(bloqueado);
    escribir('Folio de su ticket', 'V-2026-0001');
    escribir('Código de verificación', 'BBBBBBBB');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText(/Espere 15 minutos/)).toBeTruthy();
  });

  it('el campo trampa existe, está oculto para las personas y viaja con lo que contenga', async () => {
    const s = servidor({ consulta: { kind: 'NOT_AVAILABLE' } });
    const { container } = montar(s);
    const trampa = container.querySelector<HTMLInputElement>('input[name="sitio_web"]');
    if (trampa === null) {
      throw new Error('falta el campo trampa');
    }
    expect(trampa.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(trampa.tabIndex).toBe(-1);
    fireEvent.change(trampa, { target: { value: 'http://spam.invalid' } });
    escribir('Folio de su ticket', 'V-2026-0001');
    escribir('Código de verificación', 'BBBBBBBB');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => {
      expect(s.espias.consultas).toHaveLength(1);
    });
    expect(s.espias.consultas[0]?.honeypot).toBe('http://spam.invalid');
  });

  it('con verificación externa no deja continuar hasta tener su token y pide uno nuevo en cada llamada', async () => {
    const s = servidor({ consulta: { kind: 'NOT_AVAILABLE' } });
    const tokens: ((t: string) => void)[] = [];
    const quitados: string[] = [];
    window.turnstile = {
      render: (_c, opciones) => {
        tokens.push(opciones.callback);
        return `widget-${String(tokens.length)}`;
      },
      remove: (id) => {
        quitados.push(id);
      },
    };
    montar(s, { siteKey: 'llave-publica' });
    escribir('Folio de su ticket', 'V-2026-0001');
    escribir('Código de verificación', 'BBBBBBBB');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Continuar' }).disabled).toBe(
      true,
    );
    tokens[0]?.('token-1');
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Continuar' }).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => {
      expect(s.espias.consultas).toHaveLength(1);
    });
    expect(s.espias.consultas[0]?.token).toBe('token-1');
    // Tras la llamada el token ya se gastó: hay que resolver otro para volver a intentar.
    await waitFor(() => {
      expect(tokens).toHaveLength(2);
    });
    expect(quitados).toContain('widget-1');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Continuar' }).disabled).toBe(
      true,
    );
    delete window.turnstile;
  });

  it('el nombre del negocio, si se conoce, encabeza la página', () => {
    montar(servidor(), { negocio: 'ZAMMIR (prueba)' });
    expect(screen.getByText('ZAMMIR (prueba)')).toBeTruthy();
  });
});

describe('paso 2: los datos fiscales', () => {
  it('antes de mandar nada revisa lo que falta y lo dice campo por campo', async () => {
    const s = servidor();
    montar(s);
    await pasarAlFormulario(s);
    fireEvent.click(screen.getByRole('button', { name: 'Pedir mi factura' }));
    expect(
      await screen.findByText('El RFC no tiene el formato correcto (12 o 13 caracteres).'),
    ).toBeTruthy();
    expect(screen.getByText('Falta su nombre o razón social.')).toBeTruthy();
    expect(screen.getByText('El código postal debe tener 5 números.')).toBeTruthy();
    expect(screen.getByText('Elija su régimen fiscal.')).toBeTruthy();
    expect(screen.getByText('Elija el uso de la factura.')).toBeTruthy();
    expect(screen.getByText('Para continuar debe aceptar el aviso de privacidad.')).toBeTruthy();
    expect(s.espias.solicitudes).toHaveLength(0);
  });

  it('sin la casilla del aviso de privacidad no se puede enviar', async () => {
    const s = servidor();
    montar(s);
    await pasarAlFormulario(s);
    llenarDatos();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir mi factura' }));
    expect(
      await screen.findByText('Para continuar debe aceptar el aviso de privacidad.'),
    ).toBeTruthy();
    expect(s.espias.solicitudes).toHaveLength(0);
  });

  it('la casilla menciona la transferencia al proveedor y enlaza el aviso completo', async () => {
    const s = servidor();
    montar(s);
    await pasarAlFormulario(s);
    expect(
      screen.getByText(/transferencia de mis datos fiscales al proveedor que timbra/),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Leer el aviso de privacidad' }).getAttribute('href'),
    ).toBe('/aviso');
  });

  it('los regímenes que ofrece dependen del RFC: de empresa o de persona', async () => {
    const s = servidor();
    montar(s);
    await pasarAlFormulario(s);
    const opciones = () =>
      within(screen.getByLabelText('Régimen fiscal'))
        .getAllByRole('option')
        .map((o) => o.getAttribute('value'));
    escribir('RFC', 'ABC010101AB1');
    expect(opciones()).toContain('601');
    expect(opciones()).not.toContain('612');
    escribir('RFC', 'XAXX010101000');
    expect(opciones()).toContain('612');
    expect(opciones()).not.toContain('601');
  });

  it('el uso de la factura no ofrece pagos, nómina ni devoluciones', async () => {
    const s = servidor();
    montar(s);
    await pasarAlFormulario(s);
    const valores = within(screen.getByLabelText('Uso de la factura'))
      .getAllByRole('option')
      .map((o) => o.getAttribute('value'));
    expect(valores).toContain('G03');
    expect(valores).toContain('S01');
    for (const prohibido of ['CP01', 'CN01', 'G02']) {
      expect(valores).not.toContain(prohibido);
    }
  });

  it('con todo en orden manda los datos normalizados y un identificador de solicitud', async () => {
    const s = servidor();
    montar(s);
    await pasarAlFormulario(s);
    llenarDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir mi factura' }));
    expect(await screen.findByText('Su factura está lista')).toBeTruthy();
    expect(s.espias.solicitudes[0]).toMatchObject({
      folio: 'V-2026-0001',
      code: 'BBBBBBBB',
      requestId: ID,
      acceptedPrivacy: true,
      recipient: {
        rfc: 'XAXX010101000',
        name: 'CLIENTE DE PRUEBA',
        fiscalZip: '55900',
        regime: '616',
        cfdiUse: 'S01',
      },
    });
  });

  it('los datos que el servidor rechaza se marcan en su campo', async () => {
    const s = servidor({
      solicitud: { kind: 'INVALID', fields: ['recipient.rfc', 'recipient.regime'] },
    });
    montar(s);
    await pasarAlFormulario(s);
    llenarDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir mi factura' }));
    expect(
      await screen.findByText('El RFC no tiene el formato correcto (12 o 13 caracteres).'),
    ).toBeTruthy();
    expect(screen.getByText('Elija su régimen fiscal.')).toBeTruthy();
    expect(screen.queryByText('Su factura está lista')).toBeNull();
  });

  it('cada motivo por el que no se pudo emitir se explica y manda a pedirla en el negocio', async () => {
    const casos: [PortalSolicitudResultado, string][] = [
      [
        { kind: 'PAYMENT_FORM_UNDEFINED' },
        'Esta compra se pagó de una forma que no podemos facturar por aquí.',
      ],
      [{ kind: 'NOT_BILLABLE' }, 'No pudimos preparar su factura por aquí.'],
      [{ kind: 'REJECTED' }, 'No se pudo emitir la factura con esos datos.'],
      [{ kind: 'INELIGIBLE', reason: 'ALREADY_INVOICED' }, 'Esta compra ya tiene una factura.'],
      [{ kind: 'NO_NETWORK' }, 'No hay conexión a internet.'],
      [{ kind: 'UNAVAILABLE' }, 'El servicio de facturas no está disponible en este momento.'],
      [{ kind: 'BLOCKED', retryAfterSeconds: 120 }, 'Hizo demasiados intentos.'],
    ];
    for (const [solicitud, texto] of casos) {
      const s = servidor({ solicitud });
      const { unmount } = montar(s);
      await pasarAlFormulario(s);
      llenarDatos();
      fireEvent.click(screen.getByRole('button', { name: 'Pedir mi factura' }));
      expect(await screen.findByText(texto)).toBeTruthy();
      unmount();
    }
  });

  it('si el proveedor está procesando, ofrece revisar de nuevo con la misma solicitud y no duplica', async () => {
    const s = servidor({
      solicitud: [{ kind: 'IN_PROCESS' }, { kind: 'STAMPED', folio: 'F-2026-0001', uuid: 'u-1' }],
    });
    montar(s);
    await pasarAlFormulario(s);
    llenarDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir mi factura' }));
    expect(await screen.findByText('Su factura se está procesando.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar de nuevo' }));
    expect(await screen.findByText('Su factura está lista')).toBeTruthy();
    expect(s.espias.solicitudes.map((x) => x.requestId)).toEqual([ID, ID]);
  });

  it('se puede volver a cambiar el ticket', async () => {
    const s = servidor();
    montar(s);
    await pasarAlFormulario(s);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar mi ticket' }));
    expect(screen.getByLabelText('Folio de su ticket')).toBeTruthy();
  });
});

describe('paso 3: la factura', () => {
  async function factura(s: ReturnType<typeof servidor>): Promise<void> {
    await pasarAlFormulario(s);
    llenarDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir mi factura' }));
    await screen.findByText('Su factura está lista');
  }

  it('muestra el folio de la factura y ofrece descargar el PDF y el XML', async () => {
    const s = servidor();
    montar(s);
    await factura(s);
    expect(screen.getByText('F-2026-0001')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descargar XML' })).toBeTruthy();
  });

  it('cada descarga pide el formato con el folio y el código y entrega el archivo', async () => {
    const s = servidor();
    montar(s);
    await factura(s);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    expect(await screen.findByText('Se descargó F-2026-0001.pdf.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar XML' }));
    await waitFor(() => {
      expect(s.espias.archivos).toHaveLength(2);
    });
    expect(s.espias.descargas.map((d) => d.formato)).toEqual(['pdf', 'xml']);
    expect(s.espias.descargas[0]?.entrada).toMatchObject({
      folio: 'V-2026-0001',
      code: 'BBBBBBBB',
    });
    expect(s.espias.archivos.map((a) => a.filename)).toEqual([
      'F-2026-0001.pdf',
      'F-2026-0001.xml',
    ]);
  });

  it('si la descarga falla lo dice y dice qué hacer', async () => {
    const casos: [PortalDescargaResultado, string][] = [
      [{ kind: 'NO_NETWORK' }, 'No hay conexión a internet.'],
      [{ kind: 'NOT_AVAILABLE' }, 'No encontramos una compra con ese folio y ese código.'],
      [{ kind: 'UNAVAILABLE' }, 'El servicio de facturas no está disponible en este momento.'],
      [{ kind: 'BLOCKED', retryAfterSeconds: 300 }, 'Hizo demasiados intentos.'],
    ];
    for (const [descarga, texto] of casos) {
      const s = servidor({ descarga });
      const { unmount } = montar(s);
      await factura(s);
      fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
      expect(await screen.findByText(texto)).toBeTruthy();
      expect(s.espias.archivos).toHaveLength(0);
      unmount();
    }
  });
});

describe('accesibilidad del portal [RF-M10-16, RNF-28]', () => {
  it('cada paso no tiene violaciones de accesibilidad', async () => {
    const s = servidor();
    const { container } = montar(s);
    const revisar = async (): Promise<string[]> =>
      (
        await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
      ).violations.map((v) => `${v.id}: ${v.help}`);
    expect(await revisar()).toEqual([]);
    await pasarAlFormulario(s);
    expect(await revisar()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Pedir mi factura' }));
    await screen.findByText('Para continuar debe aceptar el aviso de privacidad.');
    expect(await revisar()).toEqual([]);
    llenarDatos();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir mi factura' }));
    await screen.findByText('Su factura está lista');
    expect(await revisar()).toEqual([]);
  });

  it('los tres pasos se anuncian y el actual se marca', async () => {
    const s = servidor();
    montar(s);
    const pasos = within(
      screen.getByRole('list', { name: 'Pasos para pedir su factura' }),
    ).getAllByRole('listitem');
    expect(pasos.map((p) => p.textContent)).toEqual(['1Su ticket', '2Sus datos', '3Su factura']);
    expect(pasos[0]?.getAttribute('aria-current')).toBe('step');
    await pasarAlFormulario(s);
    expect(
      within(screen.getByRole('list', { name: 'Pasos para pedir su factura' }))
        .getAllByRole('listitem')[1]
        ?.getAttribute('aria-current'),
    ).toBe('step');
  });
});

describe('rutas del portal en la aplicación', () => {
  it('/factura abre el portal sin el marco; /f/:folio/:codigo lo abre con el QR puesto', () => {
    const s = servidor();
    const portal = { consultar: s.consultar, solicitar: s.solicitar, descargar: s.descargar };
    const { unmount } = render(
      <MemoryRouter initialEntries={['/factura']}>
        <App portal={portal} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Pida su factura' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    unmount();
    render(
      <MemoryRouter initialEntries={['/f/OT-2026-0007/CCCCCCCC']}>
        <App portal={portal} />
      </MemoryRouter>,
    );
    const formulario = screen.getByRole('heading', { name: 'Pida su factura' }).closest('article');
    if (formulario === null) {
      throw new Error('falta el formulario');
    }
    const dentro = within(formulario);
    expect(dentro.getByLabelText<HTMLInputElement>('Folio de su ticket').value).toBe(
      'OT-2026-0007',
    );
    expect(dentro.getByLabelText<HTMLInputElement>('Código de verificación').value).toBe(
      'CCCCCCCC',
    );
  });
});
