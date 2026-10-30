-- Pruebas del catálogo [S1-05]: categorías iniciales, productos y quién ve qué.
begin;
select plan(24);

select has_table('public', 'product_categories', 'existen las categorías');
select has_table('public', 'products', 'existen los productos');
select has_view('public', 'sellable_products', 'existe la vista para vender');
select ok((select relrowsecurity from pg_class where oid = 'public.products'::regclass), 'productos tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.product_categories'::regclass), 'categorías tiene RLS');

select is((select count(*)::int from public.product_categories), 11, 'nacen 11 categorías (RF-M1-02)');
select is(
  (select array_agg(name order by sort_order) from public.product_categories),
  array['Vidrio claro / flotado', 'Vidrio templado', 'Esmerilado / satinado', 'Decorado / emplomado',
        'Espejo', 'Cristal doble / termopanel', 'Acrílico', 'Aluminio y cancelería', 'Herrajes',
        'Selladores y silicón', 'Servicios'],
  'las categorías iniciales salen en el orden de RF-M1-02'
);
select is(
  (select count(*)::int from public.product_categories where fiscal_unit_key is null or fiscal_tax_object is null),
  0, 'todas traen valores fiscales de prueba'
);

-- Un dispositivo activo y una cuenta de cajero para las pruebas
insert into public.devices (name, temp_series, auth_user_id)
values ('Tablet de prueba', 1, '00000000-0000-0000-0000-0000000000d1');

-- ---------- Un administrador da de alta y lee ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.products (id, code, name, category_id, kind, charge_unit, list_price_cents, rule_id, rule_params,
       fiscal_product_service_key, fiscal_unit_key, fiscal_tax_object)
     values ('10000000-0000-0000-0000-000000000001', 'VC-6', 'Vidrio claro 6 mm',
       (select id from public.product_categories where sort_order = 1), 'CUSTOM', 'SQUARE_METER', 28000, 'AREA',
       '{"measureStepMm": 50}', '01010101', 'MTK', '02') $$,
  'el administrador da de alta un producto'
);
select lives_ok(
  $$ insert into public.products (id, name, category_id, kind, charge_unit, list_price_cents, rule_id, is_active)
     values ('10000000-0000-0000-0000-000000000002', 'Espejo descontinuado',
       (select id from public.product_categories where sort_order = 5), 'CUSTOM', 'SQUARE_METER', 35000, 'AREA', false) $$,
  'el administrador da de alta un producto inactivo'
);
select is((select count(*)::int from public.products), 2, 'el administrador lee los productos');
select is((select count(*)::int from public.sellable_products), 1, 'la vista para vender solo muestra los activos');

select throws_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id, code)
     values ('Repetido', (select id from public.product_categories where sort_order = 1), 'CUSTOM', 'SQUARE_METER', 100, 'AREA', ' vc-6 ') $$,
  '23505', null, 'el código no se repite, sin importar mayúsculas ni espacios'
);
select throws_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id)
     values ('Servicio por m2', (select id from public.product_categories where sort_order = 11), 'SERVICE', 'SQUARE_METER', 100, 'AREA') $$,
  '23514', null, 'un servicio no se cobra por m²'
);
select throws_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id)
     values ('Negativo', (select id from public.product_categories where sort_order = 1), 'CUSTOM', 'SQUARE_METER', -1, 'AREA') $$,
  '23514', null, 'el precio no puede ser negativo'
);
select throws_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id)
     values ('Sin categoría', '99999999-9999-9999-9999-999999999999', 'CUSTOM', 'SQUARE_METER', 100, 'AREA') $$,
  '23503', null, 'la categoría debe existir'
);
select throws_ok(
  $$ delete from public.products where id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'los productos no se borran'
);
select throws_ok(
  $$ update public.product_categories set name = 'X' where sort_order = 1 $$,
  '42501', null, 'las categorías no se cambian por la API'
);

-- ---------- Un dispositivo vende pero no administra ----------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;

select is((select count(*)::int from public.products), 0, 'el dispositivo no lee la tabla de productos');
select is((select count(*)::int from public.sellable_products), 1, 'el dispositivo ve los productos activos para vender');
select is((select count(*)::int from public.product_categories), 11, 'el dispositivo lee las categorías');
select throws_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id)
     values ('Intento', (select id from public.product_categories where sort_order = 1), 'CUSTOM', 'SQUARE_METER', 100, 'AREA') $$,
  '42501', null, 'el dispositivo no da de alta productos'
);

-- ---------- Un cajero sin sesión de dispositivo no ve nada ----------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
select is((select count(*)::int from public.sellable_products), 0, 'un cajero sin dispositivo no ve productos');

-- ---------- Un anónimo no ve nada ----------
reset role;
set local role anon;
select throws_ok($$ select * from public.sellable_products $$, '42501', null, 'un anónimo no ve la vista');
reset role;

select * from finish();
rollback;
