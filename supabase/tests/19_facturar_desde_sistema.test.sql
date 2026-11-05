-- Facturar desde el sistema [S4-16, RN-24, RN-25, ADR-0032]: lectura por identificador solo para el servidor y
-- lista de lo facturable solo para administradores.
begin;
select plan(17);

select has_function('public', 'system_find_invoice_source', array['text', 'uuid'], 'existe la lectura por identificador');
select has_function('public', 'admin_invoice_candidates', 'existe la lista de lo facturable');

-- ---------- Datos: una venta liquidada, una con saldo y una orden cancelada ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1);
insert into public.customers (id, name, phone, fiscal_rfc, fiscal_legal_name, fiscal_zip, fiscal_regime, fiscal_cfdi_use) values
  ('c0000000-0000-0000-0000-000000000001', 'Cliente con datos fiscales', '5512345678',
   'XAXX010101000', 'CLIENTE FISCAL', '55900', '616', 'S01'),
  ('c0000000-0000-0000-0000-000000000002', 'Cliente sin datos fiscales', '5512345679', null, null, null, null, null);

insert into public.counter_sales (id, temp_folio, public_code, customer_id, issued_at, subtotal_cents, tax_cents,
  total_cents, device_id, user_id, op_id) values
  ('e1000000-0000-0000-0000-000000000001', 'T1-0001', 'BBBBBBBB', 'c0000000-0000-0000-0000-000000000001',
   '2090-06-15T18:00:00Z', 10000, 1600, 11600, 'd0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001', gen_random_uuid()),
  ('e1000000-0000-0000-0000-000000000002', 'T1-0002', 'CCCCCCCC', null,
   '2090-06-16T18:00:00Z', 10000, 1600, 11600, 'd0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001', gen_random_uuid());
insert into public.payments (id, group_id, counter_sale_id, kind, method, amount_cents, user_id, device_id, paid_at, op_id)
values ('b3000000-0000-0000-0000-000000000001', gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001',
  'SALE', 'TRANSFER', 11600, 'a0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001', '2090-06-15T18:00:00Z', gen_random_uuid()),
 -- La segunda venta solo se pagó a medias: todavía no se puede facturar.
 ('b3000000-0000-0000-0000-000000000002', gen_random_uuid(), 'e1000000-0000-0000-0000-000000000002',
  'SALE', 'TRANSFER', 5000, 'a0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001', '2090-06-16T18:00:00Z', gen_random_uuid());

-- ---------- La lectura por identificador solo es del servidor ----------
set local role anon;
select throws_ok($$ select public.system_find_invoice_source('COUNTER_SALE', 'e1000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'un anónimo no la usa');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;
select throws_ok($$ select public.system_find_invoice_source('COUNTER_SALE', 'e1000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'ni siquiera un administrador desde el navegador: es solo del servidor');
reset role;

set local role service_role;
select is((select public.system_find_invoice_source('COUNTER_SALE', 'e1000000-0000-0000-0000-000000000001') ->> 'folio'),
  'T1-0001', 'el servidor lee la venta por su identificador');
select is((select (public.system_find_invoice_source('COUNTER_SALE', 'e1000000-0000-0000-0000-000000000001') ->> 'paidCents')::int),
  11600, 'con lo pagado');
select is((select public.system_find_invoice_source('COUNTER_SALE', gen_random_uuid())), null,
  'una venta que no existe devuelve nada');
select is((select public.system_find_invoice_source('QUOTE', 'e1000000-0000-0000-0000-000000000001')), null,
  'un tipo que no es venta ni orden también');
select is((select public.portal_find_document('T1-0001', 'BBBBBBBB') ->> 'folio'), 'T1-0001',
  'el portal sigue encontrando el documento con su folio y código');
select is((select public.portal_find_document('T1-0001', 'CCCCCCCC')), null,
  'y con el código de otro documento sigue sin encontrar nada');
reset role;

-- ---------- Lo facturable lo ve solo un administrador ----------
set local role anon;
select throws_ok($$ select * from public.admin_invoice_candidates() $$, '42501', null, 'un anónimo no ve lo facturable');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
select throws_ok($$ select * from public.admin_invoice_candidates() $$, '42501', null, 'un cajero tampoco');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;
select is((select count(*)::int from public.admin_invoice_candidates()), 1,
  'el administrador ve solo lo liquidado: la venta con saldo no aparece');
select is((select folio from public.admin_invoice_candidates()), 'T1-0001', 'y es la venta liquidada');
select is((select customer_fiscal ->> 'rfc' from public.admin_invoice_candidates()), 'XAXX010101000',
  'con los datos fiscales del cliente para precargar el receptor [RF-M10-05]');
reset role;

-- Una factura vigente la saca de la lista; una fallida no.
insert into public.invoice_requests (request_id, counter_sale_id, channel)
values ('90000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'SYSTEM');
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;
select is((select count(*)::int from public.admin_invoice_candidates()), 0,
  'con una factura en proceso ya no figura como facturable');
reset role;
update public.invoice_requests set status = 'FAILED' where request_id = '90000000-0000-0000-0000-000000000001';
set local role authenticated;
select is((select count(*)::int from public.admin_invoice_candidates()), 1,
  'si la factura falló, vuelve a figurar');
reset role;

select * from finish();
rollback;
