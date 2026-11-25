-- Devolución al cancelar una venta [RF-M4-10, ADR-0044, AJ-06]: el cobro se queda en su turno, el efectivo devuelto
-- sale del turno de quien cancela, un corte cerrado no cambia y las devoluciones no se borran.
begin;
select plan(11);

select has_table('public', 'refunds', 'existen las devoluciones');
select has_view('public', 'refunds_for_device', 'y su vista para la tablet');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Luis', 'ADMIN', true, 's', 1000, 'h', 1);

create function pg_temp.op(p_seq int, p_type text, p_payload jsonb, p_auth uuid default null)
returns jsonb language sql as $$
  select jsonb_build_object('opId', gen_random_uuid(), 'deviceId', 'd0000000-0000-0000-0000-000000000001',
    'seq', p_seq, 'type', p_type, 'schemaVersion', 1, 'userId', 'a0000000-0000-0000-0000-000000000001',
    'authorizedBy', p_auth, 'clientCreatedAt', '2090-06-15T23:30:00Z', 'payload', p_payload);
$$;

create function pg_temp.venta(p_id text, p_folio text, p_codigo text, p_turno text) returns jsonb
language sql as $$
  select jsonb_build_object(
    'id', p_id, 'tempFolio', p_folio, 'publicCode', p_codigo,
    'issuedAt', '2090-06-15T23:40:00Z', 'subtotalCents', 10000, 'taxCents', 1600, 'totalCents', 11600,
    'cashShiftId', p_turno,
    'lines', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'name', 'Chapa', 'chargeUnit', 'PIECE',
      'unitPriceCents', 11600, 'ruleId', 'PIECE', 'quantity', 1,
      'lineTotalCents', 11600, 'baseCents', 10000, 'taxCents', 1600, 'detail', '1 pieza')),
    'payment', jsonb_build_object('groupId', gen_random_uuid(), 'rows', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'method', 'CASH', 'amountCents', 11600,
                         'cashReceivedCents', 11600))));
$$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
-- Ayer: turno 1 con una venta en efectivo, cerrado cuadrado.
select public.receive_operation(pg_temp.op(1, 'OpenCashShift', jsonb_build_object(
  'id', 'c1000000-0000-0000-0000-000000000001', 'openedAt', '2090-06-15T15:00:00Z', 'openingFloatCents', 0)));
select public.receive_operation(pg_temp.op(2, 'CreateCounterSale',
  pg_temp.venta('e1000000-0000-0000-0000-000000000001', 'T1-0001', 'DDDDDDDD', 'c1000000-0000-0000-0000-000000000001')));
select public.receive_operation(pg_temp.op(3, 'CloseCashShift', jsonb_build_object(
  'id', 'c1000000-0000-0000-0000-000000000001', 'closedAt', '2090-06-15T23:50:00Z',
  'countedCashCents', 11600, 'expectedCashCents', 11600)));
-- Hoy: turno 2 con 200.00 de fondo; se cancela la venta de ayer devolviendo el efectivo desde este cajón.
select public.receive_operation(pg_temp.op(4, 'OpenCashShift', jsonb_build_object(
  'id', 'c1000000-0000-0000-0000-000000000002', 'openedAt', '2090-06-16T15:00:00Z', 'openingFloatCents', 20000)));
create temp table r_cancela as
  select public.receive_operation(pg_temp.op(5, 'CancelCounterSale', jsonb_build_object(
    'id', 'e1000000-0000-0000-0000-000000000001', 'reason', 'Devolvió la pieza',
    'refunds', jsonb_build_array(jsonb_build_object('id', 'f9000000-0000-0000-0000-000000000001',
      'method', 'CASH', 'amountCents', 11600, 'cashShiftId', 'c1000000-0000-0000-0000-000000000002'))),
    'a0000000-0000-0000-0000-000000000002')) as r;
-- Otra venta, cancelada devolviendo de menos: queda por revisar.
select public.receive_operation(pg_temp.op(6, 'CreateCounterSale',
  pg_temp.venta('e1000000-0000-0000-0000-000000000002', 'T1-0002', 'EEEEEEEE', 'c1000000-0000-0000-0000-000000000002')));
create temp table r_mal as
  select public.receive_operation(pg_temp.op(7, 'CancelCounterSale', jsonb_build_object(
    'id', 'e1000000-0000-0000-0000-000000000002', 'reason', 'Error',
    'refunds', jsonb_build_array(jsonb_build_object('id', 'f9000000-0000-0000-0000-000000000002',
      'method', 'CASH', 'amountCents', 1000, 'cashShiftId', 'c1000000-0000-0000-0000-000000000002'))),
    'a0000000-0000-0000-0000-000000000002')) as r;
create temp table vista as select * from public.refunds_for_device;
reset role;

select is((select r->>'status' from r_cancela), 'APPLIED', 'la cancelación con su devolución se aplica');
select is((select difference_cents from public.cash_shifts where id = 'c1000000-0000-0000-0000-000000000001'),
  0::bigint, 'el corte de ayer sigue cuadrado: lo cobrado se queda en su turno');
select is(private.shift_cash_collected_cents('c1000000-0000-0000-0000-000000000001'), 11600::bigint,
  'y recalcularlo hoy da lo mismo que al cerrarlo');
-- Hoy: +11 600 de la segunda venta − 11 600 devueltos − 1 000 devueltos.
select is(private.shift_cash_collected_cents('c1000000-0000-0000-0000-000000000002'), -1000::bigint,
  'el efectivo devuelto sale del turno de quien cancela');
select is((select r->>'reason' from r_mal), 'REFUND_MISMATCH', 'si lo devuelto no es lo cobrado queda por revisar');
select is((select count(*)::int from vista), 2, 'las devoluciones llegan a la tablet');
select is((select new_value->>'devueltoEfectivoCentavos' from public.audit_log
            where action = 'COUNTER_SALE_CANCELLED' and entity_id = 'e1000000-0000-0000-0000-000000000001'),
  '11600', 'la devolución queda en la bitácora');
select throws_ok($$ delete from public.refunds $$, '42501', null, 'las devoluciones no se borran');
select throws_ok($$ update public.refunds set amount_cents = 1 $$, '42501', null, 'ni se cambian');

select * from finish();
rollback;
