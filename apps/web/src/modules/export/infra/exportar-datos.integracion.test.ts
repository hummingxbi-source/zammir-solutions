import { createClient } from '@supabase/supabase-js';
import { exportData, EXPORT_TABLES } from '@zammir/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { supabaseDataExport } from './supabase-data-export';

// Contra Supabase local real [S5-08, RNF-22]: un administrador exporta los datos del negocio sin PIN ni credenciales
// de tablets y queda en la bitácora; un cajero y un visitante no pueden. Corren con `pnpm test:integracion`.
const URL = process.env.ZAMMIR_TEST_SUPABASE_URL ?? '';
const ANON = process.env.ZAMMIR_TEST_SUPABASE_ANON_KEY ?? '';
const SERVICIO = process.env.ZAMMIR_TEST_SUPABASE_SERVICE_KEY ?? '';

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;
const crearCliente = (llave: string) => createClient(URL, llave, opciones);

const sufijo = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
const ID = (n: number): string =>
  `5f${sufijo.slice(0, 6)}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const SAL_SECRETA = `sal-secreta-${sufijo}`;
const HUELLA_SECRETA = `huella-secreta-${sufijo}`;

let servicio: ReturnType<typeof crearCliente>;
let administrador: ReturnType<typeof crearCliente>;
let cajero: ReturnType<typeof crearCliente>;
let idAdmin = '';

async function entrar(rol: 'ADMIN' | 'STAFF') {
  const correo = `exp-${rol.toLowerCase()}-${sufijo}@ejemplo.invalid`;
  const clave = `Clave-${sufijo}-${rol}6`;
  const creada = await servicio.auth.admin.createUser({
    email: correo,
    password: clave,
    email_confirm: true,
    app_metadata: { rol },
  });
  expect(creada.error, `cuenta ${rol}`).toBeNull();
  const cliente = crearCliente(ANON);
  const sesion = await cliente.auth.signInWithPassword({ email: correo, password: clave });
  expect(sesion.error, `sesión ${rol}`).toBeNull();
  return { cliente, id: creada.data.user?.id ?? '' };
}

beforeAll(async () => {
  expect(URL, 'faltan las variables: usa `pnpm test:integracion`').not.toBe('');
  servicio = crearCliente(SERVICIO);
  const admin = await entrar('ADMIN');
  administrador = admin.cliente;
  idAdmin = admin.id;
  cajero = (await entrar('STAFF')).cliente;

  const persona = await administrador.from('app_users').insert({
    id: ID(1),
    name: `Persona de la exportación ${sufijo}`,
    role: 'STAFF',
    is_active: true,
    pin_salt: SAL_SECRETA,
    pin_iterations: 1000,
    pin_hash: HUELLA_SECRETA,
    pin_version: 1,
  });
  expect(persona.error, 'persona').toBeNull();
  const cliente = await servicio
    .from('customers')
    .insert({ id: ID(2), name: `Cliente de la exportación ${sufijo}`, phone: '5512345678' });
  expect(cliente.error, 'cliente').toBeNull();
});

describe('exportación de los datos del negocio (Supabase real)', () => {
  it('un administrador recibe los datos, y el paquete trae un CSV por tabla, el JSON y el PDF en datos', async () => {
    const r = await exportData(supabaseDataExport(administrador));
    expect(r.kind).toBe('READY');
    if (r.kind !== 'READY') {
      return;
    }
    expect(r.package.counts.customers).toBeGreaterThanOrEqual(1);
    for (const tabla of EXPORT_TABLES) {
      expect(r.package.counts[tabla.name], tabla.name).toBeGreaterThanOrEqual(0);
    }
    expect(r.package.csvFiles.length).toBeGreaterThanOrEqual(EXPORT_TABLES.length);
    expect(r.package.json.content).toContain(`Cliente de la exportación ${sufijo}`);
    expect(r.package.report.sections.map((s) => s.title)).toContain('Clientes');
  });

  it('nada del paquete (ni el JSON, ni los CSV, ni el PDF) trae las huellas de los PIN', async () => {
    const r = await exportData(supabaseDataExport(administrador));
    if (r.kind !== 'READY') {
      throw new Error('no se pudo exportar');
    }
    const todo = [
      r.package.json.content,
      r.package.readme.content,
      ...r.package.csvFiles.map((f) => f.content),
      JSON.stringify(r.package.report),
    ].join('\n');
    expect(todo).not.toContain(SAL_SECRETA);
    expect(todo).not.toContain(HUELLA_SECRETA);
    expect(todo).not.toContain('pin_hash');
    expect(todo).not.toContain('auth_user_id');
    expect(todo).not.toContain('pdf_base64');
    // Sí trae a la persona, por su nombre y rol.
    const personas = r.package.csvFiles.find((f) => f.path === 'csv/app_users.csv')?.content ?? '';
    expect(personas).toContain(`Persona de la exportación ${sufijo}`);
  });

  it('cada exportación queda en la bitácora con quién la hizo', async () => {
    const antes = await servicio
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'DATA_EXPORTED')
      .eq('user_id', idAdmin);
    await exportData(supabaseDataExport(administrador));
    const despues = await servicio
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'DATA_EXPORTED')
      .eq('user_id', idAdmin);
    expect((despues.count ?? 0) - (antes.count ?? 0)).toBe(1);
  });

  it('un cajero con sesión no puede exportar y no deja nada en la bitácora', async () => {
    const antes = await servicio
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'DATA_EXPORTED');
    const r = await exportData(supabaseDataExport(cajero));
    expect(r).toEqual({ kind: 'NOT_AUTHORIZED' });
    const despues = await servicio
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'DATA_EXPORTED');
    expect(despues.count).toBe(antes.count);
  });

  it('un visitante sin sesión no puede llamar a la función', async () => {
    const visitante = crearCliente(ANON);
    const r = await visitante.rpc('admin_export_data');
    expect(r.error).not.toBeNull();
    expect(r.data).toBeNull();
  });
});
