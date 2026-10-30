-- Pruebas del receptor de operaciones [S2-03]: idempotencia, orden, folios, permisos.
begin;
select plan(21);

select has_table('public', 'operations', 'existe la tabla de operaciones');
select has_table('public', 'quotes', 'existe la tabla de cotizaciones');
select has_function('public', 'receive_operation', array['jsonb'], 'existe el receptor');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
-- Datos de apoyo: dos tablets, una persona activa, una desactivada y un cliente
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1'),
  ('d0000000-0000-0000-0000-000000000002', 'Tablet 2', 2, '00000000-0000-0000-0000-0000000000d2');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Beto', 'STAFF', false, 's', 1000, 'h', 1);
insert into public.customers (id, name, phone) values
  ('c0000000-0000-0000-0000-000000000001', 'Cliente de prueba', '5512345678');

create function pg_temp.operacion(
  p_op uuid, p_device uuid, p_seq int, p_code text, p_temp text, p_user uuid, p_type text default 'IssueQuote',
  p_issued text default '2090-06-15T18:00:00Z'
) returns jsonb language sql as $$
  select jsonb_build_object(
    'opId', p_op, 'deviceId', p_device, 'seq', p_seq, 'type', p_type, 'schemaVersion', 1,
    'userId', p_user, 'clientCreatedAt', p_issued,
    'payload', jsonb_build_object(
      'id', gen_random_uuid(), 'tempFolio', p_temp, 'publicCode', p_code,
      'customerId', 'c0000000-0000-0000-0000-000000000001',
      'issuedAt', p_issued, 'validUntil', '2090-06-30', 'conditionsText', 'Condiciones de prueba',
      'subtotalCents', 10000, 'taxCents', 1600, 'totalCents', 11600,
      'lines', jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid(), 'name', 'Vidrio claro 6 mm', 'chargeUnit', 'SQUARE_METER',
        'unitPriceCents', 11600, 'ruleId', 'AREA', 'widthMm', 1000, 'heightMm', 1000, 'quantity', 1,
        'lineTotalCents', 11600, 'baseCents', 10000, 'taxCents', 1600, 'detail', '1 m²'
      ))
    )
  );
$$;

-- ---------- La tablet 1 manda su primera operación ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;

create temp table r1 as
  select public.receive_operation(pg_temp.operacion(
    '10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 1,
    'AAAAAAAA', 'T1-0001', 'a0000000-0000-0000-0000-000000000001')) as r;

select is((select r->>'folio' from r1), 'COT-2090-0001', 'la primera operación recibe el folio COT-2090-0001');
select is((select r->>'status' from r1), 'APPLIED', 'queda aplicada');

-- Reenvío: mismo resultado, sin duplicar ni consumir folio
create temp table r1b as
  select public.receive_operation(pg_temp.operacion(
    '10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 1,
    'AAAAAAAA', 'T1-0001', 'a0000000-0000-0000-0000-000000000001')) as r;
reset role;
select is((select r from r1b), (select r from r1), 'reenviar devuelve exactamente el mismo resultado');
select is((select count(*)::int from public.quotes), 1, 'reenviar no duplica la cotización');
select is((select count(*)::int from public.operations), 1, 'reenviar no duplica la operación');
select is((select last_value from public.folio_counters where doc_type = 'QUOTE' and year = 2090), 1::bigint,
  'reenviar no consume folio');
select is((select count(*)::int from public.quote_lines), 1, 'se guardó la línea');

-- ---------- Orden ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;

select is(
  public.receive_operation(pg_temp.operacion('10000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000001', 3, 'BBBBBBBB', 'T1-0003', 'a0000000-0000-0000-0000-000000000001')),
  '{"ok": false, "code": "OUT_OF_ORDER", "expectedSeq": 2}'::jsonb,
  'un salto de seq responde fuera de orden y dice cuál esperaba'
);

-- Tipo desconocido
select is(
  public.receive_operation(pg_temp.operacion('10000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001', 2, 'CCCCCCCC', 'T1-0002', 'a0000000-0000-0000-0000-000000000001', 'Inventada')),
  '{"ok": false, "code": "UNKNOWN_TYPE"}'::jsonb,
  'un tipo desconocido se rechaza de forma estructural'
);

-- Persona desactivada: se aplica y queda por revisar
create temp table r2 as
  select public.receive_operation(pg_temp.operacion('10000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001', 2, 'CCCCCCCC', 'T1-0002', 'a0000000-0000-0000-0000-000000000002')) as r;
select is((select r->>'status' from r2), 'TO_REVIEW', 'una persona desactivada queda por revisar');
select is((select r->>'reason' from r2), 'USER_INACTIVE', 'con el motivo');
select is((select r->>'folio' from r2), 'COT-2090-0002', 'y aun así recibe su folio: lo ocurrido no se descarta');

-- Código público repetido: no se aplica, queda por revisar y no consume folio
create temp table r3 as
  select public.receive_operation(pg_temp.operacion('10000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000001', 3, 'AAAAAAAA', 'T1-0004', 'a0000000-0000-0000-0000-000000000001')) as r;
select is((select r->>'reason' from r3), 'PUBLIC_CODE_CONFLICT', 'un código público repetido queda por revisar');
reset role;
select is((select last_value from public.folio_counters where doc_type = 'QUOTE' and year = 2090), 2::bigint,
  'y no consume folio');

-- ---------- Otra tablet: sus operaciones llevan su propio orden y el folio sigue ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
select is(
  (public.receive_operation(pg_temp.operacion('20000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002', 1, 'DDDDDDDD', 'T2-0001', 'a0000000-0000-0000-0000-000000000001')))->>'folio',
  'COT-2090-0003', 'la otra tablet recibe el siguiente folio (el orden es el de llegada)'
);

-- Una tablet no puede mandar operaciones de otra
select is(
  public.receive_operation(pg_temp.operacion('20000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001', 4, 'EEEEEEEE', 'T1-0005', 'a0000000-0000-0000-0000-000000000001')),
  '{"ok": false, "code": "DEVICE_REVOKED"}'::jsonb,
  'una tablet no puede mandar operaciones a nombre de otra'
);

-- ---------- Permisos ----------
select is((select count(*)::int from public.operations), 0, 'la tablet no ve operaciones (RLS)');
select throws_ok(
  $$ insert into public.quotes (id) values (gen_random_uuid()) $$,
  '42501', null, 'la tablet no escribe cotizaciones directamente'
);

select * from finish();
rollback;
