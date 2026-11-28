-- Paquetes [RF-M1-18, ADR-0048, CE-09]: el tipo BUNDLE existe con sus componentes, solo un paquete los lleva,
-- no tiene precio abierto y llega a las tablets.
begin;
select plan(9);

select lives_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id, bundle_items)
     values ('Cancel de baño', (select id from public.product_categories where sort_order = 8),
             'BUNDLE', 'PIECE', 0, 'PIECE',
             '[{"productId": "00000000-0000-4000-8000-000000000001", "quantity": 1},
               {"productId": "00000000-0000-4000-8000-000000000002", "quantity": 2}]') $$,
  'un paquete con sus componentes se da de alta');
select throws_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id)
     values ('Paquete vacío', (select id from public.product_categories where sort_order = 8),
             'BUNDLE', 'PIECE', 0, 'PIECE') $$,
  '23514', null, 'un paquete sin componentes no se acepta');
select throws_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id, bundle_items)
     values ('Pieza con componentes', (select id from public.product_categories where sort_order = 9),
             'STANDARD', 'PIECE', 100, 'PIECE', '[{"productId": "00000000-0000-4000-8000-000000000001", "quantity": 1}]') $$,
  '23514', null, 'un producto que no es paquete no lleva componentes');
select throws_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id, bundle_items)
     values ('Paquete por m²', (select id from public.product_categories where sort_order = 8),
             'BUNDLE', 'SQUARE_METER', 0, 'AREA', '[{"productId": "00000000-0000-4000-8000-000000000001", "quantity": 1}]') $$,
  '23514', null, 'un paquete se guarda como pieza');
select throws_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id, bundle_items,
                                  is_open_price)
     values ('Paquete abierto', (select id from public.product_categories where sort_order = 8),
             'BUNDLE', 'PIECE', 0, 'PIECE', '[{"productId": "00000000-0000-4000-8000-000000000001", "quantity": 1}]',
             true) $$,
  '23514', null, 'un paquete no tiene precio abierto');
select is((select count(*)::int from public.products where kind <> 'BUNDLE' and bundle_items <> '[]'::jsonb), 0,
  'los productos de antes quedan sin componentes');

select has_column('public', 'sellable_products', 'bundle_items', 'la vista para vender trae los componentes');
select has_column('public', 'catalog_products_for_device', 'bundle_items', 'la réplica de la tablet los trae');
select ok(
  has_column_privilege('authenticated', 'public.products', 'bundle_items', 'UPDATE'),
  'el administrador puede cambiar los componentes al editar el paquete'
);

select * from finish();
rollback;
