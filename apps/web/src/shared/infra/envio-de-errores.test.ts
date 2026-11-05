import { createErrorReporter, type ErrorReport } from '@zammir/core';
import { describe, expect, it } from 'vitest';

import {
  envioDeErrores,
  instalarCapturaDeErrores,
  type VentanaDeErrores,
} from './envio-de-errores';

const reporte: ErrorReport = {
  source: 'CLIENT',
  name: 'Error',
  message: 'Falló',
  stack: '',
  route: '/x',
  appVersion: '1',
};

describe('envío de errores', () => {
  it('manda el reporte a registrar-error con las llaves públicas', async () => {
    const llamadas: { url: string; init: RequestInit }[] = [];
    const enviar = envioDeErrores({
      url: 'https://x.invalid',
      anonKey: 'anon',
      fetchImpl: (url, init) => {
        llamadas.push({ url: url as string, init: init ?? {} });
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    });
    await enviar(reporte);
    expect(llamadas[0]?.url).toBe('https://x.invalid/functions/v1/registrar-error');
    expect(llamadas[0]?.init.method).toBe('POST');
    expect(JSON.parse(llamadas[0]?.init.body as string)).toEqual(reporte);
    expect(llamadas[0]?.init.headers).toMatchObject({
      apikey: 'anon',
      authorization: 'Bearer anon',
    });
  });

  it('sin dirección no envía nada y sin llave no manda cabeceras de acceso', async () => {
    let llamadas = 0;
    const fetchImpl = (): Promise<Response> => {
      llamadas++;
      return Promise.resolve(new Response(null, { status: 204 }));
    };
    await envioDeErrores({ url: undefined, anonKey: undefined, fetchImpl })(reporte);
    await envioDeErrores({ url: '', anonKey: 'a', fetchImpl })(reporte);
    expect(llamadas).toBe(0);
    await envioDeErrores({ url: 'https://x.invalid', anonKey: undefined, fetchImpl })(reporte);
    expect(llamadas).toBe(1);
  });

  it('sin conexión no lanza', async () => {
    const enviar = envioDeErrores({
      url: 'https://x.invalid',
      anonKey: 'a',
      fetchImpl: () => Promise.reject(new Error('sin red')),
    });
    await expect(enviar(reporte)).resolves.toBeUndefined();
  });
});

describe('captura global de errores', () => {
  function ventanaFalsa() {
    const oyentes = new Map<string, (e: never) => void>();
    const ventana = {
      location: { pathname: '/clientes' },
      addEventListener: (tipo: string, fn: (e: never) => void) => {
        oyentes.set(tipo, fn);
      },
      removeEventListener: (tipo: string) => {
        oyentes.delete(tipo);
      },
    } as unknown as VentanaDeErrores;
    return { ventana, oyentes };
  }

  it('manda al reportero los errores y las promesas rechazadas, con la ruta sin consulta', async () => {
    const enviados: ErrorReport[] = [];
    const reportero = createErrorReporter({
      source: 'CLIENT',
      appVersion: '1',
      send: (r) => {
        enviados.push(r);
        return Promise.resolve();
      },
    });
    const { ventana, oyentes } = ventanaFalsa();
    const quitar = instalarCapturaDeErrores(reportero, ventana);
    oyentes.get('error')?.({ error: new Error('uno'), message: 'uno' } as never);
    oyentes.get('unhandledrejection')?.({ reason: new Error('dos') } as never);
    oyentes.get('error')?.({ error: undefined, message: 'tres' } as never);
    await Promise.resolve();
    await Promise.resolve();
    expect(enviados.map((r) => r.message).sort()).toEqual(['dos', 'tres', 'uno']);
    expect(enviados[0]?.route).toBe('/clientes');
    quitar();
    expect(oyentes.size).toBe(0);
  });
});
