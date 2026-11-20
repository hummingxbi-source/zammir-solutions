import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { supabaseAdminAuth } from '../../identity/infra/supabase-admin-auth';
import { supabaseUmbralDeAtraso } from './supabase-umbral-de-atraso';

// Pruebas contra Supabase local real. Corren con `pnpm test:integracion`.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const sufijo = Math.random().toString(36).slice(2, 10);
const admin = {
  email: `umbral-admin-${sufijo}@ejemplo.invalid`,
  password: `Clave-${sufijo}-Admin1`,
};
const cajero = {
  email: `umbral-cajero-${sufijo}@ejemplo.invalid`,
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
    .eq('key', 'receivable_aging_threshold_days')
    .single();
  original = (data as { value: unknown }).value;
});

afterAll(async () => {
  await servicio
    .from('business_settings')
    .update({ value: original })
    .eq('key', 'receivable_aging_threshold_days');
  for (const id of cuentas) {
    await servicio.auth.admin.deleteUser(id);
  }
});

describe('umbral de antigüedad con Supabase', () => {
  it('un administrador lo guarda y lo vuelve a leer', async () => {
    const tienda = supabaseUmbralDeAtraso(await como(admin));
    const w = await tienda.write(21);
    expect(w.ok).toBe(true);
    const r = await tienda.read();
    expect(r.ok && r.value).toBe(21);
  });

  it('un cajero no lo cambia y queda como estaba', async () => {
    const antes = await supabaseUmbralDeAtraso(await como(admin)).read();
    const w = await supabaseUmbralDeAtraso(await como(cajero)).write(99);
    expect(!w.ok && w.error.code).toBe('NOT_AUTHORIZED');
    const despues = await supabaseUmbralDeAtraso(await como(admin)).read();
    expect(despues).toEqual(antes);
  });
});
