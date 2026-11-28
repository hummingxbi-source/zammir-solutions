-- PP-39 · Descripción en el documento del cliente [RF-M1-13]: cada línea guarda su copia de la descripción del
-- producto, llega a la tablet, y una línea sin descripción (de una tablet de antes) sigue igual.
begin;
select plan(6);

select has_column('public', 'quote_lines', 'description', 'la línea de la cotización guarda la descripción');
select has_column('public', 'work_order_lines', 'description', 'la de la orden también');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
create temp table r as select public.receive_operation(jsonb_build_object('opId', gen_random_uuid(),
  'deviceId', 'd0000000-0000-0000-0000-000000000001', 'seq', 1, 'type', 'CreateCounterSale', 'schemaVersion', 1,
  'userId', 'a0000000-0000-0000-0000-000000000001', 'clientCreatedAt', '2090-06-15T23:30:00Z',
  'payload', jsonb_build_object(
    'id', 'e1000000-0000-0000-0000-000000000001', 'tempFolio', 'T1-0001', 'publicCode', 'DDDDDDDD',
    'issuedAt', '2090-06-15T23:40:00Z', 'subtotalCents', 20000, 'taxCents', 3200, 'totalCents', 23200,
    'lines', jsonb_build_array(
      jsonb_build_object(
        'id', 'f1000000-0000-0000-0000-000000000001', 'name', 'Kit de cancel', 'chargeUnit', 'PIECE',
        'unitPriceCents', 11600, 'ruleId', 'PIECE', 'quantity', 1, 'lineTotalCents', 11600,
        'baseCents', 10000, 'taxCents', 1600, 'detail', '1 × $116.00 = $116.00',
        'description', 'Incluye rieles, carretillas y jaladera'),
      jsonb_build_object(
        'id', 'f1000000-0000-0000-0000-000000000002', 'name', 'Jaladera', 'chargeUnit', 'PIECE',
        'unitPriceCents', 11600, 'ruleId', 'PIECE', 'quantity', 1, 'lineTotalCents', 11600,
        'baseCents', 10000, 'taxCents', 1600, 'detail', '1 × $116.00 = $116.00')),
    'payment', jsonb_build_object('groupId', gen_random_uuid(), 'rows', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'method', 'CASH', 'amountCents', 23200,
                         'cashReceivedCents', 23200)))))) as res;
create temp table vista as select lines from public.counter_sales_for_device
  where id = 'e1000000-0000-0000-0000-000000000001';
reset role;

select is((select res->>'status' from r), 'APPLIED', 'la venta se aplica');
select is((select description from public.counter_sale_lines where id = 'f1000000-0000-0000-0000-000000000001'),
  'Incluye rieles, carretillas y jaladera', 'la línea guarda su copia de la descripción');
select is((select lines->0->>'description' from vista), 'Incluye rieles, carretillas y jaladera',
  'y llega a la tablet');
select ok(not ((select lines->1 from vista) ? 'description'), 'la línea sin descripción no trae la llave');

select * from finish();
rollback;
