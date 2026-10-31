-- Pruebas de la réplica del catálogo [S1-09]: número de cambio y vista para la tablet.
begin;
select plan(9);

select has_view('public', 'catalog_products_for_device', 'existe la vista de réplica');
select has_column('public', 'products', 'change_seq', 'los productos traen su número de cambio');

insert into public.devices (name, temp_series, auth_user_id)
values ('Tablet de réplica', 1, '00000000-0000-0000-0000-0000000000d1');

insert into public.products (id, code, name, category_id, kind, charge_unit, list_price_cents, rule_id)
values
  ('10000000-0000-0000-0000-0000000000a1', 'R-1', 'Producto uno',
   (select id from public.product_categories where sort_order = 1), 'CUSTOM', 'SQUARE_METER', 10000, 'AREA'),
  ('10000000-0000-0000-0000-0000000000a2', 'R-2', 'Producto dos',
   (select id from public.product_categories where sort_order = 1), 'CUSTOM', 'SQUARE_METER', 20000, 'AREA');

select cmp_ok(
  (select change_seq from public.products where code = 'R-2'),
  '>',
  (select change_seq from public.products where code = 'R-1'),
  'cada alta recibe un número mayor que el anterior'
);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;

update public.products set list_price_cents = 12000 where code = 'R-1';

select cmp_ok(
  (select change_seq from public.products where code = 'R-1'),
  '>',
  (select max(change_seq) from public.products where code = 'R-2'),
  'un cambio de precio le da al producto un número nuevo, mayor que todos los anteriores'
);

update public.products set is_active = false where code = 'R-2';

-- ---------- La tablet activa ve todo, también lo desactivado ----------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;

select is(
  (select count(*)::int from public.catalog_products_for_device where code in ('R-1', 'R-2')),
  2, 'la tablet recibe los dos productos'
);
select is(
  (select is_active from public.catalog_products_for_device where code = 'R-2'),
  false, 'el desactivado viaja con su marca para dejar de ofrecerlo'
);
select is(
  (select list_price_cents from public.catalog_products_for_device where code = 'R-1'),
  12000::bigint, 'el precio nuevo es el que ve la tablet'
);
select throws_ok(
  $$ select fiscal_unit_key from public.catalog_products_for_device $$,
  '42703', null, 'la vista no expone datos fiscales ni de administración'
);

-- ---------- Un cajero sin tablet no ve nada ----------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;

select is(
  (select count(*)::int from public.catalog_products_for_device),
  0, 'un cajero sin tablet no recibe el catálogo'
);

select * from finish();
rollback;
