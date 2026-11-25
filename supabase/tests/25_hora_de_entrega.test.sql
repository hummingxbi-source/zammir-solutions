-- Hora real de la entrega [ADR-0044, AJ-04]: se guarda la de la tablet (una entrega sin internet no queda con
-- el día del envío), limitada a no ser anterior a la orden ni posterior a la hora del servidor. La garantía
-- empieza ese día.
begin;
select plan(6);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1);
insert into public.customers (id, name, phone) values
  ('c0000000-0000-0000-0000-000000000001', 'Cliente de prueba', '5512345678');

create temp table instantes as select now() as ahora;
grant select on instantes to authenticated;

create function pg_temp.op(p_seq int, p_type text, p_payload jsonb)
returns jsonb language sql as $$
  select jsonb_build_object('opId', gen_random_uuid(), 'deviceId', 'd0000000-0000-0000-0000-000000000001',
    'seq', p_seq, 'type', p_type, 'schemaVersion', 1, 'userId', 'a0000000-0000-0000-0000-000000000001',
    'clientCreatedAt', now(), 'payload', p_payload);
$$;

-- Crea, avanza dos veces y entrega una orden hecha hace 10 días; `p_entrega` es la hora que manda la tablet.
create function pg_temp.entregar(p_n int, p_entrega timestamptz)
returns jsonb language plpgsql as $$
declare
  v_id uuid := ('e0000000-0000-0000-0000-00000000000' || p_n::text)::uuid;
  v_base int := (p_n - 1) * 4;
begin
  perform public.receive_operation(pg_temp.op(v_base + 1, 'CreateWorkOrder', jsonb_build_object(
    'id', v_id, 'tempFolio', 'T1-000' || p_n::text, 'publicCode', repeat(chr(64 + p_n), 8),
    'customerId', 'c0000000-0000-0000-0000-000000000001',
    'issuedAt', (select ahora from instantes) - interval '10 days',
    'depositPercentBps', 0, 'depositRequiredCents', 0,
    'subtotalCents', 10000, 'taxCents', 1600, 'totalCents', 11600,
    'lines', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'name', 'Vidrio', 'chargeUnit', 'PIECE', 'unitPriceCents', 11600,
      'ruleId', 'PIECE', 'quantity', 1, 'lineTotalCents', 11600, 'baseCents', 10000, 'taxCents', 1600,
      'detail', '1 pieza')))));
  perform public.receive_operation(pg_temp.op(v_base + 2, 'AdvanceWorkOrder',
    jsonb_build_object('id', v_id, 'to', 'IN_PROCESS')));
  perform public.receive_operation(pg_temp.op(v_base + 3, 'AdvanceWorkOrder',
    jsonb_build_object('id', v_id, 'to', 'READY')));
  return public.receive_operation(pg_temp.op(v_base + 4, 'DeliverWorkOrder',
    jsonb_build_object('id', v_id) ||
    case when p_entrega is null then '{}'::jsonb else jsonb_build_object('deliveredAt', p_entrega) end));
end;
$$;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
select pg_temp.entregar(1, (select ahora from instantes) - interval '2 days');
select pg_temp.entregar(2, (select ahora from instantes) + interval '3 days');
select pg_temp.entregar(3, (select ahora from instantes) - interval '30 days');
select pg_temp.entregar(4, null);
reset role;

select is((select delivered_at from public.work_orders where id = 'e0000000-0000-0000-0000-000000000001'),
  (select ahora from instantes) - interval '2 days',
  'una entrega hecha sin internet conserva la hora de la tablet');
select is((select starts_on from public.warranties where work_order_id = 'e0000000-0000-0000-0000-000000000001'),
  (((select ahora from instantes) - interval '2 days') at time zone 'America/Mexico_City')::date,
  'la garantía empieza el día real de la entrega');
select ok((select delivered_at from public.work_orders where id = 'e0000000-0000-0000-0000-000000000002')
            <= now() + interval '5 minutes',
  'una hora de la tablet en el futuro se limita a la hora del servidor');
select is((select delivered_at from public.work_orders where id = 'e0000000-0000-0000-0000-000000000003'),
  (select issued_at from public.work_orders where id = 'e0000000-0000-0000-0000-000000000003'),
  'una hora anterior a la orden se limita a la creación de la orden');
select is((select (new_value->>'horaAjustada')::boolean from public.audit_log
            where action = 'WORK_ORDER_DELIVERED' and entity_id = 'e0000000-0000-0000-0000-000000000003'),
  true, 'el ajuste de la hora queda en la bitácora');
select ok((select delivered_at from public.work_orders where id = 'e0000000-0000-0000-0000-000000000004')
            between (select ahora from instantes) - interval '1 minute' and now() + interval '1 minute',
  'una entrega vieja en cola, sin hora, usa la del servidor');

select * from finish();
rollback;
