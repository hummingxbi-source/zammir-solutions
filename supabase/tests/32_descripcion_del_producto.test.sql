-- Descripción del producto [RF-M1-13, ADR-0048, CE-04]: opcional, de hasta 500 caracteres, y la traen las dos
-- vistas de las tablets.
begin;
select plan(6);

select lives_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id, description)
     values ('Cristal templado 10 mm', (select id from public.product_categories where sort_order = 1),
             'CUSTOM', 'SQUARE_METER', 90000, 'AREA', 'Para puertas y barandales') $$,
  'un producto con descripción se da de alta');
select lives_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id)
     values ('Sin descripción', (select id from public.product_categories where sort_order = 1),
             'CUSTOM', 'SQUARE_METER', 90000, 'AREA') $$,
  'la descripción es opcional');
select throws_ok(
  format($$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id, description)
     values ('Muy larga', (select id from public.product_categories where sort_order = 1),
             'CUSTOM', 'SQUARE_METER', 90000, 'AREA', %L) $$, repeat('a', 501)),
  '23514', null, 'más de 500 caracteres no se acepta');

select has_column('public', 'sellable_products', 'description', 'la vista para vender trae la descripción');
select has_column('public', 'catalog_products_for_device', 'description', 'la réplica de la tablet la trae');
select ok(
  has_column_privilege('authenticated', 'public.products', 'description', 'UPDATE'),
  'el administrador puede cambiar la descripción al editar el producto'
);

select * from finish();
rollback;
