import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

// Pruebas contra Supabase local real y las funciones `registrar-error` y `salud` [S4-28, RNF-34]: lo que llega del
// navegador se guarda sin datos personales y la comprobación de salud responde. Corren con `pnpm test:integracion`.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const servicio = createClient(URL, SERVICIO, {
  auth: { persistSession: false, autoRefreshToken: false },
});
// Solo letras: el limpiador cambia por una marca cualquier serie larga de dígitos, y el nombre se busca tal cual.
const marca = Array.from({ length: 10 }, () =>
  String.fromCharCode(97 + Math.floor(Math.random() * 26)),
).join('');

function enviar(cuerpo: unknown): Promise<Response> {
  return fetch(`${URL}/functions/v1/registrar-error`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: ANON, authorization: `Bearer ${ANON}` },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
}

async function guardados(nombre: string) {
  const r = await servicio.from('error_log').select('*').eq('name', nombre);
  return (r.data ?? []) as Record<string, unknown>[];
}

describe('registro de errores (integración)', () => {
  it('guarda el error del navegador sin correo, teléfono, RFC ni consulta de la dirección', async () => {
    const nombre = `Falla${marca}a`;
    const r = await enviar({
      source: 'CLIENT',
      name: nombre,
      message:
        'Falló para ana.lopez@ejemplo.invalid con RFC XAXX010101000 y teléfono 595 123 4567 en /factura?codigo=ABCD',
      stack: 'Error\n at f (https://x.invalid/assets/a.js?token=secreto123456:10:5)',
      route: '/clientes/5c000000-0000-4000-8000-000000000001?q=ana',
      appVersion: '1.0.0',
    });
    expect(r.status).toBe(204);
    const filas = await guardados(nombre);
    expect(filas).toHaveLength(1);
    const todo = JSON.stringify(filas[0]);
    for (const dato of [
      'ana.lopez',
      'XAXX010101000',
      '595 123',
      'ABCD',
      'secreto123456',
      'q=ana',
    ]) {
      expect(todo).not.toContain(dato);
    }
    expect(filas[0]).toMatchObject({
      source: 'CLIENT',
      route: '/clientes/:id',
      app_version: '1.0.0',
    });
  });

  it('un cuerpo mal formado, uno sin forma o uno enorme se ignoran sin error', async () => {
    const antes = (await servicio.from('error_log').select('id', { count: 'exact', head: true }))
      .count;
    expect((await enviar('esto no es json')).status).toBe(204);
    expect((await enviar({ source: 'OTRO', name: 'x', message: 'y' })).status).toBe(204);
    expect(
      (await enviar({ source: 'CLIENT', name: `Grande${marca}`, message: 'x'.repeat(20_000) }))
        .status,
    ).toBe(204);
    const despues = (await servicio.from('error_log').select('id', { count: 'exact', head: true }))
      .count;
    expect(despues).toBe(antes);
  });

  it('solo acepta POST', async () => {
    const r = await fetch(`${URL}/functions/v1/registrar-error`, {
      headers: { apikey: ANON, authorization: `Bearer ${ANON}` },
    });
    expect(r.status).toBe(405);
  });

  it('un anónimo no puede leer el registro', async () => {
    const anonimo = createClient(URL, ANON, { auth: { persistSession: false } });
    const r = await anonimo.from('error_log').select('*');
    expect(r.error).not.toBeNull();
  });

  it('la comprobación de salud responde ok sin llaves ni datos', async () => {
    const r = await fetch(`${URL}/functions/v1/salud`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });
});
