-- Ventas de mostrador [S3-11 a S3-15]: se pagan completas, llevan quién cobró, dispositivo y hora,
-- se cancelan sin borrar nada y la tablet no escribe directo en las tablas.
begin;
select plan(15);

select has_table('public', 'counter_sales', 'existen las ventas de mostrador');
select has_table('public', 'counter_sale_lines', 'existen las líneas de venta');
select has_view('public', 'counter_sales_for_device', 'existe la vista de ventas para la tablet');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Luis', 'ADMIN', true, 's', 1000, 'h', 1);

create function pg_temp.op(p_op uuid, p_seq int, p_type text, p_payload jsonb,
  p_user uuid default 'a0000000-0000-0000-0000-000000000001', p_auth uuid default null)
returns jsonb language sql as $$
  select jsonb_build_object('opId', p_op, 'deviceId', 'd0000000-0000-0000-0000-000000000001', 'seq', p_seq,
    'type', p_type, 'schemaVersion', 1, 'userId', p_user, 'authorizedBy', p_auth,
    'clientCreatedAt', '2090-06-15T18:00:00Z', 'payload', p_payload);
$$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;

create temp table r_venta as
  select public.receive_operation(pg_temp.op('10000000-0000-0000-0000-000000000001', 1, 'CreateCounterSale', jsonb_build_object(
    'id', 'e1000000-0000-0000-0000-000000000001', 'tempFolio', 'T1-0001', 'publicCode', 'BBBBBBBB',
    'issuedAt', '2090-06-15T18:00:00Z', 'subtotalCents', 10000, 'taxCents', 1600, 'totalCents', 11600,
    'lines', jsonb_build_array(jsonb_build_object(
      'id', 'f1000000-0000-0000-0000-000000000001', 'name', 'Chapa', 'chargeUnit', 'PIECE',
      'unitPriceCents', 11600, 'ruleId', 'PIECE', 'quantity', 1,
      'lineTotalCents', 11600, 'baseCents', 10000, 'taxCents', 1600, 'detail', '1 pieza')),
    'payment', jsonb_build_object('groupId', 'b2000000-0000-0000-0000-000000000001', 'rows', jsonb_build_array(
      jsonb_build_object('id', 'b3000000-0000-0000-0000-000000000001', 'method', 'CASH', 'amountCents', 6000, 'cashReceivedCents', 7000),
      jsonb_build_object('id', 'b3000000-0000-0000-0000-000000000002', 'method', 'TRANSFER', 'amountCents', 5600, 'reference', 'REF')))))) as r;

select throws_ok($$ insert into public.counter_sales (id, temp_folio, public_code, issued_at, subtotal_cents, tax_cents,
    total_cents, device_id, user_id, op_id, change_seq)
  values (gen_random_uuid(), 'T1-0009', 'CCCCCCCC', now(), 0, 0, 0, 'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001', gen_random_uuid(), 0) $$,
  '42501', null, 'la tablet no inserta ventas directamente');
select is((select count(*)::int from public.counter_sales), 0, 'la tablet no lee la tabla de ventas');
select is((select count(*)::int from public.counter_sales_for_device), 1, 'la tablet lee la vista de ventas');
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'counter_sales_for_device' and column_name like 'fiscal%'),
  0, 'la vista no trae columnas fiscales');
reset role;

select is((select r->>'folio' from r_venta), 'V-2090-0001', 'la venta recibe su folio V definitivo');
select is((select r->>'status' from r_venta), 'APPLIED', 'un cobro mixto que suma el total se aplica');
select is((select count(*)::int from public.payments where counter_sale_id = 'e1000000-0000-0000-0000-000000000001'),
  2, 'el cobro mixto son dos filas');
select is((select user_id::text from public.payments where id = 'b3000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001', 'cada pago guarda quién cobró');
select is((select change_cents from public.payments where id = 'b3000000-0000-0000-0000-000000000001'), 1000::bigint,
  'el cambio del efectivo queda anotado');

-- Una venta cancelada no se borra: conserva sus pagos.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
create temp table r_cancel as
  select public.receive_operation(pg_temp.op('10000000-0000-0000-0000-000000000002', 2, 'CancelCounterSale',
    jsonb_build_object('id', 'e1000000-0000-0000-0000-000000000001', 'reason', 'Error de captura'),
    'a0000000-0000-0000-0000-000000000002')) as r;
reset role;
select is((select status from public.counter_sales where id = 'e1000000-0000-0000-0000-000000000001'),
  'CANCELLED', 'un administrador cancela la venta');
select is((select count(*)::int from public.payments where counter_sale_id = 'e1000000-0000-0000-0000-000000000001'),
  2, 'cancelar no borra los pagos');
select throws_ok($$ delete from public.payments $$, '42501', null, 'los pagos de una venta tampoco se borran');

select * from finish();
rollback;
