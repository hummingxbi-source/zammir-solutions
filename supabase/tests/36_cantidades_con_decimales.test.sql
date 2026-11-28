-- Cantidades con decimales [RF-M1-12, ADR-0048, CE-03]: la línea guarda 1.5 exacto y su copia en milésimas
-- enteras; una línea entera de antes sigue igual; solo lo que se vende por pieza o servicio con unidad de venta
-- se marca con decimales.
begin;
select plan(12);

select col_type_is('public', 'quote_lines', 'quantity', 'numeric(12,3)', 'la cantidad de la cotización lleva 3 decimales');
select col_type_is('public', 'work_order_lines', 'quantity', 'numeric(12,3)', 'la de la orden también');
select col_type_is('public', 'counter_sale_lines', 'quantity', 'numeric(12,3)', 'y la de la venta');
select has_column('public', 'counter_sale_lines', 'quantity_milli', 'cada línea tiene su copia en milésimas');

select lives_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id, sale_unit_name,
                                  allows_decimal_quantity)
     values ('Vinil', (select id from public.product_categories where sort_order = 9),
             'STANDARD', 'PIECE', 8500, 'PIECE', 'kilo', true) $$,
  'una pieza con unidad de venta se marca con decimales');
select throws_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id,
                                  allows_decimal_quantity)
     values ('Sin unidad', (select id from public.product_categories where sort_order = 9),
             'STANDARD', 'PIECE', 100, 'PIECE', true) $$,
  '23514', null, 'sin unidad de venta no se vende con decimales');
select has_column('public', 'sellable_products', 'allows_decimal_quantity', 'la vista para vender trae la marca');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
-- 1.5 kg a $85.00 = $127.50 (base $109.91 + IVA $17.59; la jaladera, $89.22 + $14.28) y una pieza entera como la manda una tablet de antes.
create temp table r as select public.receive_operation(jsonb_build_object('opId', gen_random_uuid(),
  'deviceId', 'd0000000-0000-0000-0000-000000000001', 'seq', 1, 'type', 'CreateCounterSale', 'schemaVersion', 1,
  'userId', 'a0000000-0000-0000-0000-000000000001', 'clientCreatedAt', '2090-06-15T23:30:00Z',
  'payload', jsonb_build_object(
    'id', 'e1000000-0000-0000-0000-000000000001', 'tempFolio', 'T1-0001', 'publicCode', 'DDDDDDDD',
    'issuedAt', '2090-06-15T23:40:00Z', 'subtotalCents', 19913, 'taxCents', 3187, 'totalCents', 23100,
    'lines', jsonb_build_array(
      jsonb_build_object(
        'id', 'f1000000-0000-0000-0000-000000000001', 'name', 'Vinil', 'chargeUnit', 'PIECE',
        'unitPriceCents', 8500, 'ruleId', 'PIECE', 'quantity', 1.5, 'lineTotalCents', 12750,
        'baseCents', 10991, 'taxCents', 1759, 'detail', '1.5 kilos × $85.00 = $127.50', 'saleUnitName', 'kilo'),
      jsonb_build_object(
        'id', 'f1000000-0000-0000-0000-000000000002', 'name', 'Jaladera', 'chargeUnit', 'PIECE',
        'unitPriceCents', 10350, 'ruleId', 'PIECE', 'quantity', 1, 'lineTotalCents', 10350,
        'baseCents', 8922, 'taxCents', 1428, 'detail', '1 × $103.50 = $103.50')),
    'payment', jsonb_build_object('groupId', gen_random_uuid(), 'rows', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'method', 'CASH', 'amountCents', 23100,
                         'cashReceivedCents', 23100)))))) as res;
create temp table vista as select lines from public.counter_sales_for_device
  where id = 'e1000000-0000-0000-0000-000000000001';
reset role;

select is((select res->>'status' from r), 'APPLIED', 'la venta con 1.5 kg se aplica');
select is(
  (select array[quantity::text, quantity_milli::text] from public.counter_sale_lines
    where id = 'f1000000-0000-0000-0000-000000000001'),
  array['1.500', '1500'], 'guarda 1.5 exacto y 1500 milésimas');
select is(
  (select quantity_milli::int from public.counter_sale_lines where id = 'f1000000-0000-0000-0000-000000000002'),
  1000, 'una cantidad entera también tiene su copia en milésimas');
select is((select (lines->0->>'quantity')::numeric from vista), 1.5, 'la tablet recibe 1.5');
select throws_ok(
  $$ update public.counter_sale_lines set quantity = 0 where id = 'f1000000-0000-0000-0000-000000000002' $$,
  '23514', null, 'una cantidad de cero no se acepta');

select * from finish();
rollback;
