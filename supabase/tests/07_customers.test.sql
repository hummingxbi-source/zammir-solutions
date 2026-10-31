-- Pruebas de clientes [S1-10]: validaciones, teléfono no único y quién ve qué.
begin;
select plan(23);

select has_table('public', 'customers', 'existe la tabla de clientes');
select has_view('public', 'customers_for_device', 'existe la vista sin datos fiscales');
select ok((select relrowsecurity from pg_class where oid = 'public.customers'::regclass), 'clientes tiene RLS');

insert into public.devices (name, temp_series, auth_user_id)
values ('Tablet de prueba', 1, '00000000-0000-0000-0000-0000000000d1');

-- ---------- Un administrador da de alta con datos fiscales ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.customers (id, name, phone, email, fiscal_rfc, fiscal_zip, privacy_notice_version)
     values ('40000000-0000-0000-0000-000000000001', 'Ana López', '5512345678', 'ana@ejemplo.invalid',
             'XAXX010101000', '55600', 1) $$,
  'el administrador da de alta un cliente con datos fiscales'
);
select lives_ok(
  $$ insert into public.customers (id, name, phone)
     values ('40000000-0000-0000-0000-000000000002', 'Ana (esposo)', '5512345678') $$,
  'el teléfono no es único: otro cliente puede compartirlo'
);
select is((select count(*)::int from public.customers where phone = '5512345678'), 2, 'se encuentran los dos');
select is((select count(*)::int from public.customers), 2, 'el administrador lee la tabla completa');

select throws_ok($$ insert into public.customers (name, phone) values ('Sin teléfono', '123') $$,
  '23514', null, 'el teléfono debe tener 10 dígitos');
select throws_ok($$ insert into public.customers (name, phone) values (' ', '5512345678') $$,
  '23514', null, 'el nombre no puede estar en blanco');
select throws_ok($$ insert into public.customers (name, phone, fiscal_rfc) values ('RFC malo', '5512345678', 'ABC') $$,
  '23514', null, 'el RFC debe tener formato de 12 o 13 caracteres');
select throws_ok($$ insert into public.customers (name, phone, fiscal_zip) values ('CP malo', '5512345678', '556') $$,
  '23514', null, 'el código postal fiscal debe tener 5 dígitos');

update public.customers set name = 'Ana María López', fiscal_rfc = null where id = '40000000-0000-0000-0000-000000000001';
select is((select name from public.customers where id = '40000000-0000-0000-0000-000000000001'),
  'Ana María López', 'el administrador corrige datos');
select throws_ok(
  $$ update public.customers set anonymized_at = now() where id = '40000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'la anonimización no se marca a mano: tiene su propia función'
);
select throws_ok(
  $$ delete from public.customers where id = '40000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'los clientes no se borran'
);
insert into public.customers (id, name, phone)
values ('40000000-0000-0000-0000-000000000003', 'Cliente de la tablet', '5598765432');
reset role;

-- ---------- Un dispositivo lee la vista (sin datos fiscales) y no escribe en la tabla ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;

-- Desde el Sprint 2 la tablet no escribe en la tabla: manda una operación (ver 13_upsert_customer).
select throws_ok(
  $$ insert into public.customers (id, name, phone) values ('40000000-0000-0000-0000-000000000003', 'Cliente de la tablet', '5598765432') $$,
  '42501', null, 'la tablet ya no da de alta clientes directo: lo hace con una operación'
);
select throws_ok(
  $$ insert into public.customers (name, phone, fiscal_rfc) values ('Con RFC', '5511112222', 'XAXX010101000') $$,
  '42501', null, 'la tablet no guarda datos fiscales'
);
select is((select count(*)::int from public.customers), 0, 'la tablet no lee la tabla completa');
select is((select count(*)::int from public.customers_for_device), 3, 'la tablet lee la vista de clientes');
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'customers_for_device' and column_name like 'fiscal%'),
  0, 'la vista no trae columnas fiscales'
);
update public.customers set name = 'Cambiado por la tablet' where id = '40000000-0000-0000-0000-000000000003';
reset role;
select is((select name from public.customers where id = '40000000-0000-0000-0000-000000000003'),
  'Cliente de la tablet', 'la tablet no corrige clientes (por ahora)');

-- ---------- Un cajero sin dispositivo y un anónimo no ven nada ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
select is((select count(*)::int from public.customers_for_device), 0, 'un cajero sin dispositivo no ve clientes');
reset role;

set local role anon;
select throws_ok($$ select * from public.customers_for_device $$, '42501', null, 'un anónimo no ve la vista');
select throws_ok($$ select * from public.customers $$, '42501', null, 'ni la tabla');
reset role;

select * from finish();
rollback;
