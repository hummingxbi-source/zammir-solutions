import axe from 'axe-core';
import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  type PortalConsulta,
  type PortalConsultaEntrada,
  type PortalConsultaResultado,
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

/** Consulta de mentira: guarda lo que se le mandó y responde lo que se le pida. */
function consultaDe(respuesta: PortalConsultaResultado) {
  const llamadas: PortalConsultaEntrada[] = [];
  const consultar: PortalConsulta = (entrada) => {
    llamadas.push(entrada);
    return Promise.resolve(respuesta);
  };
  return { consultar, llamadas };
}

// El reloj de la página: abierta en 0 y enviada 10 s después, como lo haría una persona.
function reloj(...marcas: number[]): () => number {
  let i = 0;
  return () => marcas[Math.min(i++, marcas.length - 1)] ?? 0;
}

function llenar(folio: string, codigo: string): void {
  fireEvent.change(screen.getByLabelText('Folio de tu ticket'), { target: { value: folio } });
  fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: codigo } });
}

describe('portal de autofacturación', () => {
  it('con folio y código correctos muestra solo conceptos, total y el plazo', async () => {
    const { consultar, llamadas } = consultaDe({ kind: 'OK', document: documento });
    render(<PortalDeFactura consultar={consultar} ahora={reloj(0, 10_000)} />);
    llenar(' v-2026-0001 ', 'bbbb-bbbb');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Chapa de seguridad')).toBeTruthy();
    expect(screen.getByText('$116.00', { selector: 'strong' })).toBeTruthy();
    expect(screen.getByText('Puedes pedir tu factura hasta el 30 nov 2026.')).toBeTruthy();
    expect(screen.queryByLabelText('Folio de tu ticket')).toBeNull();
    // Se manda normalizado, con el campo trampa vacío y el tiempo que tardó.
    expect(llamadas).toEqual([
      { folio: 'V-2026-0001', code: 'BBBBBBBB', honeypot: '', elapsedMs: 10_000, token: null },
    ]);
  });

  it('el QR trae el folio y el código ya puestos, y también se pueden teclear a mano', () => {
    const { consultar } = consultaDe({ kind: 'NOT_AVAILABLE' });
    render(
      <PortalDeFactura
        consultar={consultar}
        inicial={{ folio: 'OT-2026-0007', code: 'CCCCCCCC' }}
      />,
    );
    expect(screen.getByLabelText<HTMLInputElement>('Folio de tu ticket').value).toBe(
      'OT-2026-0007',
    );
    expect(screen.getByLabelText<HTMLInputElement>('Código de verificación').value).toBe(
      'CCCCCCCC',
    );
    fireEvent.change(screen.getByLabelText('Folio de tu ticket'), {
      target: { value: 'V-2026-0002' },
    });
    expect(screen.getByLabelText<HTMLInputElement>('Folio de tu ticket').value).toBe('V-2026-0002');
  });

  it('un folio o código que no cuadran dan siempre el mismo mensaje, que dice qué hacer', async () => {
    const { consultar } = consultaDe({ kind: 'NOT_AVAILABLE' });
    render(<PortalDeFactura consultar={consultar} ahora={reloj(0, 10_000)} />);
    llenar('V-2026-0999', 'ZZZZZZZZ');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText('No encontramos una compra con ese folio y ese código.'),
    ).toBeTruthy();
    // El mensaje cubre también el caso de un documento hecho sin internet que aún no llega [RF-M10-17].
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
      const { consultar } = consultaDe({ kind: 'INELIGIBLE', reason: razon });
      const { unmount } = render(
        <PortalDeFactura consultar={consultar} ahora={reloj(0, 10_000)} />,
      );
      llenar('V-2026-0001', 'BBBBBBBB');
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      expect(await screen.findByText(texto)).toBeTruthy();
      unmount();
    }
  });

  it('si el plazo venció manda a pedirla directamente en el negocio', async () => {
    const { consultar } = consultaDe({ kind: 'INELIGIBLE', reason: 'EXPIRED' });
    render(<PortalDeFactura consultar={consultar} ahora={reloj(0, 10_000)} />);
    llenar('V-2026-0001', 'BBBBBBBB');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText(/Pídela directamente en el negocio/)).toBeTruthy();
  });

  it('con demasiados intentos dice cuántos minutos esperar', async () => {
    const { consultar } = consultaDe({ kind: 'BLOCKED', retryAfterSeconds: 900 });
    render(<PortalDeFactura consultar={consultar} ahora={reloj(0, 10_000)} />);
    llenar('V-2026-0001', 'BBBBBBBB');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Hiciste demasiados intentos.')).toBeTruthy();
    expect(screen.getByText(/Espera 15 minutos/)).toBeTruthy();
  });

  it('sin red y con el servicio caído avisa distinto, y siempre dice qué hacer', async () => {
    for (const [r, texto] of [
      [{ kind: 'NO_NETWORK' }, 'No hay conexión a internet.'],
      [{ kind: 'UNAVAILABLE' }, 'El servicio de facturas no está disponible en este momento.'],
    ] as const) {
      const { consultar } = consultaDe(r);
      const { unmount } = render(
        <PortalDeFactura consultar={consultar} ahora={reloj(0, 10_000)} />,
      );
      llenar('V-2026-0001', 'BBBBBBBB');
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
      expect(await screen.findByText(texto)).toBeTruthy();
      unmount();
    }
  });

  it('el campo trampa existe, está oculto para las personas y viaja con lo que contenga', async () => {
    const { consultar, llamadas } = consultaDe({ kind: 'NOT_AVAILABLE' });
    const { container } = render(
      <PortalDeFactura consultar={consultar} ahora={reloj(0, 10_000)} />,
    );
    const trampa = container.querySelector<HTMLInputElement>('input[name="sitio_web"]');
    if (trampa === null) {
      throw new Error('falta el campo trampa');
    }
    expect(trampa.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(trampa.tabIndex).toBe(-1);
    fireEvent.change(trampa, { target: { value: 'http://spam.invalid' } });
    llenar('V-2026-0001', 'BBBBBBBB');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => {
      expect(llamadas).toHaveLength(1);
    });
    expect(llamadas[0]?.honeypot).toBe('http://spam.invalid');
  });

  it('con verificación externa configurada no deja continuar hasta tener su token', async () => {
    const { consultar, llamadas } = consultaDe({ kind: 'NOT_AVAILABLE' });
    let alResolver: ((token: string) => void) | null = null;
    window.turnstile = {
      render: (_c, opciones) => {
        alResolver = opciones.callback;
        return 'widget-1';
      },
      remove: vi.fn(),
    };
    render(
      <PortalDeFactura consultar={consultar} siteKey="llave-publica" ahora={reloj(0, 10_000)} />,
    );
    llenar('V-2026-0001', 'BBBBBBBB');
    const boton = screen.getByRole('button', { name: 'Continuar' });
    expect((boton as HTMLButtonElement).disabled).toBe(true);
    expect(alResolver).not.toBeNull();
    (alResolver as unknown as (t: string) => void)('token-de-turnstile');
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Continuar' }).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => {
      expect(llamadas).toHaveLength(1);
    });
    expect(llamadas[0]?.token).toBe('token-de-turnstile');
    delete window.turnstile;
  });

  it('el nombre del negocio, si se conoce, encabeza la página', () => {
    const { consultar } = consultaDe({ kind: 'NOT_AVAILABLE' });
    render(<PortalDeFactura consultar={consultar} negocio="ZAMMIR (prueba)" />);
    expect(screen.getByText('ZAMMIR (prueba)')).toBeTruthy();
  });
});

