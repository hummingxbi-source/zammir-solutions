-- Unidad de venta [RF-M1-11, ADR-0048, CE-02]: solo para lo que se cobra por pieza o servicio, la traen las vistas
-- de las tablets, cada línea guarda su copia y una línea sin unidad (de una tablet de antes) sigue igual.
begin;
select plan(11);

select lives_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id, sale_unit_name)
     values ('Felpa', (select id from public.product_categories where sort_order = 1),
             'STANDARD', 'PIECE', 4500, 'PIECE', 'rollo') $$,
  'una pieza con unidad de venta se da de alta');
select throws_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id, sale_unit_name)
     values ('Vidrio', (select id from public.product_categories where sort_order = 1),
             'CUSTOM', 'SQUARE_METER', 28000, 'AREA', 'hoja') $$,
  '23514', null, 'lo que se cobra por m² no lleva unidad de venta');
select throws_ok(
  format($$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id, sale_unit_name)
     values ('Larga', (select id from public.product_categories where sort_order = 1),
             'STANDARD', 'PIECE', 100, 'PIECE', %L) $$, repeat('a', 21)),
  '23514', null, 'más de 20 caracteres no se acepta');

select has_column('public', 'sellable_products', 'sale_unit_name', 'la vista para vender trae la unidad');
select has_column('public', 'catalog_products_for_device', 'sale_unit_name', 'la réplica de la tablet la trae');
select ok(
  has_column_privilege('authenticated', 'public.products', 'sale_unit_name', 'UPDATE'),
  'el administrador puede cambiar la unidad al editar el producto'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
-- Una venta con dos líneas de $116.00: una con unidad de venta y otra sin ella, como la manda una tablet de antes.
create temp table r as select public.receive_operation(jsonb_build_object('opId', gen_random_uuid(),
  'deviceId', 'd0000000-0000-0000-0000-000000000001', 'seq', 1, 'type', 'CreateCounterSale', 'schemaVersion', 1,
  'userId', 'a0000000-0000-0000-0000-000000000001', 'clientCreatedAt', '2090-06-15T23:30:00Z',
  'payload', jsonb_build_object(
    'id', 'e1000000-0000-0000-0000-000000000001', 'tempFolio', 'T1-0001', 'publicCode', 'DDDDDDDD',
    'issuedAt', '2090-06-15T23:40:00Z', 'subtotalCents', 20000, 'taxCents', 3200, 'totalCents', 23200,
    'lines', jsonb_build_array(
      jsonb_build_object(
        'id', 'f1000000-0000-0000-0000-000000000001', 'name', 'Felpa', 'chargeUnit', 'PIECE',
        'unitPriceCents', 5800, 'ruleId', 'PIECE', 'quantity', 2, 'lineTotalCents', 11600,
        'baseCents', 10000, 'taxCents', 1600, 'detail', '2 rollos × $58.00 = $116.00', 'saleUnitName', 'rollo'),
      jsonb_build_object(
        'id', 'f1000000-0000-0000-0000-000000000002', 'name', 'Jaladera', 'chargeUnit', 'PIECE',
        'unitPriceCents', 5800, 'ruleId', 'PIECE', 'quantity', 2, 'lineTotalCents', 11600,
        'baseCents', 10000, 'taxCents', 1600, 'detail', '2 × $58.00 = $116.00')),
    'payment', jsonb_build_object('groupId', gen_random_uuid(), 'rows', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'method', 'CASH', 'amountCents', 23200,
                         'cashReceivedCents', 23200)))))) as res;
create temp table vista as select lines from public.counter_sales_for_device
  where id = 'e1000000-0000-0000-0000-000000000001';
reset role;

select is((select res->>'status' from r), 'APPLIED', 'la venta se aplica');
select is((select sale_unit_name from public.counter_sale_lines where id = 'f1000000-0000-0000-0000-000000000001'),
  'rollo', 'la línea guarda su copia de la unidad');
select is((select sale_unit_name from public.counter_sale_lines where id = 'f1000000-0000-0000-0000-000000000002'),
  null, 'una línea sin unidad queda sin ella');
select is((select lines->0->>'saleUnitName' from vista), 'rollo', 'y llega a la tablet');
select ok(not ((select lines->1 from vista) ? 'saleUnitName'), 'la línea sin unidad no trae la llave');

select * from finish();
rollback;
