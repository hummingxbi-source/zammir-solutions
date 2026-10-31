import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { supabaseAdminAuth } from '../../identity/infra/supabase-admin-auth';
import { supabaseQuoteConditions } from './supabase-quote-conditions';

// Pruebas contra Supabase local real. Corren con `pnpm test:integracion`.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const sufijo = Math.random().toString(36).slice(2, 10);
const admin = { email: `cond-admin-${sufijo}@ejemplo.invalid`, password: `Clave-${sufijo}-Admin1` };
const cajero = {
  email: `cond-cajero-${sufijo}@ejemplo.invalid`,
  password: `Clave-${sufijo}-Cajero1`,
};

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const crear = (llave: string) => createClient(URL, llave, opciones);

const cuentas: string[] = [];
let servicio: ReturnType<typeof crear>;
let original: unknown;

async function cuenta(rol: string, c: { email: string; password: string }): Promise<void> {
  const { data, error } = await servicio.auth.admin.createUser({
    email: c.email,
    password: c.password,
    email_confirm: true,
    app_metadata: { rol },
  });
  expect(error).toBeNull();
  cuentas.push(data.user?.id ?? '');
}

async function como(c: { email: string; password: string }) {
  const cliente = crear(ANON);
  await supabaseAdminAuth(cliente).signIn(c.email, c.password);
  return cliente;
}

beforeAll(async () => {
  expect(URL, 'faltan las variables: usa `pnpm test:integracion`').not.toBe('');
  servicio = crear(SERVICIO);
  await cuenta('ADMIN', admin);
  await cuenta('STAFF', cajero);
  const { data } = await servicio
    .from('business_settings')
    .select('value')
    .eq('key', 'quote_conditions')
    .single();
  original = (data as { value: unknown }).value;
});

afterAll(async () => {
  await servicio.from('business_settings').update({ value: original }).eq('key', 'quote_conditions');
  for (const id of cuentas) {
    await servicio.auth.admin.deleteUser(id);
  }
});

describe('condiciones de la cotización con Supabase', () => {
  it('un administrador las guarda y las vuelve a leer', async () => {
    const tienda = supabaseQuoteConditions(await como(admin));
    const w = await tienda.write(`Condición A ${sufijo}\nCondición B`);
    expect(w.ok).toBe(true);
    const r = await tienda.read();
    expect(r.ok && r.value).toBe(`Condición A ${sufijo}\nCondición B`);
  });

  it('un cajero no las cambia y quedan como estaban', async () => {
    const antes = await supabaseQuoteConditions(await como(admin)).read();
    const w = await supabaseQuoteConditions(await como(cajero)).write('Cambio no permitido');
    expect(!w.ok && w.error.code).toBe('NOT_AUTHORIZED');
    const despues = await supabaseQuoteConditions(await como(admin)).read();
    expect(despues).toEqual(antes);
  });
});
