import { act, render, screen } from '@testing-library/react';
import {
  createSyncEngine,
  exponentialBackoff,
  fixedClock,
  inMemorySyncOutbox,
  seededRandom,
  type SyncEngine,
  type SyncTransport,
} from '@zammir/core';
import { operacionSinSeq } from '@zammir/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IndicadorDeConexion, type SincronizacionVisible } from './IndicadorDeConexion';

function ponerInternet(hay: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(hay);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('indicador de conexión', () => {
  it('con internet no muestra nada', () => {
    ponerInternet(true);
    render(<IndicadorDeConexion />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('sin internet avisa que se puede seguir trabajando', () => {
    ponerInternet(false);
    render(<IndicadorDeConexion />);
    expect(screen.getByRole('status').textContent).toBe(
      'Sin internet. Sigues trabajando: lo que captures queda guardado en la tablet.',
    );
  });

  it('aparece al perder el internet y desaparece al volver', () => {
    ponerInternet(true);
    render(<IndicadorDeConexion />);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status')).toBeTruthy();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('indicador con envío pendiente', () => {
  const reloj = fixedClock(new Date('2026-10-30T12:00:00.000Z'));

  async function conPendientes(n: number, transporte: SyncTransport) {
    const outbox = inMemorySyncOutbox({ clock: reloj });
    for (let i = 0; i < n; i += 1) {
      await outbox.transaction(async (tx) => {
        await tx.enqueue(operacionSinSeq());
      });
    }
    const engine: SyncEngine = createSyncEngine({
      outbox,
      transport: transporte,
      backoff: exponentialBackoff(),
      random: seededRandom(1),
      timer: { after: () => () => undefined },
      clock: reloj,
    });
    return engine;
  }

  const sinRed: SyncTransport = {
    send: () => Promise.resolve({ ok: false, error: { code: 'NETWORK_UNAVAILABLE' } }),
  };

  function visible(engine: SyncEngine, horas: number | null, ahora: Date): SincronizacionVisible {
    return { engine, staleHours: horas, ahora: () => ahora };
  }

  it('con internet y pendientes muestra "N pendientes"', async () => {
    ponerInternet(true);
    const engine = await conPendientes(3, sinRed);
    await act(async () => {
      await engine.trigger();
    });
    render(<IndicadorDeConexion sincronizacion={visible(engine, 6, reloj.now())} />);
    expect(screen.getByRole('status').textContent).toContain('3 pendientes');
  });

  it('usa el singular con un solo pendiente', async () => {
    ponerInternet(true);
    const engine = await conPendientes(1, sinRed);
    await act(async () => {
      await engine.trigger();
    });
    render(<IndicadorDeConexion sincronizacion={visible(engine, 6, reloj.now())} />);
    expect(screen.getByRole('status').textContent).toContain('1 pendiente');
    expect(screen.getByRole('status').textContent).not.toContain('1 pendientes');
  });

  it('sin internet dice que se puede seguir trabajando y cuántos faltan por enviar', async () => {
    ponerInternet(false);
    const engine = await conPendientes(2, sinRed);
    await act(async () => {
      await engine.trigger();
    });
    render(<IndicadorDeConexion sincronizacion={visible(engine, 6, reloj.now())} />);
    const texto = screen.getByRole('status').textContent;
    expect(texto).toContain('Sin internet.');
    expect(texto).toContain('2 pendientes');
    expect(texto).toContain('Se enviarán solos al volver el internet.');
  });

  it('con todo enviado y con internet no muestra nada', async () => {
    ponerInternet(true);
    const bien: SyncTransport = {
      send: () => Promise.resolve({ ok: true, value: { ok: true, status: 'APPLIED' } }),
    };
    const engine = await conPendientes(2, bien);
    await act(async () => {
      await engine.trigger();
    });
    render(<IndicadorDeConexion sincronizacion={visible(engine, 6, reloj.now())} />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('avisa si lo pendiente lleva más de las horas configuradas, y no antes', async () => {
    ponerInternet(true);
    const engine = await conPendientes(1, sinRed);
    await act(async () => {
      await engine.trigger();
    });
    const { rerender } = render(
      <IndicadorDeConexion
        sincronizacion={visible(engine, 6, new Date('2026-10-30T17:59:59.000Z'))}
      />,
    );
    expect(screen.getByRole('status').textContent).not.toContain('sin enviar desde hace');
    rerender(
      <IndicadorDeConexion
        sincronizacion={visible(engine, 6, new Date('2026-10-30T18:00:00.000Z'))}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain(
      'Hay documentos sin enviar desde hace 6 horas. Conéctate a internet.',
    );
  });

  it('si la configuración aún no se ha bajado, no avisa de antigüedad', async () => {
    ponerInternet(true);
    const engine = await conPendientes(1, sinRed);
    await act(async () => {
      await engine.trigger();
    });
    render(
      <IndicadorDeConexion
        sincronizacion={visible(engine, null, new Date('2027-01-01T00:00:00.000Z'))}
      />,
    );
    expect(screen.getByRole('status').textContent).not.toContain('sin enviar desde hace');
  });

  it('un problema estructural pide avisar a soporte', async () => {
    ponerInternet(true);
    const malo: SyncTransport = {
      send: () => Promise.resolve({ ok: true, value: { ok: false, code: 'INVALID_PAYLOAD' } }),
    };
    const engine = await conPendientes(1, malo);
    await act(async () => {
      await engine.trigger();
    });
    render(<IndicadorDeConexion sincronizacion={visible(engine, 6, reloj.now())} />);
    expect(screen.getByRole('status').textContent).toContain(
      'Hay un problema con un documento. Avisa a soporte.',
    );
  });
});
