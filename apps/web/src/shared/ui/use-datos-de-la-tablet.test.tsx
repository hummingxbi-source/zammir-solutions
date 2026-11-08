import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { REINTENTO_DE_LA_TABLET_MS, useDatosDeLaTablet } from './use-datos-de-la-tablet';

/** Deja correr las promesas pendientes sin mover el reloj. */
const asentar = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};
const avanzar = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('datos de la tablet con reintento', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('empieza sin saber (undefined) y entrega lo que haya en cuanto está listo', async () => {
    const preparar = vi.fn(() => Promise.resolve({ listo: true }));
    const { result } = renderHook(() => useDatosDeLaTablet(preparar));
    expect(result.current).toBeUndefined();
    await asentar();
    expect(result.current).toEqual({ listo: true });
    expect(preparar).toHaveBeenCalledTimes(1);
  });

  it('si todavía no está lista (null) vuelve a intentar sola cada pocos segundos y se detiene al lograrlo', async () => {
    let intentos = 0;
    const preparar = vi.fn(() => {
      intentos += 1;
      return Promise.resolve(intentos < 3 ? null : { listo: true });
    });
    const { result } = renderHook(() => useDatosDeLaTablet(preparar));
    await asentar();
    expect(result.current).toBeNull();
    await avanzar(REINTENTO_DE_LA_TABLET_MS - 1);
    expect(preparar).toHaveBeenCalledTimes(1);
    await avanzar(1);
    expect(preparar).toHaveBeenCalledTimes(2);
    expect(result.current).toBeNull();
    await avanzar(REINTENTO_DE_LA_TABLET_MS);
    expect(result.current).toEqual({ listo: true });
    expect(preparar).toHaveBeenCalledTimes(3);
    await avanzar(REINTENTO_DE_LA_TABLET_MS * 5);
    expect(preparar).toHaveBeenCalledTimes(3);
  });

  it('una falla al reunir los datos cuenta como "todavía no" y reintenta', async () => {
    let intentos = 0;
    const preparar = vi.fn(() => {
      intentos += 1;
      return intentos === 1
        ? Promise.reject(new Error('base ocupada'))
        : Promise.resolve({ ok: 1 });
    });
    const { result } = renderHook(() => useDatosDeLaTablet(preparar));
    await asentar();
    expect(result.current).toBeNull();
    await avanzar(REINTENTO_DE_LA_TABLET_MS);
    expect(result.current).toEqual({ ok: 1 });
  });

  it('al volver la conexión intenta de inmediato, sin esperar al siguiente turno', async () => {
    let listo = false;
    const preparar = vi.fn(() => Promise.resolve(listo ? { ok: 1 } : null));
    const { result } = renderHook(() => useDatosDeLaTablet(preparar));
    await asentar();
    expect(result.current).toBeNull();
    listo = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current).toEqual({ ok: 1 });
    expect(preparar).toHaveBeenCalledTimes(2);
  });

  it('ya lista, al volver la conexión refresca lo que muestra', async () => {
    let version = 1;
    const preparar = vi.fn(() => Promise.resolve({ version }));
    const { result } = renderHook(() => useDatosDeLaTablet(preparar));
    await asentar();
    expect(result.current).toEqual({ version: 1 });
    version = 2;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current).toEqual({ version: 2 });
  });

  it('al salir de la pantalla deja de intentar y de escuchar la conexión', async () => {
    const preparar = vi.fn(() => Promise.resolve(null));
    const { unmount } = renderHook(() => useDatosDeLaTablet(preparar));
    await asentar();
    expect(preparar).toHaveBeenCalledTimes(1);
    unmount();
    await avanzar(REINTENTO_DE_LA_TABLET_MS * 3);
    window.dispatchEvent(new Event('online'));
    await asentar();
    expect(preparar).toHaveBeenCalledTimes(1);
  });

  it('respeta un tiempo de reintento distinto', async () => {
    const preparar = vi.fn(() => Promise.resolve(null));
    renderHook(() => useDatosDeLaTablet(preparar, 500));
    await asentar();
    await avanzar(500);
    expect(preparar).toHaveBeenCalledTimes(2);
  });
});