describe('accesibilidad del portal [RF-M10-16, RNF-28]', () => {
  it('el formulario y el resultado no tienen violaciones de accesibilidad', async () => {
    const { consultar } = consultaDe({ kind: 'OK', document: documento });
    const { container } = render(
      <PortalDeFactura consultar={consultar} ahora={reloj(0, 10_000)} />,
    );
    const revisar = async (): Promise<string[]> =>
      (
        await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
      ).violations.map((v) => `${v.id}: ${v.help}`);
    expect(await revisar()).toEqual([]);
    llenar('V-2026-0001', 'BBBBBBBB');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('Chapa de seguridad');
    expect(await revisar()).toEqual([]);
  });
});

describe('rutas del portal en la aplicación', () => {
  it('/factura abre el portal sin el marco; /f/:folio/:codigo lo abre con el QR puesto', () => {
    const { consultar } = consultaDe({ kind: 'NOT_AVAILABLE' });
    const { unmount } = render(
      <MemoryRouter initialEntries={['/factura']}>
        <App portal={{ consultar }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Pide tu factura' })).toBeTruthy();
    expect(screen.queryByRole('navigation')).toBeNull();
    unmount();
    render(
      <MemoryRouter initialEntries={['/f/OT-2026-0007/CCCCCCCC']}>
        <App portal={{ consultar }} />
      </MemoryRouter>,
    );
    const formulario = screen.getByRole('heading', { name: 'Pide tu factura' }).closest('article');
    if (formulario === null) {
      throw new Error('falta el formulario');
    }
    const dentro = within(formulario);
    expect(dentro.getByLabelText<HTMLInputElement>('Folio de tu ticket').value).toBe(
      'OT-2026-0007',
    );
    expect(dentro.getByLabelText<HTMLInputElement>('Código de verificación').value).toBe(
      'CCCCCCCC',
    );
  });
});
