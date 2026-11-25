import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  asId,
  fixedClock,
  inMemorySyncOutbox,
  ok,
  outboxCashShiftStore,
  outboxCounterSaleStore,
  outboxPaymentStore,
  type CashDeps,
  type QuoteActor,
  type ShareService,
  type SheetPrinter,
  type SummarySheet,
} from '@zammir/core';
import { describe, expect, it, vi } from 'vitest';

import { TurnoDeCaja, type HojaDelCorte } from './TurnoDeCaja';

// S4-39 · El corte de caja sale en hoja carta: se envía por WhatsApp o se imprime, justo al cerrar el turno
// y también después, desde "Ver corte" en la tabla de turnos [ADR-0040].

const cajero: QuoteActor = {
  userId: asId<'User'>('00000000-0000-4000-8000-00000000a001'),
  role: 'STAFF',
};

let contador = 0;
const ids = {
  newId: <E extends string>() => {
    contador += 1;
    return asId<E>(`00000000-0000-4000-8000-${String(contador).padStart(12, '0')}`);
  },
};

function montar(opciones: { falla?: boolean; sinHoja?: boolean } = {}) {
  const reloj = fixedClock(new Date('2026-10-31T18:00:00.000Z'));
  const outbox = inMemorySyncOutbox({ clock: reloj });
  const cash: CashDeps = {
    shifts: outboxCashShiftStore(outbox),
    payments: outboxPaymentStore(outbox),
    sales: outboxCounterSaleStore(outbox),
    outbox,
    idGenerator: ids,
    clock: reloj,
    device: { id: '00000000-0000-4000-8000-0000000000d1' },
  };
  const impresas: SummarySheet[] = [];
  const renderizadas: SummarySheet[] = [];
  const compartidos: string[] = [];
  const impresora: SheetPrinter = {
    print: (hoja) => {
      if (opciones.falla === true) {
        return Promise.resolve({ ok: false as const, error: { code: 'PRINT_FAILED' as const } });
      }
      impresas.push(hoja);
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
  const hoja: HojaDelCorte = {
    negocio: { name: 'ZAMMIR (datos de prueba)', phone: null, address: null },
    renderer: {
      render: (h) => {
        renderizadas.push(h);
        return Promise.resolve(ok(Uint8Array.of(0x25, 0x50, 0x44, 0x46)));
      },
    },
    share,
    impresora,
  };
  render(
    <TurnoDeCaja
      cash={cash}
      actor={cajero}
      personas={[{ id: cajero.userId, name: 'Beto' }]}
      autorizacion={{
        administradores: () => Promise.resolve([]),
        autorizar: () => Promise.reject(new Error('no se usa')),
      }}
      version={0}
      {...(opciones.sinHoja === true ? {} : { hoja })}
    />,
  );
  return { impresas, renderizadas, compartidos };
}

async function cerrarUnTurno(fondo: string, contado: string): Promise<void> {
  escribir(await screen.findByLabelText('Fondo inicial en el cajón (opcional)'), fondo);
  fireEvent.click(screen.getByRole('button', { name: 'Abrir turno' }));
  await screen.findByText(/Turno abierto desde las/);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar turno' }));
  escribir(await screen.findByLabelText('Efectivo contado'), contado);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar y calcular el corte' }));
  // Si no cuadra, primero se explica la diferencia [RF-M4-09].
  const paso = await waitFor(() => {
    const grupo = screen.queryByRole('group', { name: 'Explicar la diferencia' });
    if (grupo === null && screen.queryByText(/Corte cerrado/) === null) {
      throw new Error('todavía no');
    }
    return grupo;
  });
  if (paso !== null) {
    escribir(screen.getByLabelText(/¿Por qué hay diferencia/), 'Cambio mal dado');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar el turno con esta explicación' }));
  }
  await screen.findByText(/Corte cerrado/);
}

function escribir(campo: HTMLElement, valor: string): void {
  fireEvent.change(campo, { target: { value: valor } });
}

async function grupo(): Promise<HTMLElement> {
  return screen.findByRole('group', { name: 'Enviar o imprimir' });
}

describe('Corte de caja en hoja carta', () => {
  it('al cerrar el turno ofrece "Enviar por WhatsApp" e "Imprimir" juntos', async () => {
    montar();
    await cerrarUnTurno('500', '520');
    expect(
      within(await grupo())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Enviar por WhatsApp', 'Imprimir']);
  });

  it('imprimir manda la hoja del corte con sus importes y la diferencia', async () => {
    const { impresas } = montar();
    await cerrarUnTurno('500', '520');
    fireEvent.click(within(await grupo()).getByRole('button', { name: 'Imprimir' }));
    expect(await screen.findByText('Se abrió la impresión. Elija su impresora.')).toBeTruthy();
    expect(impresas).toHaveLength(1);
    const hoja = impresas[0];
    if (hoja === undefined) {
      throw new Error('no se imprimió');
    }
    expect(hoja.title).toBe('Corte de caja');
    expect(hoja.subtitle).toBe('Turno de Beto');
    const filas = hoja.sections.flatMap((s) => s.rows.map((r) => `${r.label}: ${r.value}`));
    expect(filas).toContain('Fondo inicial: $500.00');
    expect(filas).toContain('Efectivo esperado: $500.00');
    expect(filas).toContain('Efectivo contado: $520.00');
    expect(filas).toContain('Diferencia: Sobrante $20.00');
  });

  it('enviar por WhatsApp comparte el PDF del corte con el nombre del cajero y el día', async () => {
    const { compartidos, renderizadas } = montar();
    await cerrarUnTurno('500', '500');
    fireEvent.click(within(await grupo()).getByRole('button', { name: 'Enviar por WhatsApp' }));
    expect(await screen.findByText('Listo: elige WhatsApp en el menú.')).toBeTruthy();
    expect(renderizadas).toHaveLength(1);
    expect(compartidos).toEqual([
      'Corte-de-caja-2026-10-31.pdf | Corte de caja de Beto del 2026-10-31.',
    ]);
  });

  it('si no se puede imprimir dice qué hacer y el corte sigue a la vista', async () => {
    montar({ falla: true });
    await cerrarUnTurno('0', '0');
    fireEvent.click(within(await grupo()).getByRole('button', { name: 'Imprimir' }));
    expect(await screen.findByText('No se pudo abrir la impresión.')).toBeTruthy();
    expect(screen.getByText(/Corte cerrado/)).toBeTruthy();
  });

  it('un turno cerrado se puede volver a ver y a imprimir desde la tabla con "Ver corte"', async () => {
    const { impresas } = montar();
    await cerrarUnTurno('500', '500');
    // Se abre otro turno: el panel del corte anterior desaparece y queda solo en la tabla.
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByText(/Turno abierto desde las/);
    expect(screen.queryByText(/Corte cerrado/)).toBeNull();

    const tabla = await screen.findByRole('table', { name: 'Turnos' });
    fireEvent.click(within(tabla).getByRole('button', { name: 'Ver corte' }));
    expect(await screen.findByText(/Corte cerrado/)).toBeTruthy();
    fireEvent.click(within(await grupo()).getByRole('button', { name: 'Imprimir' }));
    await waitFor(() => {
      expect(impresas).toHaveLength(1);
    });
    expect(impresas[0]?.subtitle).toBe('Turno de Beto');
  });

  it('un turno abierto no tiene "Ver corte"', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir turno' }));
    await screen.findByText(/Turno abierto desde las/);
    const tabla = await screen.findByRole('table', { name: 'Turnos' });
    expect(within(tabla).queryByRole('button', { name: 'Ver corte' })).toBeNull();
  });

  it('sin la hoja configurada no se ofrece enviar ni imprimir el corte', async () => {
    montar({ sinHoja: true });
    await cerrarUnTurno('0', '0');
    expect(screen.queryByRole('group', { name: 'Enviar o imprimir' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver corte' })).toBeNull();
  });
});
