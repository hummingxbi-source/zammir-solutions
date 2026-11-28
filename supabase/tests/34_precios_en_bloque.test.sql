-- Precios en bloque [RF-M1-15, ADR-0048, RN-19, CE-06]: cambia varios productos en una sola transacción, todo o
-- nada, con su historial de precios; solo un administrador.
begin;
select plan(9);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;

insert into public.products (id, code, name, category_id, kind, charge_unit, list_price_cents, rule_id, description)
values
  ('20000000-0000-0000-0000-000000000001', 'BI-1', 'Bisagra',
   (select id from public.product_categories where sort_order = 9), 'STANDARD', 'PIECE', 4550, 'PIECE', 'Antes'),
  ('20000000-0000-0000-0000-000000000002', 'JA-1', 'Jaladera',
   (select id from public.product_categories where sort_order = 9), 'STANDARD', 'PIECE', 12000, 'PIECE', null);

select is(
  (select count(*)::int from public.update_products_in_bulk(jsonb_build_array(
    jsonb_build_object('id', '20000000-0000-0000-0000-000000000001', 'name', 'Bisagra de pivote',
                       'listPriceCents', 5000, 'description', null),
    jsonb_build_object('id', '20000000-0000-0000-0000-000000000002', 'name', 'Jaladera',
                       'listPriceCents', 13000, 'description', 'Para cancel de baño')))),
  2, 'cambia los dos productos y los devuelve');
select is((select name from public.products where code = 'BI-1'), 'Bisagra de pivote', 'cambia el nombre');
select is((select list_price_cents::int from public.products where code = 'BI-1'), 5000, 'cambia el precio');
select is((select description from public.products where code = 'BI-1'), null, 'una descripción en null la quita');
select is((select description from public.products where code = 'JA-1'), 'Para cancel de baño', 'y otra la pone');
select is(
  (select count(*)::int from public.product_price_history
    where product_id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')),
  2, 'cada cambio de precio queda en el historial');

select throws_ok(
  $$ select * from public.update_products_in_bulk(jsonb_build_array(
       jsonb_build_object('id', '20000000-0000-0000-0000-000000000001', 'name', 'No debe quedar',
                          'listPriceCents', 1, 'description', null),
       jsonb_build_object('id', '29999999-0000-0000-0000-000000000000', 'name', 'Fantasma',
                          'listPriceCents', 1, 'description', null))) $$,
  'P0002', null, 'un producto que no existe cancela todo el lote');
select is((select name from public.products where code = 'BI-1'), 'Bisagra de pivote',
  'y el primero queda como estaba');

reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
select throws_ok(
  $$ select * from public.update_products_in_bulk('[]'::jsonb) $$,
  '42501', null, 'quien no es administrador no cambia precios en bloque');

select * from finish();
rollback;
