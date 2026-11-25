-- Cargos extra ligados a la línea [RF-M1-09, ADR-0044, AJ-09]: el tipo EXTRA existe con sus unidades, el detalle
-- de los extras se guarda en la línea y llega a la tablet, y las líneas de antes quedan con un arreglo vacío.
begin;
select plan(6);

select lives_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id)
     values ('Canto pulido', (select id from public.product_categories where sort_order = 1),
             'EXTRA', 'SQUARE_METER', 12000, 'AREA') $$,
  'un cargo extra por m² se da de alta');
select throws_ok(
  $$ insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id)
     values ('Extra raro', (select id from public.product_categories where sort_order = 1),
             'EXTRA', 'SERVICE', 100, 'SERVICE') $$,
  '23514', null, 'un cargo extra no se cobra como servicio');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
-- Una venta con una línea de vidrio de 1 m² ($116.00) y su canto ($50.00): la línea vale $166.00.
create temp table r as select public.receive_operation(jsonb_build_object('opId', gen_random_uuid(),
  'deviceId', 'd0000000-0000-0000-0000-000000000001', 'seq', 1, 'type', 'CreateCounterSale', 'schemaVersion', 1,
  'userId', 'a0000000-0000-0000-0000-000000000001', 'clientCreatedAt', '2090-06-15T23:30:00Z',
  'payload', jsonb_build_object(
    'id', 'e1000000-0000-0000-0000-000000000001', 'tempFolio', 'T1-0001', 'publicCode', 'DDDDDDDD',
    'issuedAt', '2090-06-15T23:40:00Z', 'subtotalCents', 14310, 'taxCents', 2290, 'totalCents', 16600,
    'lines', jsonb_build_array(jsonb_build_object(
      'id', 'f1000000-0000-0000-0000-000000000001', 'name', 'Vidrio', 'chargeUnit', 'SQUARE_METER',
      'unitPriceCents', 11600, 'ruleId', 'AREA', 'widthMm', 1000, 'heightMm', 1000, 'quantity', 1,
      'lineTotalCents', 16600, 'baseCents', 14310, 'taxCents', 2290, 'detail', '1 m² + canto',
      'extras', jsonb_build_array(jsonb_build_object(
        'productId', gen_random_uuid(), 'name', 'Canto pulido', 'chargeUnit', 'SQUARE_METER',
        'unitPriceCents', 5000, 'ruleId', 'AREA', 'quantity', 1, 'amountCents', 5000)))),
    'payment', jsonb_build_object('groupId', gen_random_uuid(), 'rows', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'method', 'CASH', 'amountCents', 16600,
                         'cashReceivedCents', 16600)))))) as res;
create temp table vista as select lines from public.counter_sales_for_device
  where id = 'e1000000-0000-0000-0000-000000000001';
reset role;

select is((select res->>'status' from r), 'APPLIED', 'la venta con un cargo extra se aplica');
select is((select extras->0->>'name' from public.counter_sale_lines where id = 'f1000000-0000-0000-0000-000000000001'),
  'Canto pulido', 'el detalle del extra se guarda en la línea');
select is((select (lines->0->'extras'->0->>'amountCents')::int from vista), 5000, 'y llega a la tablet');
select is((select count(*)::int from public.quote_lines where extras <> '[]'::jsonb), 0,
  'las líneas de antes quedan sin extras');

select * from finish();
rollback;
