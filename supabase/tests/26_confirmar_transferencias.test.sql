-- Confirmar que llegó una transferencia [RF-M4-11, ADR-0044, AJ-05]: lo hace un administrador, queda quién y
-- cuándo, no se duplica, no se borra y llega a la tablet. Nada se rechaza: lo que no se puede confirmar queda
-- por revisar.
begin;
select plan(13);

select has_table('public', 'payment_confirmations', 'existen las confirmaciones de transferencias');
select has_view('public', 'payment_confirmations_for_device', 'y su vista para la tablet');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Luis', 'ADMIN', true, 's', 1000, 'h', 1);

create function pg_temp.op(p_seq int, p_type text, p_payload jsonb,
  p_user uuid default 'a0000000-0000-0000-0000-000000000002', p_auth uuid default null)
returns jsonb language sql as $$
  select jsonb_build_object('opId', gen_random_uuid(), 'deviceId', 'd0000000-0000-0000-0000-000000000001',
    'seq', p_seq, 'type', p_type, 'schemaVersion', 1, 'userId', p_user, 'authorizedBy', p_auth,
    'clientCreatedAt', '2090-06-15T23:30:00Z', 'payload', p_payload);
$$;

-- Una venta pagada mitad por transferencia y mitad en efectivo.
create function pg_temp.venta() returns jsonb language sql as $$
  select jsonb_build_object(
    'id', 'e1000000-0000-0000-0000-000000000001', 'tempFolio', 'T1-0001', 'publicCode', 'DDDDDDDD',
    'issuedAt', '2090-06-15T23:40:00Z', 'subtotalCents', 10000, 'taxCents', 1600, 'totalCents', 11600,
    'lines', jsonb_build_array(jsonb_build_object(
      'id', 'f1000000-0000-0000-0000-000000000001', 'name', 'Chapa', 'chargeUnit', 'PIECE',
      'unitPriceCents', 11600, 'ruleId', 'PIECE', 'quantity', 1,
      'lineTotalCents', 11600, 'baseCents', 10000, 'taxCents', 1600, 'detail', '1 pieza')),
    'payment', jsonb_build_object('groupId', 'b2000000-0000-0000-0000-000000000001', 'rows', jsonb_build_array(
      jsonb_build_object('id', 'b3000000-0000-0000-0000-000000000001', 'method', 'TRANSFER', 'amountCents', 6000,
                         'reference', 'SPEI 123'),
      jsonb_build_object('id', 'b3000000-0000-0000-0000-000000000002', 'method', 'CASH', 'amountCents', 5600,
                         'cashReceivedCents', 5600))));
$$;

create function pg_temp.confirmar(p_pago text) returns jsonb language sql as $$
  select jsonb_build_object('paymentId', p_pago, 'confirmedAt', '2090-06-16T15:00:00Z');
$$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
select public.receive_operation(pg_temp.op(1, 'CreateCounterSale', pg_temp.venta()));
create temp table r_ok as
  select public.receive_operation(pg_temp.op(2, 'ConfirmTransfer',
    pg_temp.confirmar('b3000000-0000-0000-0000-000000000001'))) as r;
create temp table r_otra_vez as
  select public.receive_operation(pg_temp.op(3, 'ConfirmTransfer',
    pg_temp.confirmar('b3000000-0000-0000-0000-000000000001'))) as r;
create temp table r_efectivo as
  select public.receive_operation(pg_temp.op(4, 'ConfirmTransfer',
    pg_temp.confirmar('b3000000-0000-0000-0000-000000000002'))) as r;
create temp table r_no_existe as
  select public.receive_operation(pg_temp.op(5, 'ConfirmTransfer',
    pg_temp.confirmar('b3000000-0000-0000-0000-000000000099'))) as r;
create temp table vista as select * from public.payment_confirmations_for_device;
select throws_ok($$ insert into public.payment_confirmations (payment_id, confirmed_by, confirmed_at, op_id)
  values ('b3000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', now(), gen_random_uuid()) $$,
  '42501', null, 'la tablet no escribe directo en las confirmaciones');
reset role;

select is((select r->>'status' from r_ok), 'APPLIED', 'un administrador confirma la transferencia');
select is((select confirmed_by::text from public.payment_confirmations
            where payment_id = 'b3000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000002', 'queda quién confirmó');
select is((select confirmed_at from public.payment_confirmations
            where payment_id = 'b3000000-0000-0000-0000-000000000001'),
  '2090-06-16T15:00:00Z'::timestamptz, 'y cuándo');
select is((select r->>'reason' from r_otra_vez), 'ALREADY_CONFIRMED', 'confirmar dos veces queda por revisar');
select is((select count(*)::int from public.payment_confirmations), 1, 'y no duplica');
select is((select r->>'reason' from r_efectivo), 'NOT_A_TRANSFER', 'un pago en efectivo no se confirma');
select is((select r->>'reason' from r_no_existe), 'PAYMENT_NOT_FOUND',
  'un pago que no existe queda por revisar, sin rechazar la operación');
select is((select count(*)::int from vista), 1, 'la confirmación llega a la tablet');
select is((select count(*)::int from public.audit_log where action = 'TRANSFER_CONFIRMED'), 1,
  'queda en la bitácora');
select throws_ok($$ delete from public.payment_confirmations $$, '42501', null, 'las confirmaciones no se borran');

select * from finish();
rollback;
