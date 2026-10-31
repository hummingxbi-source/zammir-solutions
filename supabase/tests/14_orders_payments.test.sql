-- Órdenes de trabajo, pagos y garantías [S3-01 a S3-08]: nada se borra, los pagos solo se agregan,
-- la tablet no escribe en las tablas y sus vistas no traen datos fiscales.
begin;
select plan(17);

select has_table('public', 'work_orders', 'existen las órdenes');
select has_table('public', 'payments', 'existen los pagos');
select has_table('public', 'warranties', 'existen las garantías');
select has_view('public', 'work_orders_for_device', 'existe la vista de órdenes para la tablet');
select has_view('public', 'payments_for_device', 'existe la vista de pagos para la tablet');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Luis', 'ADMIN', true, 's', 1000, 'h', 1);
insert into public.customers (id, name, phone) values
  ('c0000000-0000-0000-0000-000000000001', 'Cliente de prueba', '5512345678');

create function pg_temp.op(p_op uuid, p_seq int, p_type text, p_payload jsonb, p_user uuid default 'a0000000-0000-0000-0000-000000000001', p_auth uuid default null)
returns jsonb language sql as $$
  select jsonb_build_object('opId', p_op, 'deviceId', 'd0000000-0000-0000-0000-000000000001', 'seq', p_seq,
    'type', p_type, 'schemaVersion', 1, 'userId', p_user, 'authorizedBy', p_auth,
    'clientCreatedAt', '2090-06-15T18:00:00Z', 'payload', p_payload);
$$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;

create temp table r_orden as
  select public.receive_operation(pg_temp.op('10000000-0000-0000-0000-000000000001', 1, 'CreateWorkOrder', jsonb_build_object(
    'id', 'e0000000-0000-0000-0000-000000000001', 'tempFolio', 'T1-0001', 'publicCode', 'AAAAAAAA',
    'customerId', 'c0000000-0000-0000-0000-000000000001', 'issuedAt', '2090-06-15T18:00:00Z',
    'depositPercentBps', 5000, 'depositRequiredCents', 5800,
    'subtotalCents', 10000, 'taxCents', 1600, 'totalCents', 11600,
    'lines', jsonb_build_array(jsonb_build_object(
      'id', 'f0000000-0000-0000-0000-000000000001', 'name', 'Vidrio', 'chargeUnit', 'SQUARE_METER',
      'unitPriceCents', 11600, 'ruleId', 'AREA', 'widthMm', 1000, 'heightMm', 1000, 'quantity', 1,
      'lineTotalCents', 11600, 'baseCents', 10000, 'taxCents', 1600, 'detail', '1 m²'))))) as r;
create temp table r_pago as
  select public.receive_operation(pg_temp.op('10000000-0000-0000-0000-000000000002', 2, 'RegisterPayment', jsonb_build_object(
    'groupId', 'b0000000-0000-0000-0000-000000000001',
    'target', jsonb_build_object('type', 'WORK_ORDER', 'id', 'e0000000-0000-0000-0000-000000000001'),
    'kind', 'DEPOSIT', 'paidAt', '2090-06-15T18:00:00Z',
    'rows', jsonb_build_array(jsonb_build_object('id', 'b1000000-0000-0000-0000-000000000001',
      'method', 'CASH', 'amountCents', 5800, 'cashReceivedCents', 6000))))) as r;

-- La tablet no escribe directo en las tablas.
select throws_ok($$ insert into public.work_orders (id, temp_folio, public_code, customer_id, issued_at,
    subtotal_cents, tax_cents, total_cents, deposit_percent_bps, deposit_required_cents, device_id, user_id, op_id, change_seq)
  values (gen_random_uuid(), 'T1-0009', 'ZZZZZZZZ', 'c0000000-0000-0000-0000-000000000001', now(), 0, 0, 0, 0, 0,
    'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', gen_random_uuid(), 0) $$,
  '42501', null, 'la tablet no inserta órdenes directamente');
select throws_ok($$ insert into public.payments (id, group_id, kind, method, amount_cents, user_id, device_id, paid_at, op_id, work_order_id)
  values (gen_random_uuid(), gen_random_uuid(), 'DEPOSIT', 'TRANSFER', 100, 'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001', now(), gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'la tablet no inserta pagos directamente');
select is((select count(*)::int from public.work_orders), 0, 'la tablet no lee la tabla de órdenes');
select is((select count(*)::int from public.work_orders_for_device), 1, 'la tablet lee la vista de órdenes');
select is((select count(*)::int from public.payments_for_device), 1, 'la tablet lee la vista de pagos');
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name in ('work_orders_for_device', 'payments_for_device')
      and column_name like 'fiscal%'),
  0, 'las vistas de la tablet no traen columnas fiscales');
reset role;

select is((select r->>'folio' from r_orden), 'OT-2090-0001', 'la orden recibe su folio OT definitivo');
select is((select r->>'status' from r_pago), 'APPLIED', 'el anticipo se aplica');

-- Los pagos solo se agregan: ni siquiera quien administra la base los modifica o borra.
select throws_ok($$ update public.payments set amount_cents = 1 $$, '42501', null, 'un pago no se modifica');
select throws_ok($$ delete from public.payments $$, '42501', null, 'un pago no se borra');
select throws_ok($$ update public.work_order_status_events set reason = 'x' $$, '42501', null,
  'el historial de estados no se modifica');

-- Un efectivo recibido menor a lo aplicado ni siquiera cabe en la tabla.
select throws_ok($$ insert into public.payments (id, group_id, work_order_id, kind, method, amount_cents,
    cash_received_cents, change_cents, user_id, device_id, paid_at, op_id)
  values (gen_random_uuid(), gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'DEPOSIT', 'CASH', 500,
    100, -400, 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', now(), gen_random_uuid()) $$,
  '23514', null, 'el efectivo recibido no puede ser menor que lo aplicado');

select * from finish();
rollback;
