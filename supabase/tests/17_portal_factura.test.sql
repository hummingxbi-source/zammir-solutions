-- Portal público de autofacturación [S4-18, RF-M10-09 a RF-M10-11, RN-24 a RN-26, ADR-0030]:
-- solo el servidor lo lee, no revela nada con datos que no cuadran y limita los intentos fallidos.
begin;
select plan(23);

select has_table('public', 'invoice_requests', 'existe la tabla de facturas pedidas');
select has_table('public', 'portal_attempts', 'existe la tabla de intentos del portal');
select ok((select relrowsecurity from pg_class where oid = 'public.invoice_requests'::regclass),
  'las facturas pedidas tienen RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.portal_attempts'::regclass),
  'los intentos tienen RLS');

-- ---------- Datos: una venta cobrada por la tablet y una orden con anticipo ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1);
insert into public.customers (id, name, phone) values
  ('c0000000-0000-0000-0000-000000000001', 'Cliente de prueba', '5512345678');

create function pg_temp.op(p_op uuid, p_seq int, p_type text, p_payload jsonb)
returns jsonb language sql as $$
  select jsonb_build_object('opId', p_op, 'deviceId', 'd0000000-0000-0000-0000-000000000001', 'seq', p_seq,
    'type', p_type, 'schemaVersion', 1, 'userId', 'a0000000-0000-0000-0000-000000000001', 'authorizedBy', null,
    'clientCreatedAt', '2090-06-15T18:00:00Z', 'payload', p_payload);
$$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
select public.receive_operation(pg_temp.op('10000000-0000-0000-0000-000000000001', 1, 'CreateCounterSale', jsonb_build_object(
  'id', 'e1000000-0000-0000-0000-000000000001', 'tempFolio', 'T1-0001', 'publicCode', 'BBBBBBBB',
  'issuedAt', '2090-06-15T18:00:00Z', 'subtotalCents', 10000, 'taxCents', 1600, 'totalCents', 11600,
  'lines', jsonb_build_array(jsonb_build_object(
    'id', 'f1000000-0000-0000-0000-000000000001', 'name', 'Chapa', 'chargeUnit', 'PIECE',
    'unitPriceCents', 11600, 'ruleId', 'PIECE', 'quantity', 1,
    'lineTotalCents', 11600, 'baseCents', 10000, 'taxCents', 1600, 'detail', '1 pieza')),
  'payment', jsonb_build_object('groupId', 'b2000000-0000-0000-0000-000000000001', 'rows', jsonb_build_array(
    jsonb_build_object('id', 'b3000000-0000-0000-0000-000000000001', 'method', 'CASH', 'amountCents', 11600,
      'cashReceivedCents', 11600))))));
reset role;

-- Una orden de $1,000 con $300 pagados: todavía tiene saldo.
insert into public.work_orders (id, temp_folio, public_code, customer_id, issued_at, subtotal_cents, tax_cents,
  total_cents, deposit_percent_bps, deposit_required_cents, device_id, user_id, op_id)
values ('e2000000-0000-0000-0000-000000000001', 'T1-0002', 'CCCCCCCC', 'c0000000-0000-0000-0000-000000000001',
  '2090-06-16T18:00:00Z', 86207, 13793, 100000, 5000, 50000, 'd0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001', gen_random_uuid());
insert into public.payments (id, group_id, work_order_id, kind, method, amount_cents, cash_received_cents, change_cents, user_id, device_id, paid_at, op_id)
values ('b3000000-0000-0000-0000-000000000010', gen_random_uuid(), 'e2000000-0000-0000-0000-000000000001',
  'DEPOSIT', 'CASH', 30000, 30000, 0, 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
  '2090-06-16T19:00:00Z', gen_random_uuid());

-- ---------- Nadie más que el servidor ejecuta las funciones ----------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select public.portal_find_document('T1-0001', 'BBBBBBBB') $$, '42501', null,
  'un anónimo no llama a la búsqueda del portal');
select throws_ok($$ select public.portal_record_failure('0123456789abcdef', 'fedcba9876543210') $$, '42501', null,
  'ni registra intentos');
select throws_ok($$ select * from public.portal_attempts $$, '42501', null, 'ni lee los intentos');
select throws_ok($$ select * from public.invoice_requests $$, '42501', null, 'ni las facturas pedidas');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
select throws_ok($$ select public.portal_find_document('T1-0001', 'BBBBBBBB') $$, '42501', null,
  'una tablet tampoco');
reset role;

-- ---------- El servidor encuentra el documento solo si folio y código cuadran ----------
set local role service_role;
select is((select public.portal_find_document('T1-0001', 'BBBBBBBB') ->> 'type'), 'COUNTER_SALE',
  'con el folio provisional y el código, encuentra la venta');
select is((select public.portal_find_document('V-2090-0001', 'BBBBBBBB') ->> 'type'), 'COUNTER_SALE',
  'con el folio definitivo también');
select is((select public.portal_find_document('V-2090-0001', 'ZZZZZZZZ')), null,
  'con un código que no existe no devuelve nada');
select is((select public.portal_find_document('V-2090-0099', 'BBBBBBBB')), null,
  'con el código de otro documento y un folio que no es suyo tampoco');
select is((select (public.portal_find_document('V-2090-0001', 'BBBBBBBB') ->> 'paidCents')::bigint), 11600::bigint,
  'trae lo pagado');
select is((select jsonb_array_length(public.portal_find_document('V-2090-0001', 'BBBBBBBB') -> 'lines')), 1,
  'y sus conceptos, sin datos personales');
select is((select (public.portal_find_document('T1-0002', 'CCCCCCCC') ->> 'paidCents')::bigint), 30000::bigint,
  'una orden trae lo pagado, menos que el total');
select is((select public.portal_find_document('T1-0002', 'CCCCCCCC') -> 'settledAt'), 'null'::jsonb,
  'y no está liquidada: sin fecha de liquidación');
select is((select (public.portal_find_document('V-2090-0001', 'BBBBBBBB') ->> 'invoiced')::boolean), false,
  'una venta sin factura no figura como facturada');

-- ---------- Una operación, una factura vigente [RN-24] ----------
insert into public.invoice_requests (request_id, counter_sale_id, channel)
values ('90000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'PORTAL');
select is((select (public.portal_find_document('V-2090-0001', 'BBBBBBBB') ->> 'invoiced')::boolean), true,
  'con una factura en proceso ya figura como facturada');
select throws_ok(
  $$ insert into public.invoice_requests (request_id, counter_sale_id, channel)
     values ('90000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'SYSTEM') $$,
  '23505', null, 'no se acepta una segunda factura vigente para la misma venta');
update public.invoice_requests set status = 'FAILED' where request_id = '90000000-0000-0000-0000-000000000001';
select lives_ok(
  $$ insert into public.invoice_requests (request_id, counter_sale_id, channel)
     values ('90000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 'SYSTEM') $$,
  'si la primera falló, se puede pedir otra');

-- ---------- Los fallos se cuentan por huella de IP y de folio ----------
select public.portal_record_failure('aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb');
select public.portal_record_failure('aaaaaaaaaaaaaaaa', 'cccccccccccccccc');
select is((select row(ip_failures, folio_failures)::text from public.portal_failure_counts('aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb', 900)),
  '(2,1)', 'dos fallos de la misma IP y uno de ese folio');
select is((select ip_failures from public.portal_failure_counts('aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb', 0)), 0,
  'con una ventana de cero segundos no hay fallos recientes');
reset role;

select * from finish();
rollback;
