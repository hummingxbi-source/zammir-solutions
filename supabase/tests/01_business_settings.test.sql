-- Pruebas de la configuración del negocio [S0-13]: valores por defecto y permisos por rol.
begin;
select plan(17);

-- ---------- Estructura y valores por defecto ----------
select has_table('public', 'business_settings', 'existe la tabla de ajustes');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.business_settings'::regclass),
  'la tabla de ajustes tiene RLS encendida'
);

select is((select value from public.business_settings where key = 'tax_rate_bps'), '1600'::jsonb, 'IVA 16 %');
select is((select value from public.business_settings where key = 'deposit_percent_bps'), '5000'::jsonb, 'anticipo 50 %');
select is((select value from public.business_settings where key = 'quote_validity_days'), '15'::jsonb, 'vigencia de 15 días');
select is((select value from public.business_settings where key = 'idle_lock_minutes'), '5'::jsonb, 'bloqueo a los 5 minutos');
select is((select value from public.business_settings where key = 'receivable_aging_threshold_days'), '10'::jsonb, 'umbral de 10 días');
select is((select value from public.business_settings where key = 'deposit_tax_treatment'), '"a"'::jsonb, 'anticipos: opción a');
select is(
  (select array_agg(value order by key) from public.business_settings where key in ('feature_p1', 'feature_p2')),
  array['false'::jsonb, 'false'::jsonb],
  'P1 y P2 apagados por defecto'
);

select is(
  (select count(*)::int from public.business_settings where value = 'null'::jsonb and description !~ 'PD-|Fase 3'),
  0,
  'todo valor por definir cita su pendiente'
);

-- ---------- Permisos por rol ----------
-- Un administrador: app_metadata.rol = ADMIN
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;

select is((select count(*)::int from public.business_settings where key = 'tax_rate_bps'), 1, 'el administrador lee los ajustes');
update public.business_settings set value = '1700' where key = 'tax_rate_bps';
select is((select value from public.business_settings where key = 'tax_rate_bps'), '1700'::jsonb, 'el administrador cambia un valor');
select throws_ok(
  $$ insert into public.business_settings (key, value, description) values ('otro', '1', 'x') $$,
  '42501', null, 'el administrador no puede crear ajustes por la API'
);
select throws_ok(
  $$ update public.business_settings set description = 'otra cosa' where key = 'tax_rate_bps' $$,
  '42501', null, 'el administrador solo cambia el valor, no la descripción'
);

-- Un dispositivo: lee, pero no cambia
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;

select is((select count(*)::int from public.business_settings where key = 'feature_p1'), 1, 'el dispositivo lee los ajustes');
update public.business_settings set value = '9999' where key = 'idle_lock_minutes';
reset role;
select is((select value from public.business_settings where key = 'idle_lock_minutes'), '5'::jsonb, 'el dispositivo no cambia ajustes');

-- Un anónimo no ve nada
set local role anon;
select throws_ok(
  $$ select * from public.business_settings $$,
  '42501', null, 'un anónimo no puede leer los ajustes'
);
reset role;

select * from finish();
rollback;
