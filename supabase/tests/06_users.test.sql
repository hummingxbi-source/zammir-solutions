-- Pruebas de usuarios con PIN [S1-14]: verificador, permisos y bitácora.
begin;
select plan(25);

select has_table('public', 'app_users', 'existe la tabla de usuarios');
select has_view('public', 'login_users', 'existe la vista para entrar con PIN');
select ok((select relrowsecurity from pg_class where oid = 'public.app_users'::regclass), 'usuarios tiene RLS');
select is(
  (select value from public.business_settings where key = 'admin_pin_min_digits'),
  '6'::jsonb, 'el mínimo de dígitos del administrador sale de la configuración'
);

insert into public.devices (name, temp_series, auth_user_id)
values ('Tablet de prueba', 1, '00000000-0000-0000-0000-0000000000d1');

-- ---------- Un administrador da de alta y lee ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.app_users (id, name, role, pin_salt, pin_iterations, pin_hash)
     values ('30000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', 'c2FsLWFuYQ==', 600000, 'aGFzaC1hbmE=') $$,
  'el administrador da de alta un usuario'
);
select lives_ok(
  $$ insert into public.app_users (id, name, role, pin_salt, pin_iterations, pin_hash)
     values ('30000000-0000-0000-0000-000000000002', 'Luis', 'ADMIN', 'c2FsLQ==', 600000, 'aGFzaC1sdWlz') $$,
  'y un administrador del mostrador'
);
select is((select count(*)::int from public.app_users), 2, 'el administrador lee los usuarios');

select throws_ok(
  $$ insert into public.app_users (name, role, pin_salt, pin_iterations, pin_hash)
     values (' ana ', 'STAFF', 'c', 1, 'h') $$,
  '23505', null, 'no se repite el nombre, sin importar mayúsculas ni espacios'
);
select throws_ok(
  $$ insert into public.app_users (name, role, pin_salt, pin_iterations, pin_hash)
     values ('Otro', 'DUEÑO', 'c', 1, 'h') $$,
  '23514', null, 'el rol debe ser ADMIN o STAFF'
);
select throws_ok(
  $$ insert into public.app_users (name, role, pin_salt, pin_iterations, pin_hash)
     values ('Sin PIN', 'STAFF', '', 1, 'h') $$,
  '23514', null, 'el verificador no puede venir vacío'
);

select throws_ok(
  $$ delete from public.app_users where id = '30000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'los usuarios no se borran'
);
select throws_ok(
  $$ update public.app_users set id = '30000000-0000-0000-0000-000000000009' where name = 'Ana' $$,
  '42501', null, 'el identificador no se cambia'
);

-- Cambios que deben dejar bitácora
update public.app_users set name = 'Ana María', role = 'STAFF' where id = '30000000-0000-0000-0000-000000000001';
update public.app_users set is_active = false where id = '30000000-0000-0000-0000-000000000001';
update public.app_users set pin_hash = 'bnVldm8taGFzaA==', pin_salt = 'bnVldmE=' where id = '30000000-0000-0000-0000-000000000001';
update public.app_users set is_active = true where id = '30000000-0000-0000-0000-000000000001';
reset role;

select is(
  (select array_agg(action order by occurred_at, action) from public.audit_log
   where entity_id = '30000000-0000-0000-0000-000000000001'),
  array['USER_ACTIVATED', 'USER_CREATED', 'USER_DEACTIVATED', 'USER_PIN_RESET', 'USER_UPDATED'],
  'alta, cambio de nombre, baja, restablecimiento de PIN y reactivación dejan bitácora'
);
select is(
  (select count(*)::int from public.audit_log
   where entity_id = '30000000-0000-0000-0000-000000000001'
     and (old_value::text like '%hash%' or new_value::text like '%hash%' or new_value::text like '%bnVldm8%')),
  0, 'la bitácora nunca guarda el verificador del PIN'
);

-- ---------- Un dispositivo ve solo la vista, con lo necesario para pedir el PIN ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
select is((select count(*)::int from public.app_users), 0, 'el dispositivo no lee la tabla de usuarios');
select is((select count(*)::int from public.login_users), 2, 'el dispositivo lee la vista para entrar');
select is(
  (select pin_iterations from public.login_users where name = 'Luis'),
  600000, 'la vista trae el verificador (riesgo aceptado en ADR-0013)'
);
select throws_ok(
  $$ insert into public.app_users (name, role, pin_salt, pin_iterations, pin_hash) values ('Intruso', 'ADMIN', 'c', 1, 'h') $$,
  '42501', null, 'el dispositivo no da de alta usuarios'
);
update public.app_users set role = 'ADMIN' where name = 'Ana María';
reset role;
select is((select role from public.app_users where name = 'Ana María'), 'STAFF', 'el dispositivo no cambia roles');

-- ---------- Un cajero sin dispositivo no ve nada ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
select is((select count(*)::int from public.login_users), 0, 'un cajero sin dispositivo no ve usuarios');
select is((select count(*)::int from public.app_users), 0, 'ni la tabla');
update public.app_users set is_active = false where name = 'Luis';
reset role;
select is((select is_active from public.app_users where name = 'Luis'), true, 'un cajero no desactiva a nadie');

-- ---------- Una tablet revocada deja de ver la vista ----------
update public.devices set status = 'REVOKED', revoked_at = now() where auth_user_id = '00000000-0000-0000-0000-0000000000d1';
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
select is((select count(*)::int from public.login_users), 0, 'una tablet revocada ya no ve la vista de usuarios');
reset role;

-- ---------- Un anónimo no ve nada ----------
set local role anon;
select throws_ok($$ select * from public.login_users $$, '42501', null, 'un anónimo no ve la vista');
select throws_ok($$ select * from public.app_users $$, '42501', null, 'ni la tabla');
reset role;

select * from finish();
rollback;
