-- Exportación de los datos del negocio [S5-08, RNF-22]: solo un administrador, sin PIN ni credenciales de tablets, con
-- rastro en la bitácora.
begin;
select plan(16);

-- ---------- Datos ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 'sal-secreta', 1000, 'huella-secreta', 1);
insert into public.customers (id, name, phone, email) values
  ('c0000000-0000-0000-0000-000000000001', 'Cliente de prueba', '5512345678', 'cliente@ejemplo.invalid');
insert into public.counter_sales (id, temp_folio, public_code, customer_id, issued_at, subtotal_cents, tax_cents,
  total_cents, device_id, user_id, op_id) values
  ('e1000000-0000-0000-0000-000000000001', 'T1-0001', 'BBBBBBBB', 'c0000000-0000-0000-0000-000000000001',
   now(), 10000, 1600, 11600, 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', gen_random_uuid());
insert into public.invoice_requests (request_id, counter_sale_id, channel, xml, pdf_base64) values
  ('90000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'SYSTEM', '<cfdi/>', 'UERGLUJBU0U2NA==');

-- ---------- Quién puede exportar ----------
set local role anon;
select throws_ok($$ select public.admin_export_data() $$, '42501', null, 'un anónimo no exporta');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
select throws_ok($$ select public.admin_export_data() $$, '42501', null, 'un cajero con sesión no exporta');
reset role;
select is((select count(*)::int from public.audit_log where action = 'DATA_EXPORTED'), 0,
  'un intento rechazado no deja una exportación en la bitácora');

-- ---------- Lo que entrega a un administrador ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;
create temp table exportacion as select public.admin_export_data() as datos;
grant select on exportacion to authenticated;

select is((select jsonb_typeof(datos -> 'tables') from exportacion), 'object', 'entrega las tablas');
select ok((select datos ? 'generated_at' from exportacion), 'dice cuándo se generó');
select is((select count(*)::int from exportacion, jsonb_object_keys(datos -> 'tables')), 21,
  'entrega las 21 tablas del negocio');
select is((select datos -> 'tables' -> 'customers' -> 0 ->> 'name' from exportacion), 'Cliente de prueba',
  'entrega los clientes con sus datos');
select is((select datos -> 'tables' -> 'counter_sales' -> 0 ->> 'total_cents' from exportacion), '11600',
  'el dinero va en centavos enteros');

-- Lo que NO entrega.
select ok(not ((select datos::text from exportacion) ~ 'sal-secreta|huella-secreta'),
  'ni la sal ni la huella de ningún PIN aparecen en ninguna parte');
select is((select datos -> 'tables' -> 'app_users' -> 0 ? 'pin_hash' from exportacion), false, 'las personas van sin PIN');
select is((select datos -> 'tables' -> 'app_users' -> 0 ->> 'name' from exportacion), 'Ana', 'pero con su nombre y rol');
select is((select datos -> 'tables' -> 'devices' -> 0 ? 'auth_user_id' from exportacion), false,
  'las tablets van sin su cuenta de acceso');
select is((select datos -> 'tables' -> 'invoice_requests' -> 0 ? 'pdf_base64' from exportacion), false,
  'las facturas van sin el PDF en base64');
select is((select datos -> 'tables' -> 'invoice_requests' -> 0 ->> 'xml' from exportacion), '<cfdi/>',
  'pero con su XML');
select ok(not ((select datos -> 'tables' from exportacion) ?| array['operations', 'device_registration_codes',
  'folio_counters', 'portal_attempts', 'error_log']), 'las tablas técnicas no se entregan');

-- ---------- Rastro ----------
reset role;
select is(
  (select count(*)::int from public.audit_log
    where action = 'DATA_EXPORTED' and user_id = '00000000-0000-0000-0000-0000000000a1'
      and (new_value -> 'rows' ->> 'customers')::int = 1),
  1, 'la exportación queda en la bitácora con quién la hizo y cuántos renglones');

select * from finish();
rollback;
