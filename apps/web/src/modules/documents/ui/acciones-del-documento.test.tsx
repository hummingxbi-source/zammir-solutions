import axe from 'axe-core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccionesDelDocumento } from './AccionesDelDocumento';
import { imprimirDocumento } from './imprimir-documento';
import { marcarComoImpresa, yaSeImprimio } from './registro-de-impresiones';
import { documentoDePrueba } from '@zammir/core/testing';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Enviar por WhatsApp e Imprimir', () => {
  it('van juntos en un grupo con nombre: el envío primero y la impresión a su lado', () => {
    render(<AccionesDelDocumento onEnviar={vi.fn()} onImprimir={vi.fn()} />);
    const grupo = screen.getByRole('group', { name: 'Enviar o imprimir' });
    expect(Array.from(grupo.querySelectorAll('button')).map((b) => b.textContent)).toEqual([
      'Enviar por WhatsApp',
      'Imprimir',
    ]);
    expect(grupo.querySelectorAll('button')[0]?.className).not.toContain('secundario');
    expect(grupo.querySelectorAll('button')[1]?.className).toContain('secundario');
  });

  it('cada botón hace lo suyo', async () => {
    const enviar = vi.fn();
    const imprimir = vi.fn();
    render(<AccionesDelDocumento onEnviar={enviar} onImprimir={imprimir} />);
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));
    expect(imprimir).toHaveBeenCalledTimes(1);
    expect(enviar).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: 'Enviar por WhatsApp' }).disabled,
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }));
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it('mientras uno trabaja los dos se bloquean, y al terminar vuelven', async () => {
    let terminar: () => void = () => undefined;
    const lento = vi.fn(
      () =>
        new Promise<void>((resolver) => {
          terminar = resolver;
        }),
    );
    render(<AccionesDelDocumento onEnviar={lento} onImprimir={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }));
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Imprimir' }).disabled).toBe(
        true,
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar por WhatsApp' }));
    expect(lento).toHaveBeenCalledTimes(1);
    terminar();
    await waitFor(() => {
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Imprimir' }).disabled).toBe(
        false,
      );
    });
  });

  it('puede deshabilitarse desde afuera', () => {
    render(<AccionesDelDocumento onEnviar={vi.fn()} onImprimir={vi.fn()} deshabilitado />);
    for (const boton of screen.getAllByRole<HTMLButtonElement>('button')) {
      expect(boton.disabled).toBe(true);
    }
  });

  it('no tiene problemas de accesibilidad', async () => {
    const { container } = render(<AccionesDelDocumento onEnviar={vi.fn()} onImprimir={vi.fn()} />);
    const r = await axe.run(container);
    expect(r.violations).toEqual([]);
  });
});

describe('abrir la impresión', () => {
  it('sin impresora explica qué hacer', async () => {
    const r = await imprimirDocumento(undefined, documentoDePrueba(1));
    expect(r?.mensaje).toBe('No se pudo abrir la impresión.');
    expect(r?.queHacer).toContain('Guarde el PDF');
  });

  it('si la impresora responde bien no hay mensaje; si falla, sí', async () => {
    const ok = { print: () => Promise.resolve({ ok: true as const, value: undefined }) };
    expect(await imprimirDocumento(ok, documentoDePrueba(1))).toBeNull();
    const mal = {
      print: () =>
        Promise.resolve({ ok: false as const, error: { code: 'PRINT_FAILED' as const } }),
    };
    expect((await imprimirDocumento(mal, documentoDePrueba(1)))?.mensaje).toBe(
      'No se pudo abrir la impresión.',
    );
  });

  it('pasa la marca de copia a la impresora', async () => {
    const print = vi.fn(() => Promise.resolve({ ok: true as const, value: undefined }));
    await imprimirDocumento({ print }, documentoDePrueba(1), { copia: true });
    expect(print).toHaveBeenCalledWith(expect.anything(), { copia: true });
  });
});

describe('registro de ventas impresas', () => {
  it('recuerda qué ventas ya se imprimieron en esta tablet', () => {
    expect(yaSeImprimio('v1')).toBe(false);
    marcarComoImpresa('v1');
    expect(yaSeImprimio('v1')).toBe(true);
    expect(yaSeImprimio('v2')).toBe(false);
  });

  it('solo recuerda las más recientes', () => {
    for (let i = 0; i < 350; i += 1) {
      marcarComoImpresa(`v${String(i)}`);
    }
    expect(yaSeImprimio('v0')).toBe(false);
    expect(yaSeImprimio('v349')).toBe(true);
  });

  it('si el navegador no deja guardar, no se rompe y se trata como primera vez', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sin almacenamiento');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sin almacenamiento');
    });
    expect(() => {
      marcarComoImpresa('v1');
    }).not.toThrow();
    expect(yaSeImprimio('v1')).toBe(false);
  });

  it('un valor guardado dañado se ignora', () => {
    localStorage.setItem('zammir-ventas-impresas', '{no es una lista');
    expect(yaSeImprimio('v1')).toBe(false);
    localStorage.setItem('zammir-ventas-impresas', '{"a":1}');
    expect(yaSeImprimio('v1')).toBe(false);
  });
});
