-- Pruebas de dispositivos y códigos de registro [S0-16a].
begin;
select plan(35);

select has_table('public', 'devices', 'existe la tabla de dispositivos');
select has_table('public', 'device_registration_codes', 'existe la tabla de códigos');
select ok((select relrowsecurity from pg_class where oid = 'public.devices'::regclass), 'dispositivos tiene RLS');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.device_registration_codes'::regclass),
  'códigos tiene RLS'
);

-- Lugar donde la prueba guarda lo que generan las funciones, para usarlo con otro rol.
create temp table guardado (clave text primary key, valor text);
grant all on guardado to public;

-- ---------- Un administrador genera un código ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;

insert into guardado select 'codigo1', code from public.create_device_registration_code(15);
select matches((select valor from guardado where clave = 'codigo1'), '^[A-HJ-NP-Z2-9]{8}$',
  'el código tiene 8 letras y números sin ambigüedades');
select throws_ok($$ select * from public.create_device_registration_code(0) $$, '22023', null,
  'no se acepta una vigencia de cero minutos');
select throws_ok($$ insert into public.devices (name, temp_series, auth_user_id)
  values ('X', 9, '00000000-0000-0000-0000-0000000000f9') $$, '42501', null,
  'el administrador no crea dispositivos directo en la tabla');
select throws_ok($$ select * from public.device_registration_codes $$, '42501', null,
  'ni siquiera el administrador lee la tabla de códigos');

-- ---------- Cajero, dispositivo y anónimo no generan códigos ----------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
select throws_ok($$ select * from public.create_device_registration_code(15) $$, '42501', null,
  'un cajero no genera códigos');
select throws_ok($$ select * from public.revoke_device('00000000-0000-0000-0000-0000000000e1') $$,
  '42501', null, 'un cajero no revoca');
select throws_ok($$ select * from public.list_devices() $$, '42501', null, 'un cajero no lista');
select throws_ok(
  $$ select * from public.redeem_device_registration_code('AAAAAAAA', 'Tablet', '00000000-0000-0000-0000-0000000000f1') $$,
  '42501', null, 'un usuario con sesión no canjea: es del servidor');

reset role;
set local role anon;
select throws_ok($$ select * from public.create_device_registration_code(15) $$, '42501', null,
  'un anónimo no genera códigos');
reset role;

-- ---------- El código no se guarda en claro ----------
select is(
  (select count(*)::int from public.device_registration_codes
   where code_hash = (select valor from guardado where clave = 'codigo1')),
  0, 'la base no guarda el código en claro'
);

-- ---------- El servidor canjea el código ----------
set local role service_role;
insert into guardado
select 'tablet1', id::text from public.redeem_device_registration_code(
  (select valor from guardado where clave = 'codigo1'), '  Tablet del mostrador ',
  '00000000-0000-0000-0000-0000000000d1');
reset role;

select is((select name from public.devices where id = (select valor::uuid from guardado where clave = 'tablet1')),
  'Tablet del mostrador', 'el canje crea el dispositivo con el nombre limpio');
select is((select status from public.devices where auth_user_id = '00000000-0000-0000-0000-0000000000d1'),
  'ACTIVE', 'queda activo');
select is((select temp_series from public.devices where auth_user_id = '00000000-0000-0000-0000-0000000000d1'),
  1, 'la primera tablet recibe la serie 1');
select is(
  (select array_agg(action) from public.audit_log where entity_id = (select valor from guardado where clave = 'tablet1')),
  array['DEVICE_REGISTERED'], 'el alta deja su entrada de bitácora'
);

set local role service_role;
select throws_ok(
  $$ select * from public.redeem_device_registration_code(
       (select valor from guardado where clave = 'codigo1'), 'Otra', '00000000-0000-0000-0000-0000000000d2') $$,
  'P0001', 'CODE_INVALID', 'un código usado ya no sirve'
);
select throws_ok(
  $$ select * from public.redeem_device_registration_code('NOEXISTE', 'Otra', '00000000-0000-0000-0000-0000000000d2') $$,
  'P0001', 'CODE_INVALID', 'un código que no existe se rechaza'
);
reset role;

-- Un código vencido
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;
insert into guardado select 'codigo2', code from public.create_device_registration_code(15);
reset role;
update public.device_registration_codes set expires_at = now() - interval '1 minute' where used_at is null;
set local role service_role;
select throws_ok(
  $$ select * from public.redeem_device_registration_code(
       (select valor from guardado where clave = 'codigo2'), 'Vencida', '00000000-0000-0000-0000-0000000000d2') $$,
  'P0001', 'CODE_INVALID', 'un código vencido se rechaza'
);
reset role;
select is((select count(*)::int from public.devices where name = 'Vencida'), 0, 'el canje rechazado no crea dispositivo');

-- Una segunda tablet recibe la serie siguiente
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;
insert into guardado select 'codigo3', code from public.create_device_registration_code(15);
reset role;
set local role service_role;
insert into guardado
select 'tablet2', id::text from public.redeem_device_registration_code(
  (select valor from guardado where clave = 'codigo3'), 'Tablet de la bodega',
  '00000000-0000-0000-0000-0000000000d2');
reset role;
select is((select temp_series from public.devices where auth_user_id = '00000000-0000-0000-0000-0000000000d2'),
  2, 'la segunda tablet recibe la serie 2');

-- ---------- Quién ve qué ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;
select is((select count(*)::int from public.list_devices()), 2, 'el administrador lista todos los dispositivos');
select is((select count(*)::int from public.devices), 0, 'el administrador no lee la tabla directo: usa la lista');
reset role;
select is((select count(*)::int from public.audit_log where action = 'DEVICES_LISTED'), 1, 'listar deja su entrada de bitácora');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
select is((select count(*)::int from public.devices), 1, 'el dispositivo ve solo su renglón');
select ok((select count(*) from public.business_settings) > 0, 'el dispositivo activo lee los ajustes');
reset role;

-- ---------- Revocar ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;
select is((select status from public.revoke_device((select valor::uuid from guardado where clave = 'tablet1'))),
  'REVOKED', 'el administrador revoca');
select lives_ok($$ select * from public.revoke_device((select valor::uuid from guardado where clave = 'tablet1')) $$,
  'revocar otra vez no falla');
select throws_ok($$ select * from public.revoke_device('00000000-0000-0000-0000-0000000000e1') $$,
  'P0002', 'DEVICE_NOT_FOUND', 'revocar uno que no existe se rechaza');
reset role;
select is(
  (select array_agg(action order by occurred_at, action) from public.audit_log
   where entity_id = (select valor from guardado where clave = 'tablet1')),
  array['DEVICE_REGISTERED', 'DEVICE_REVOKED'], 'la baja deja una sola entrada, aunque se revoque dos veces'
);

-- ---------- Un dispositivo revocado ya no opera, pero se entera ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
select is((select count(*)::int from public.business_settings), 0, 'el revocado ya no lee los ajustes');
select throws_ok(
  $$ insert into public.audit_log (id, occurred_at, action, entity_type, entity_id)
     values ('55555555-5555-5555-5555-555555555555', now(), 'X', 'device', 'd-5') $$,
  '42501', null, 'el revocado ya no agrega a la bitácora'
);
select is((select status from public.devices), 'REVOKED', 'el revocado sí ve que está revocado');
reset role;

select * from finish();
rollback;
