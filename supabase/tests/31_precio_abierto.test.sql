-- Precio abierto [RF-M1-10, ADR-0048, CE-01]: la marca existe, por omisión está apagada, un cargo extra no la
-- puede tener y las dos vistas de las tablets la traen.
begin;
select plan(5);

insert into public.products (id, name, category_id, kind, charge_unit, list_price_cents, rule_id)
values ('b1000000-0000-0000-0000-000000000001', 'Visita',
        (select id from public.product_categories where sort_order = 1), 'SERVICE', 'SERVICE', 50000, 'SERVICE');

select is((select is_open_price from public.products where id = 'b1000000-0000-0000-0000-000000000001'),
  false, 'un producto nace con precio fijo');

select lives_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id, is_open_price)
     values ('Reparación de ventana', (select id from public.product_categories where sort_order = 1),
             'SERVICE', 'SERVICE', 50000, 'SERVICE', true) $$,
  'un servicio puede tener precio abierto');

select throws_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id, is_open_price)
     values ('Canto abierto', (select id from public.product_categories where sort_order = 1),
             'EXTRA', 'SQUARE_METER', 12000, 'AREA', true) $$,
  '23514', null, 'un cargo extra no puede tener precio abierto');

select has_column('public', 'sellable_products', 'is_open_price', 'la vista para vender trae la marca');
select has_column('public', 'catalog_products_for_device', 'is_open_price', 'la réplica de la tablet trae la marca');

select * from finish();
rollback;
