import { describe, expect, it } from 'vitest';

import type { PortalConsultaEntrada } from '@zammir/core';

import { functionPortalConsulta } from './function-portal-consulta';

const entrada: PortalConsultaEntrada = {
  folio: 'V-2026-0001',
  code: 'BBBBBBBB',
  honeypot: '',
  elapsedMs: 9_000,
  token: null,
};

function con(estado: number, cuerpo: unknown): ReturnType<typeof functionPortalConsulta> {
  return functionPortalConsulta({
    url: 'https://x.invalid',
    anonKey: 'anon',
    fetchImpl: () => Promise.resolve(new Response(JSON.stringify(cuerpo), { status: estado })),
  });
}

describe('cliente de la función consultar-factura', () => {
  it('manda folio, código y señales a la función con solo la llave pública', async () => {
    const vistos: { url: string; cuerpo: string }[] = [];
    const consultar = functionPortalConsulta({
      url: 'https://x.invalid',
      anonKey: 'anon',
      fetchImpl: (url, init) => {
        vistos.push({
          url: url instanceof Request ? url.url : url.toString(),
          cuerpo: typeof init?.body === 'string' ? init.body : '',
        });
        return Promise.resolve(new Response('{}', { status: 404 }));
      },
    });
    await consultar({ ...entrada, token: 'tok' });
    expect(vistos).toHaveLength(1);
    expect(vistos[0]?.url).toBe('https://x.invalid/functions/v1/consultar-factura');
    expect(JSON.parse(vistos[0]?.cuerpo ?? '{}')).toEqual({
      folio: 'V-2026-0001',
      code: 'BBBBBBBB',
      honeypot: '',
      elapsedMs: 9_000,
      token: 'tok',
    });
  });

  it('200 con documento es un acierto', async () => {
    const documento = {
      type: 'COUNTER_SALE',
      folio: 'V-2026-0001',
      totalCents: 1,
      lines: [],
      deadline: '2026-11-30',
    };
    expect(await con(200, { document: documento })(entrada)).toEqual({
      kind: 'OK',
      document: documento,
    });
  });

  it('cada código HTTP se traduce a su resultado', async () => {
    expect(await con(404, { error: 'NOT_AVAILABLE' })(entrada)).toEqual({ kind: 'NOT_AVAILABLE' });
    expect(await con(429, { error: 'TOO_MANY_ATTEMPTS', retryAfterSeconds: 600 })(entrada)).toEqual(
      {
        kind: 'BLOCKED',
        retryAfterSeconds: 600,
      },
    );
    expect(await con(429, { error: 'TOO_MANY_ATTEMPTS' })(entrada)).toEqual({
      kind: 'BLOCKED',
      retryAfterSeconds: 900,
    });
    expect(await con(409, { error: 'NOT_ELIGIBLE', reason: 'EXPIRED' })(entrada)).toEqual({
      kind: 'INELIGIBLE',
      reason: 'EXPIRED',
    });
    expect(await con(409, { error: 'NOT_ELIGIBLE', reason: 'RARA' })(entrada)).toEqual({
      kind: 'UNAVAILABLE',
    });
    expect(await con(503, { error: 'PORTAL_UNAVAILABLE' })(entrada)).toEqual({
      kind: 'UNAVAILABLE',
    });
    expect(await con(400, { error: 'INVALID_INPUT' })(entrada)).toEqual({ kind: 'UNAVAILABLE' });
  });

  it('una respuesta que no es JSON o un 200 sin documento no se toma por acierto', async () => {
    const noJson = functionPortalConsulta({
      url: 'https://x.invalid',
      anonKey: 'anon',
      fetchImpl: () => Promise.resolve(new Response('<html>', { status: 200 })),
    });
    expect(await noJson(entrada)).toEqual({ kind: 'UNAVAILABLE' });
    expect(await con(200, {})(entrada)).toEqual({ kind: 'UNAVAILABLE' });
  });

  it('sin red lo dice aparte', async () => {
    const sinRed = functionPortalConsulta({
      url: 'https://x.invalid',
      anonKey: 'anon',
      fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    expect(await sinRed(entrada)).toEqual({ kind: 'NO_NETWORK' });
  });
});
