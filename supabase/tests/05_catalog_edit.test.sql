-- Pruebas de edición del catálogo [S1-06]: historial de precios, bitácora y permisos.
begin;
select plan(20);

select has_table('public', 'product_price_history', 'existe el historial de precios');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.product_price_history'::regclass),
  'el historial tiene RLS'
);

insert into public.devices (name, temp_series, auth_user_id)
values ('Tablet de prueba', 1, '00000000-0000-0000-0000-0000000000d1');

-- El producto lo da de alta el dueño de la base para partir de un estado conocido.
insert into public.products (id, code, name, category_id, kind, charge_unit, list_price_cents, rule_id)
values ('20000000-0000-0000-0000-000000000001', 'ED-1', 'Vidrio claro 6 mm',
        (select id from public.product_categories where sort_order = 1), 'CUSTOM', 'SQUARE_METER', 28000, 'AREA');

-- ---------- Un administrador edita ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;

update public.products set name = 'Vidrio claro 6 mm (nuevo)' where id = '20000000-0000-0000-0000-000000000001';
select is((select name from public.products where id = '20000000-0000-0000-0000-000000000001'),
  'Vidrio claro 6 mm (nuevo)', 'el administrador cambia el nombre');
select is((select count(*)::int from public.product_price_history), 0, 'cambiar el nombre no deja historial de precios');

update public.products set list_price_cents = 31500 where id = '20000000-0000-0000-0000-000000000001';
select is(
  (select array[old_price_cents::text, new_price_cents::text] from public.product_price_history),
  array['28000', '31500'], 'un cambio de precio deja el historial con el valor anterior y el nuevo'
);
select is(
  (select changed_by from public.product_price_history),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'el historial guarda quién lo cambió'
);

update public.products set list_price_cents = 31500, name = 'Mismo precio' where id = '20000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.product_price_history), 1, 'guardar con el mismo precio no agrega historial');

update public.products set is_active = false where id = '20000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.sellable_products), 0, 'un producto desactivado sale de la venta');
select is((select count(*)::int from public.products), 1, 'pero se conserva para el administrador');

-- No se cambian las columnas protegidas ni se borra
select throws_ok(
  $$ update public.products set id = '20000000-0000-0000-0000-000000000009' where id = '20000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'el identificador del producto no se cambia'
);
select throws_ok(
  $$ delete from public.products where id = '20000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'un administrador no puede borrar un producto'
);
select throws_ok(
  $$ update public.product_price_history set new_price_cents = 1 $$,
  '42501', null, 'el administrador no modifica el historial'
);

reset role;

-- ---------- La bitácora recibió los cambios ----------
select is(
  (select array_agg(action order by action) from public.audit_log
   where entity_id = '20000000-0000-0000-0000-000000000001'),
  array['PRODUCT_DEACTIVATED', 'PRODUCT_PRICE_CHANGED'], 'precio y desactivación quedan en la bitácora'
);
select is(
  (select array[old_value ->> 'precio_centavos', new_value ->> 'precio_centavos'] from public.audit_log
   where entity_id = '20000000-0000-0000-0000-000000000001' and action = 'PRODUCT_PRICE_CHANGED'),
  array['28000', '31500'], 'la bitácora guarda el valor anterior y el nuevo'
);

-- ---------- Ni el dueño de la base toca el historial ----------
select throws_ok(
  $$ update public.product_price_history set new_price_cents = 1 $$,
  'P0001', 'El historial de precios no se modifica ni se borra', 'el dueño tampoco modifica el historial'
);
select throws_ok(
  $$ delete from public.product_price_history $$,
  'P0001', 'El historial de precios no se modifica ni se borra', 'ni lo borra'
);

-- ---------- Dispositivo y cajero no editan ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
update public.products set name = 'Intento del dispositivo' where id = '20000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.product_price_history), 0, 'el dispositivo no ve el historial de precios');
reset role;
select is((select name from public.products where id = '20000000-0000-0000-0000-000000000001'),
  'Mismo precio', 'el dispositivo no cambió el producto');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
update public.products set list_price_cents = 1 where id = '20000000-0000-0000-0000-000000000001';
reset role;
select is((select list_price_cents from public.products where id = '20000000-0000-0000-0000-000000000001'),
  31500::bigint, 'un cajero no cambia precios');

-- ---------- Un anónimo no ve nada ----------
set local role anon;
select throws_ok($$ select * from public.product_price_history $$, '42501', null, 'un anónimo no ve el historial');
reset role;

select * from finish();
rollback;
