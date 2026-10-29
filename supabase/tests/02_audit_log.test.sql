-- Pruebas de la bitácora [S0-15]: se agrega, se lee solo por administradores y nunca se modifica.
begin;
select plan(15);

select has_table('public', 'audit_log', 'existe la bitácora');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass),
  'la bitácora tiene RLS encendida'
);

-- ---------- Un administrador agrega y lee ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.audit_log (id, occurred_at, user_id, device_id, action, entity_type, entity_id, old_value, new_value)
     values ('11111111-1111-1111-1111-111111111111', '2026-10-29T12:00:00Z',
             '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1',
             'DEVICE_REGISTERED', 'device', 'd-1', null, '{"nombre":"Tablet del mostrador"}') $$,
  'el administrador agrega una entrada'
);
select is(
  (select recorded_by from public.audit_log where id = '11111111-1111-1111-1111-111111111111'),
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'la entrada guarda quién subió el registro'
);
select is(
  (select count(*)::int from public.audit_log where entity_id = 'd-1'),
  1,
  'el administrador lee la bitácora'
);
select throws_ok(
  $$ update public.audit_log set action = 'OTRA' where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'el administrador no puede modificar una entrada'
);
select throws_ok(
  $$ delete from public.audit_log where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null, 'el administrador no puede borrar una entrada'
);
select throws_ok(
  $$ insert into public.audit_log (id, occurred_at, action, entity_type, entity_id)
     values ('22222222-2222-2222-2222-222222222222', now(), '', 'device', 'd-1') $$,
  '23514', null, 'no se acepta una acción vacía'
);

-- ---------- Un dispositivo agrega pero no lee ----------
reset role;
insert into public.devices (name, temp_series, auth_user_id)
values ('Tablet de prueba', 1, '00000000-0000-0000-0000-0000000000d1');
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.audit_log (id, occurred_at, action, entity_type, entity_id)
     values ('33333333-3333-3333-3333-333333333333', now(), 'DEVICE_REVOKED', 'device', 'd-2') $$,
  'el dispositivo agrega una entrada'
);
select is((select count(*)::int from public.audit_log), 0, 'el dispositivo no lee la bitácora');

-- ---------- Una cuenta sin rol no agrega ----------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.audit_log (id, occurred_at, action, entity_type, entity_id)
     values ('44444444-4444-4444-4444-444444444444', now(), 'X', 'device', 'd-3') $$,
  '42501', null, 'un cajero sin sesión de dispositivo no agrega entradas'
);

-- ---------- Un anónimo no hace nada ----------
reset role;
set local role anon;
select throws_ok($$ select * from public.audit_log $$, '42501', null, 'un anónimo no lee la bitácora');
reset role;

-- ---------- Ni siquiera el dueño de la tabla puede modificarla ----------
select throws_ok(
  $$ update public.audit_log set action = 'OTRA' $$,
  'P0001', 'La bitácora no se modifica ni se borra', 'el dueño de la base tampoco puede modificar'
);
select throws_ok(
  $$ delete from public.audit_log $$,
  'P0001', 'La bitácora no se modifica ni se borra', 'el dueño de la base tampoco puede borrar'
);
select throws_ok(
  $$ truncate public.audit_log $$,
  'P0001', 'La bitácora no se modifica ni se borra', 'ni vaciar la bitácora'
);

select * from finish();
rollback;
