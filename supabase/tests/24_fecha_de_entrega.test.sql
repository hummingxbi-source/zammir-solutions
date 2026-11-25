-- Fecha estimada de entrega al crear la orden [RF-M3-09, ADR-0044, AJ-03]: se guarda, queda en la bitácora y
-- llega a la tablet; una orden vieja en cola sin fecha se acepta igual.
begin;
select plan(5);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1);
insert into public.customers (id, name, phone) values
  ('c0000000-0000-0000-0000-000000000001', 'Cliente de prueba', '5512345678');

create function pg_temp.op(p_op uuid, p_seq int, p_payload jsonb)
returns jsonb language sql as $$
  select jsonb_build_object('opId', p_op, 'deviceId', 'd0000000-0000-0000-0000-000000000001', 'seq', p_seq,
    'type', 'CreateWorkOrder', 'schemaVersion', 1, 'userId', 'a0000000-0000-0000-0000-000000000001',
    'clientCreatedAt', '2090-06-15T18:00:00Z', 'payload', p_payload);
$$;

create function pg_temp.orden(p_id uuid, p_folio text, p_codigo text, p_fecha text)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'tempFolio', p_folio, 'publicCode', p_codigo,
    'customerId', 'c0000000-0000-0000-0000-000000000001', 'issuedAt', '2090-06-15T18:00:00Z',
    'depositPercentBps', 5000, 'depositRequiredCents', 5800,
    'subtotalCents', 10000, 'taxCents', 1600, 'totalCents', 11600,
    'lines', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'name', 'Vidrio', 'chargeUnit', 'SQUARE_METER',
      'unitPriceCents', 11600, 'ruleId', 'AREA', 'widthMm', 1000, 'heightMm', 1000, 'quantity', 1,
      'lineTotalCents', 11600, 'baseCents', 10000, 'taxCents', 1600, 'detail', '1 m²')))
    || case when p_fecha is null then '{}'::jsonb else jsonb_build_object('estimatedDeliveryDate', p_fecha) end;
$$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;

create temp table r_con_fecha as
  select public.receive_operation(pg_temp.op('10000000-0000-0000-0000-000000000001', 1,
    pg_temp.orden('e0000000-0000-0000-0000-000000000001', 'T1-0001', 'AAAAAAAA', '2090-06-30'))) as r;
create temp table r_sin_fecha as
  select public.receive_operation(pg_temp.op('10000000-0000-0000-0000-000000000002', 2,
    pg_temp.orden('e0000000-0000-0000-0000-000000000002', 'T1-0002', 'BBBBBBBB', null))) as r;
create temp table vista as
  select estimated_delivery_date from public.work_orders_for_device
   where id = 'e0000000-0000-0000-0000-000000000001';
reset role;

select is((select estimated_delivery_date::text from public.work_orders
            where id = 'e0000000-0000-0000-0000-000000000001'),
  '2090-06-30', 'la fecha estimada se guarda al crear la orden');
select is((select new_value->>'fechaEstimadaDeEntrega' from public.audit_log
            where action = 'WORK_ORDER_CREATED' and entity_id = 'e0000000-0000-0000-0000-000000000001'),
  '2090-06-30', 'y queda en la bitácora de la creación');
select is((select estimated_delivery_date::text from vista), '2090-06-30', 'la tablet la recibe');
select is((select r->>'status' from r_sin_fecha), 'APPLIED',
  'una orden vieja en cola, sin fecha, se aplica igual');
select is((select estimated_delivery_date from public.work_orders
            where id = 'e0000000-0000-0000-0000-000000000002'), null,
  'y queda sin fecha, sin inventar una');

select * from finish();
rollback;
