-- Reintentos, cancelación de facturas y timbres [S4-20, S4-21, S4-22, RN-24, RN-18, RN-19]: lo que toca al PAC es del
-- servidor, cancelar deja rastro y lo que ve el administrador no lo ve nadie más.
begin;
select plan(31);

-- ---------- Datos: un cliente con dos ventas y una orden ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1);
insert into public.customers (id, name, phone) values
  ('c0000000-0000-0000-0000-000000000001', 'Cliente de prueba', '5512345678'),
  ('c0000000-0000-0000-0000-000000000002', 'Otro cliente', '5512345679');
insert into public.counter_sales (id, temp_folio, public_code, customer_id, issued_at, subtotal_cents, tax_cents,
  total_cents, device_id, user_id, op_id) values
  ('e1000000-0000-0000-0000-000000000001', 'T1-0001', 'BBBBBBBB', 'c0000000-0000-0000-0000-000000000001',
   now(), 10000, 1600, 11600, 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', gen_random_uuid()),
  ('e1000000-0000-0000-0000-000000000002', 'T1-0002', 'CCCCCCCC', 'c0000000-0000-0000-0000-000000000001',
   now(), 10000, 1600, 11600, 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', gen_random_uuid()),
  ('e1000000-0000-0000-0000-000000000003', 'T1-0003', 'DDDDDDDD', 'c0000000-0000-0000-0000-000000000002',
   now(), 10000, 1600, 11600, 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', gen_random_uuid());

-- ---------- Lo del PAC es solo del servidor ----------
set local role anon;
select throws_ok($$ select * from public.invoice_pending_retries(0, 5, 10) $$, '42501', null, 'un anónimo no lista reintentos');
select throws_ok($$ select public.invoice_record_attempt(gen_random_uuid(), 'x') $$, '42501', null, 'ni anota intentos');
select throws_ok($$ select * from public.invoice_find_by_folio('F-2026-0001') $$, '42501', null, 'ni busca facturas por folio');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;
select throws_ok($$ select public.invoice_mark_cancelled(gen_random_uuid(), '02', null, gen_random_uuid(), false) $$,
  '42501', null, 'ni un administrador desde el navegador cancela: es solo del servidor');
reset role;

set local role service_role;

-- ---------- La solicitud guarda lo que se mandó al PAC y se reintenta ----------
select is((select public.portal_invoice_begin('90000000-0000-0000-0000-000000000001', 'COUNTER_SALE',
  'e1000000-0000-0000-0000-000000000001', 'PORTAL', '{"recipient":{"rfc":"XAXX010101000"}}'::jsonb) ->> 'kind'),
  'STARTED', 'la solicitud se abre guardando lo que se mandó');
select is((select request_snapshot -> 'recipient' ->> 'rfc' from public.invoice_request_get('90000000-0000-0000-0000-000000000001')),
  'XAXX010101000', 'y se puede leer para reintentarla');
select is((select count(*)::int from public.invoice_pending_retries(0, 5, 10)), 1, 'sin intentos previos ya toca reintentarla');
select public.invoice_record_attempt('90000000-0000-0000-0000-000000000001', 'TIMEOUT');
select is((select attempts from public.invoice_request_get('90000000-0000-0000-0000-000000000001')), 1,
  'cada intento que no terminó se cuenta');
select is((select count(*)::int from public.invoice_pending_retries(3600, 5, 10)), 0,
  'si el último intento fue hace poco, todavía no toca');
select is((select count(*)::int from public.invoice_pending_retries(0, 1, 10)), 0,
  'y con el tope de intentos alcanzado ya no se reintenta sola');
select is((select count(*)::int from public.invoice_pending_retries(0, 5, 10)), 1, 'si no, sigue pendiente');
select public.portal_invoice_begin('90000000-0000-0000-0000-000000000009', 'COUNTER_SALE',
  'e1000000-0000-0000-0000-000000000003', 'PORTAL', null);
select is((select count(*)::int from public.invoice_pending_retries(0, 5, 10)), 1,
  'una solicitud sin lo que se mandó (anterior a este cambio) no se reintenta');

-- ---------- Timbrar y cancelar ----------
select public.portal_invoice_mark_stamped('90000000-0000-0000-0000-000000000001', 'UUID-1', now(),
  '{"rfc":"XAXX010101000"}', '01', '<xml/>', 'cGRm');
select is((select count(*)::int from public.invoice_pending_retries(0, 5, 10)), 0, 'una factura ya timbrada no se reintenta');
select is((select invoice_uuid from public.invoice_find_by_folio((select invoice_folio from public.invoice_requests
  where request_id = '90000000-0000-0000-0000-000000000001'))), 'UUID-1', 'se encuentra por su folio');

select throws_ok($$ select public.invoice_mark_cancelled('90000000-0000-0000-0000-000000000009', '02', null,
  '00000000-0000-0000-0000-0000000000a1', false) $$, 'P0002', null, 'solo se cancela lo que está timbrado');

select public.invoice_mark_cancelled('90000000-0000-0000-0000-000000000001', '01', 'UUID-NUEVO',
  '00000000-0000-0000-0000-0000000000a1', true);
select is((select status from public.invoice_requests where request_id = '90000000-0000-0000-0000-000000000001'),
  'STAMPED', 'si el receptor debe aceptar la cancelación, sigue vigente');
select is((select cancel_motive || '|' || cancel_substitute_uuid from public.invoice_requests
  where request_id = '90000000-0000-0000-0000-000000000001'), '01|UUID-NUEVO', 'pero queda el motivo y la sustituta');
select is((select count(*)::int from public.audit_log where action = 'INVOICE_CANCELLATION_REQUESTED'), 1,
  'y su solicitud deja rastro en la bitácora');

select public.invoice_mark_cancelled('90000000-0000-0000-0000-000000000001', '01', 'UUID-NUEVO',
  '00000000-0000-0000-0000-0000000000a1', false);
select is((select status from public.invoice_requests where request_id = '90000000-0000-0000-0000-000000000001'),
  'CANCELLED', 'al cancelarse queda cancelada y no se borra [RN-18]');
select is((select cancelled_by::text from public.invoice_requests where request_id = '90000000-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-0000000000a1', 'con quién la canceló');
select is((select new_value ->> 'motivo' from public.audit_log where action = 'INVOICE_CANCELLED'), '01',
  'la bitácora guarda el motivo del SAT');
select is((select user_id::text from public.audit_log where action = 'INVOICE_CANCELLED'),
  '00000000-0000-0000-0000-0000000000a1', 'y quién la canceló [RN-19]');
select is((select public.portal_invoice_begin('90000000-0000-0000-0000-000000000002', 'COUNTER_SALE',
  'e1000000-0000-0000-0000-000000000001', 'SYSTEM', null) ->> 'kind'), 'STARTED',
  'cancelada la factura, la venta se puede volver a facturar');

-- Otra factura timbrada para contar timbres.
select public.portal_invoice_begin('90000000-0000-0000-0000-000000000003', 'COUNTER_SALE',
  'e1000000-0000-0000-0000-000000000002', 'PORTAL', null);
select public.portal_invoice_mark_stamped('90000000-0000-0000-0000-000000000003', 'UUID-3', now(), '{}', '03', '<xml/>', 'cGRm');
reset role;

-- ---------- Lo que ve el administrador ----------
set local role anon;
select throws_ok($$ select * from public.admin_invoice_list() $$, '42501', null, 'un anónimo no ve las facturas');
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
select throws_ok($$ select * from public.admin_stamp_usage() $$, '42501', null, 'un cajero no ve los timbres');
select throws_ok($$ select * from public.admin_customer_invoices('c0000000-0000-0000-0000-000000000001') $$, '42501', null,
  'ni las facturas de un cliente');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;
select is((select count(*)::int from public.admin_invoice_list()), 4, 'el administrador ve todas las solicitudes');
select is((select count(*)::int from public.admin_customer_invoices('c0000000-0000-0000-0000-000000000001')), 2,
  'y las facturas de un cliente (la cancelada y la vigente)');
select is((select used from public.admin_stamp_usage()), 2, 'los timbres gastados cuentan aunque la factura se cancele');
select is((select yearly_limit from public.admin_stamp_usage()), null, 'sin límite definido (PD-26) no hay límite');
reset role;
update public.business_settings set value = '10'::jsonb where key = 'stamps_yearly_limit';
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;
select is((select yearly_limit || '/' || warning_percent from public.admin_stamp_usage()), '10/80',
  'con límite definido, lo devuelve con el porcentaje de aviso');
reset role;

select * from finish();
rollback;
