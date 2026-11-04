import type { PortalSolicitudEntrada } from '@zammir/core';
import { describe, expect, it } from 'vitest';

import { functionPortalDescarga, functionPortalSolicitud } from './function-portal-solicitud';

const entrada: PortalSolicitudEntrada = {
  folio: 'V-2026-0001',
  code: 'BBBBBBBB',
  honeypot: '',
  elapsedMs: 9_000,
  token: null,
  requestId: '5b000000-0000-4000-8000-000000000001',
  acceptedPrivacy: true,
  recipient: {
    rfc: 'XAXX010101000',
    name: 'CLIENTE DE PRUEBA',
    fiscalZip: '55900',
    regime: '616',
    cfdiUse: 'S01',
  },
};

function con(estado: number, cuerpo: unknown) {
  const opciones = {
    url: 'https://x.invalid',
    anonKey: 'anon',
    fetchImpl: () => Promise.resolve(new Response(JSON.stringify(cuerpo), { status: estado })),
  };
  return {
    solicitar: functionPortalSolicitud(opciones),
    descargar: functionPortalDescarga(opciones),
  };
}

describe('cliente de solicitar-factura', () => {
  it('manda todo a la función con solo la llave pública', async () => {
    const vistos: { url: string; cuerpo: string }[] = [];
    const solicitar = functionPortalSolicitud({
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
    await solicitar(entrada);
    expect(vistos[0]?.url).toBe('https://x.invalid/functions/v1/solicitar-factura');
    expect(JSON.parse(vistos[0]?.cuerpo ?? '{}')).toEqual({
      folio: 'V-2026-0001',
      code: 'BBBBBBBB',
      honeypot: '',
      elapsedMs: 9_000,
      token: null,
      requestId: '5b000000-0000-4000-8000-000000000001',
      recipient: entrada.recipient,
      acceptedPrivacy: true,
    });
  });

  it('un 200 con factura es un acierto con su folio', async () => {
    const r = await con(200, { invoice: { folio: 'F-2026-0001', uuid: 'u-1' } }).solicitar(entrada);
    expect(r).toEqual({ kind: 'STAMPED', folio: 'F-2026-0001', uuid: 'u-1' });
  });

  it('cada código de la función se traduce a su resultado', async () => {
    const caso = async (estado: number, cuerpo: unknown) => con(estado, cuerpo).solicitar(entrada);
    expect(await caso(202, { status: 'IN_PROCESS' })).toEqual({ kind: 'IN_PROCESS' });
    expect(await caso(404, { error: 'NOT_AVAILABLE' })).toEqual({ kind: 'NOT_AVAILABLE' });
    expect(await caso(429, { retryAfterSeconds: 600 })).toEqual({
      kind: 'BLOCKED',
      retryAfterSeconds: 600,
    });
    expect(await caso(429, {})).toEqual({ kind: 'BLOCKED', retryAfterSeconds: 900 });
    expect(await caso(422, { error: 'REJECTED', code: 'X' })).toEqual({ kind: 'REJECTED' });
    expect(await caso(400, { error: 'PRIVACY_NOT_ACCEPTED' })).toEqual({
      kind: 'PRIVACY_NOT_ACCEPTED',
    });
    expect(await caso(400, { error: 'INVALID_INPUT', fields: ['recipient.rfc', 7] })).toEqual({
      kind: 'INVALID',
      fields: ['recipient.rfc'],
    });
    expect(await caso(400, { error: 'INVALID_INPUT' })).toEqual({ kind: 'UNAVAILABLE' });
    expect(await caso(409, { error: 'PAYMENT_FORM_UNDEFINED' })).toEqual({
      kind: 'PAYMENT_FORM_UNDEFINED',
    });
    expect(await caso(409, { error: 'NOT_BILLABLE', reason: 'FISCAL_DATA_MISSING' })).toEqual({
      kind: 'NOT_BILLABLE',
    });
    expect(await caso(409, { error: 'NOT_ELIGIBLE', reason: 'EXPIRED' })).toEqual({
      kind: 'INELIGIBLE',
      reason: 'EXPIRED',
    });
    expect(await caso(409, {})).toEqual({ kind: 'UNAVAILABLE' });
    expect(await caso(503, { error: 'BILLING_NOT_CONFIGURED' })).toEqual({ kind: 'UNAVAILABLE' });
    expect(await caso(200, {})).toEqual({ kind: 'UNAVAILABLE' });
  });

  it('sin red lo dice aparte, y una respuesta que no es JSON no se toma por acierto', async () => {
    const sinRed = functionPortalSolicitud({
      url: 'https://x.invalid',
      anonKey: 'anon',
      fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    expect(await sinRed(entrada)).toEqual({ kind: 'NO_NETWORK' });
    const noJson = functionPortalSolicitud({
      url: 'https://x.invalid',
      anonKey: 'anon',
      fetchImpl: () => Promise.resolve(new Response('<html>', { status: 200 })),
    });
    expect(await noJson(entrada)).toEqual({ kind: 'UNAVAILABLE' });
  });
});

describe('cliente de descargar-factura', () => {
  it('un 200 con archivo lo entrega tal cual', async () => {
    const archivo = {
      filename: 'F-2026-0001.xml',
      contentType: 'application/xml',
      encoding: 'utf8',
      content: '<xml/>',
    };
    expect(await con(200, archivo).descargar(entrada, 'xml')).toEqual({
      kind: 'FILE',
      file: archivo,
    });
  });

  it('un 200 incompleto, un 404, un 429, la falta de red y los demás códigos tienen su resultado', async () => {
    expect(await con(200, { filename: 'a' }).descargar(entrada, 'pdf')).toEqual({
      kind: 'UNAVAILABLE',
    });
    expect(
      await con(200, { filename: 'a', contentType: 'b', content: 'c', encoding: 'raro' }).descargar(
        entrada,
        'pdf',
      ),
    ).toEqual({ kind: 'UNAVAILABLE' });
    expect(await con(404, {}).descargar(entrada, 'pdf')).toEqual({ kind: 'NOT_AVAILABLE' });
    expect(await con(429, { retryAfterSeconds: 60 }).descargar(entrada, 'pdf')).toEqual({
      kind: 'BLOCKED',
      retryAfterSeconds: 60,
    });
    expect(await con(500, {}).descargar(entrada, 'pdf')).toEqual({ kind: 'UNAVAILABLE' });
    const sinRed = functionPortalDescarga({
      url: 'https://x.invalid',
      anonKey: 'anon',
      fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')),
    });
    expect(await sinRed(entrada, 'pdf')).toEqual({ kind: 'NO_NETWORK' });
  });

  it('manda el formato pedido', async () => {
    let cuerpo = '';
    const descargar = functionPortalDescarga({
      url: 'https://x.invalid',
      anonKey: 'anon',
      fetchImpl: (_url, init) => {
        cuerpo = typeof init?.body === 'string' ? init.body : '';
        return Promise.resolve(new Response('{}', { status: 404 }));
      },
    });
    await descargar(entrada, 'pdf');
    expect(JSON.parse(cuerpo)).toMatchObject({ format: 'pdf', folio: 'V-2026-0001' });
  });
});
