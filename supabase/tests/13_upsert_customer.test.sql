-- Clientes como operación [S2-10]: alta y corrección desde la tablet, número de cambio y bitácora.
begin;
select plan(12);

select has_function('private', 'apply_upsert_customer', array['uuid', 'devices', 'uuid', 'jsonb'],
  'existe la función que aplica UpsertCustomer');
select has_column('public', 'customers', 'change_seq', 'cada cliente lleva su número de cambio');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1);

create function pg_temp.alta(p_op uuid, p_seq int, p_name text, p_phone text default '5512345678')
returns jsonb language sql as $$
  select jsonb_build_object(
    'opId', p_op, 'deviceId', 'd0000000-0000-0000-0000-000000000001', 'seq', p_seq,
    'type', 'UpsertCustomer', 'schemaVersion', 1,
    'userId', 'a0000000-0000-0000-0000-000000000001', 'clientCreatedAt', '2090-06-15T18:00:00Z',
    'payload', jsonb_build_object('id', 'c0000000-0000-0000-0000-000000000001', 'name', p_name,
                                  'phone', p_phone, 'email', null, 'notes', null, 'privacyNoticeVersion', 1)
  );
$$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;

create temp table r1 as
  select public.receive_operation(pg_temp.alta('10000000-0000-0000-0000-000000000001', 1, 'Obra de la tablet')) as r;
create temp table r2 as
  select public.receive_operation(pg_temp.alta('10000000-0000-0000-0000-000000000002', 2, 'Obra corregida')) as r;
create temp table r3 as
  select public.receive_operation(pg_temp.alta('10000000-0000-0000-0000-000000000003', 3, 'Teléfono malo', '55-12')) as r;
reset role;

select is((select r->>'status' from r1), 'APPLIED', 'el alta desde la tablet se aplica');
select is((select name from public.customers where id = 'c0000000-0000-0000-0000-000000000001'),
  'Obra corregida', 'la corrección posterior deja el último valor');
select is((select count(*)::int from public.customers where id = 'c0000000-0000-0000-0000-000000000001'),
  1, 'corregir no duplica al cliente');
select is((select r->>'code' from r3), 'INVALID_PAYLOAD', 'un teléfono que no son 10 dígitos se rechaza');
select is((select last_seq from public.devices where id = 'd0000000-0000-0000-0000-000000000001'), 2::bigint,
  'lo rechazado no avanza el orden del dispositivo');

select is(
  (select old_value->>'nombre' from public.audit_log
    where entity_id = 'c0000000-0000-0000-0000-000000000001' and action = 'CUSTOMER_UPSERTED'
      and old_value is not null),
  'Obra de la tablet', 'la bitácora guarda el valor anterior');
select is((select count(*)::int from public.audit_log
            where entity_id = 'c0000000-0000-0000-0000-000000000001' and action = 'CUSTOMER_UPSERTED'),
  2, 'una entrada por el alta y otra por la corrección');

-- Un cliente anonimizado ya no se corrige: la operación queda por revisar y el cliente no cambia.
update public.customers set name = 'Cliente anonimizado', anonymized_at = now()
 where id = 'c0000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
create temp table r4 as
  select public.receive_operation(pg_temp.alta('10000000-0000-0000-0000-000000000004', 3, 'Intento de corregir')) as r;
select is((select r->>'reason' from r4), 'CUSTOMER_ANONYMIZED', 'corregir a uno anonimizado queda por revisar');
select is((select name from public.customers_for_device where id = 'c0000000-0000-0000-0000-000000000001'),
  'Cliente anonimizado', 'y el cliente no cambia');
select ok((select change_seq from public.customers_for_device
            where id = 'c0000000-0000-0000-0000-000000000001') > 0, 'la tablet ve el número de cambio');
reset role;

select * from finish();
rollback;
