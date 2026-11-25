-- Entregas por partes [RF-M3-10, ADR-0044, AJ-07]: una cotización se convierte en varias órdenes, cada una con sus
-- líneas; una línea entra en una sola orden y la tablet recibe la marca de "por partes".
begin;
select plan(7);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1);
insert into public.customers (id, name, phone) values
  ('c0000000-0000-0000-0000-000000000001', 'Cliente de prueba', '5512345678');
insert into public.quotes (id, temp_folio, public_code, status, customer_id, issued_at, valid_until, conditions_text,
  subtotal_cents, tax_cents, total_cents, device_id, user_id, op_id) values
  ('90000000-0000-0000-0000-000000000001', 'T1-0001', 'QQQQQQQQ', 'ACCEPTED', 'c0000000-0000-0000-0000-000000000001',
   '2090-06-15T18:00:00Z', '2090-06-30', '', 20000, 3200, 23200,
   'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', gen_random_uuid());

create function pg_temp.parte(p_seq int, p_orden text, p_linea text, p_codigo text, p_por_partes boolean)
returns jsonb language sql as $$
  select public.receive_operation(jsonb_build_object('opId', gen_random_uuid(),
    'deviceId', 'd0000000-0000-0000-0000-000000000001', 'seq', p_seq, 'type', 'CreateWorkOrder',
    'schemaVersion', 1, 'userId', 'a0000000-0000-0000-0000-000000000001',
    'clientCreatedAt', '2090-06-16T18:00:00Z', 'payload', jsonb_build_object(
      'id', p_orden, 'tempFolio', 'T1-000' || (p_seq + 1)::text, 'publicCode', p_codigo,
      'customerId', 'c0000000-0000-0000-0000-000000000001', 'quoteId', '90000000-0000-0000-0000-000000000001',
      'issuedAt', '2090-06-16T18:00:00Z', 'estimatedDeliveryDate', '2090-06-30',
      'depositPercentBps', 5000, 'depositRequiredCents', 5800,
      'subtotalCents', 10000, 'taxCents', 1600, 'totalCents', 11600,
      'lines', jsonb_build_array(jsonb_build_object(
        'id', p_linea, 'name', 'Vidrio', 'chargeUnit', 'SQUARE_METER',
        'unitPriceCents', 11600, 'ruleId', 'AREA', 'widthMm', 1000, 'heightMm', 1000, 'quantity', 1,
        'lineTotalCents', 11600, 'baseCents', 10000, 'taxCents', 1600, 'detail', '1 m²')))
      || case when p_por_partes then jsonb_build_object('inParts', true) else '{}'::jsonb end));
$$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
create temp table r1 as select pg_temp.parte(1, 'e0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-00000000000a', 'AAAAAAAA', true) as r;
create temp table r2 as select pg_temp.parte(2, 'e0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-00000000000b', 'BBBBBBBB', true) as r;
create temp table r3 as select pg_temp.parte(3, 'e0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-00000000000a', 'CCCCCCCC', true) as r;
create temp table r4 as select pg_temp.parte(4, 'e0000000-0000-0000-0000-000000000004',
  'f0000000-0000-0000-0000-00000000000c', 'DDDDDDDD', false) as r;
create temp table vista as
  select in_parts from public.work_orders_for_device where id = 'e0000000-0000-0000-0000-000000000002';
reset role;

select is((select r->>'status' from r1), 'APPLIED', 'la primera parte se aplica');
select is((select r->>'status' from r2), 'APPLIED', 'la segunda parte, con otra línea, también');
select is((select r->>'reason' from r3), 'QUOTE_LINE_ALREADY_CONVERTED',
  'una parte con una línea que ya está en otra orden queda por revisar');
select is((select count(*)::int from public.work_order_lines where id = 'f0000000-0000-0000-0000-00000000000a'), 1,
  'y esa línea no se duplica: la repetida entra con otro id');
select is((select r->>'reason' from r4), 'QUOTE_ALREADY_CONVERTED',
  'sin "por partes", una cotización ya convertida no se convierte otra vez');
select is((select converted_work_order_id::text from public.quotes where id = '90000000-0000-0000-0000-000000000001'),
  'e0000000-0000-0000-0000-000000000001', 'la cotización conserva su primera orden');
select is((select in_parts from vista), true, 'la tablet sabe que es una parte');

select * from finish();
rollback;
