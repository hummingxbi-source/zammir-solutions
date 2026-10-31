-- Turnos de caja y corte [S3-16 a S3-19]: el servidor recalcula el efectivo esperado, un corte cerrado no
-- se edita sin un administrador y las reaperturas dejan rastro.
begin;
select plan(14);

select has_table('public', 'cash_shifts', 'existen los turnos de caja');
select has_table('public', 'cash_shift_reopenings', 'existen las reaperturas');
select has_view('public', 'cash_shifts_for_device', 'existe la vista de turnos para la tablet');

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
    'clientCreatedAt', '2090-06-15T23:30:00Z', 'payload', p_payload);
$$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;

create temp table r_abre as
  select public.receive_operation(pg_temp.op('10000000-0000-0000-0000-000000000001', 1, 'OpenCashShift', jsonb_build_object(
    'id', 'c1000000-0000-0000-0000-000000000001', 'openedAt', '2090-06-15T23:30:00Z', 'openingFloatCents', 10000))) as r;
-- Una venta de 116.00 en efectivo ligada al turno.
create temp table r_venta as
  select public.receive_operation(pg_temp.op('10000000-0000-0000-0000-000000000002', 2, 'CreateCounterSale', jsonb_build_object(
    'id', 'e1000000-0000-0000-0000-000000000001', 'tempFolio', 'T1-0001', 'publicCode', 'DDDDDDDD',
    'issuedAt', '2090-06-15T23:40:00Z', 'subtotalCents', 10000, 'taxCents', 1600, 'totalCents', 11600,
    'cashShiftId', 'c1000000-0000-0000-0000-000000000001',
    'lines', jsonb_build_array(jsonb_build_object(
      'id', 'f1000000-0000-0000-0000-000000000001', 'name', 'Chapa', 'chargeUnit', 'PIECE',
      'unitPriceCents', 11600, 'ruleId', 'PIECE', 'quantity', 1,
      'lineTotalCents', 11600, 'baseCents', 10000, 'taxCents', 1600, 'detail', '1 pieza')),
    'payment', jsonb_build_object('groupId', 'b2000000-0000-0000-0000-000000000001', 'rows', jsonb_build_array(
      jsonb_build_object('id', 'b3000000-0000-0000-0000-000000000001', 'method', 'CASH', 'amountCents', 11600, 'cashReceivedCents', 12000)))))) as r;
-- La tablet esperaba 21 600 (10 000 de fondo + 11 600); el servidor llega al mismo número.
create temp table r_cierra as
  select public.receive_operation(pg_temp.op('10000000-0000-0000-0000-000000000003', 3, 'CloseCashShift', jsonb_build_object(
    'id', 'c1000000-0000-0000-0000-000000000001', 'closedAt', '2090-06-16T00:10:00Z',
    'countedCashCents', 21500, 'expectedCashCents', 21600, 'pendingAtClose', 2))) as r;
reset role;

select is((select r->>'status' from r_abre), 'APPLIED', 'abrir el turno se aplica');
select is((select business_day::text from public.cash_shifts where id = 'c1000000-0000-0000-0000-000000000001'),
  '2090-06-15', 'el turno pertenece al día en que se abrió, en hora de México');
select is((select r->>'status' from r_cierra), 'APPLIED', 'el corte coincide con el recálculo y se aplica');
select is((select server_expected_cash_cents from public.cash_shifts where id = 'c1000000-0000-0000-0000-000000000001'),
  21600::bigint, 'el servidor recalcula: fondo + efectivo cobrado');
select is((select difference_cents from public.cash_shifts where id = 'c1000000-0000-0000-0000-000000000001'),
  -100::bigint, 'la diferencia es contado − esperado (faltante)');
select is((select pending_at_close from public.cash_shifts where id = 'c1000000-0000-0000-0000-000000000001'),
  2, 'queda anotado cuántas operaciones faltaban por enviar');
select is((select cash_shift_id::text from public.payments where id = 'b3000000-0000-0000-0000-000000000001'),
  'c1000000-0000-0000-0000-000000000001', 'el cobro quedó ligado al turno');

-- Un cierre que no cuadra con el servidor queda por revisar.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
create temp table r_abre2 as
  select public.receive_operation(pg_temp.op('10000000-0000-0000-0000-000000000004', 4, 'OpenCashShift', jsonb_build_object(
    'id', 'c1000000-0000-0000-0000-000000000002', 'openedAt', '2090-06-16T15:00:00Z', 'openingFloatCents', 0),
    'a0000000-0000-0000-0000-000000000002')) as r;
create temp table r_cierra2 as
  select public.receive_operation(pg_temp.op('10000000-0000-0000-0000-000000000005', 5, 'CloseCashShift', jsonb_build_object(
    'id', 'c1000000-0000-0000-0000-000000000002', 'closedAt', '2090-06-16T16:00:00Z',
    'countedCashCents', 500, 'expectedCashCents', 999), 'a0000000-0000-0000-0000-000000000002')) as r;
-- Reabrir sin administrador: se aplica pero queda por revisar.
create temp table r_reabre as
  select public.receive_operation(pg_temp.op('10000000-0000-0000-0000-000000000006', 6, 'ReopenCashShift', jsonb_build_object(
    'id', 'c1000000-0000-0000-0000-000000000001', 'reason', 'Faltó un cobro'))) as r;
reset role;

select is((select r->>'reason' from r_cierra2), 'CASH_SUMMARY_MISMATCH', 'si la tablet y el servidor no coinciden, el corte queda por revisar');
select is((select r->>'reason' from r_reabre), 'REOPEN_WITHOUT_AUTHORIZATION', 'reabrir sin un administrador queda por revisar');
select is((select count(*)::int from public.cash_shift_reopenings), 1, 'la reapertura deja rastro');
select throws_ok($$ delete from public.cash_shift_reopenings $$, '42501', null, 'las reaperturas no se borran');

select * from finish();
rollback;
