-- Pedir la factura desde el portal [S4-19, RN-24, RN-15, RF-M9-05]: una factura vigente por operación, folio F
-- consecutivo, archivos guardados y solo el servidor lo hace.
begin;
select plan(24);

select has_column('public', 'invoice_requests', 'xml', 'la factura guarda su XML');
select has_column('public', 'invoice_requests', 'recipient', 'y los datos del receptor');

-- ---------- Datos: ventas con productos de catálogo, directo como dueño ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
insert into public.devices (id, name, temp_series, auth_user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'Tablet 1', 1, '00000000-0000-0000-0000-0000000000d1');
insert into public.app_users (id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version) values
  ('a0000000-0000-0000-0000-000000000001', 'Ana', 'STAFF', true, 's', 1000, 'h', 1);
insert into public.customers (id, name, phone) values
  ('c0000000-0000-0000-0000-000000000001', 'Cliente de prueba', '5512345678');

insert into public.products (id, name, category_id, kind, charge_unit, list_price_cents, rule_id)
select 'b0000000-0000-0000-0000-000000000001', 'Vidrio con claves propias', id, 'STANDARD', 'PIECE', 11600, 'PIECE'
  from public.product_categories where sort_order = 1;
update public.products set fiscal_product_service_key = '30171500', fiscal_unit_key = 'H87'
 where id = 'b0000000-0000-0000-0000-000000000001';
insert into public.products (id, name, category_id, kind, charge_unit, list_price_cents, rule_id)
select 'b0000000-0000-0000-0000-000000000002', 'Vidrio con claves de su categoría', id, 'STANDARD', 'PIECE', 11600, 'PIECE'
  from public.product_categories where sort_order = 1;

insert into public.counter_sales (id, temp_folio, public_code, issued_at, subtotal_cents, tax_cents, total_cents,
  device_id, user_id, op_id)
values ('e1000000-0000-0000-0000-000000000001', 'T1-0001', 'BBBBBBBB', '2090-06-15T18:00:00Z', 20000, 3200, 23200,
  'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', gen_random_uuid());
insert into public.counter_sale_lines (id, counter_sale_id, position, product_id, name, charge_unit, unit_price_cents,
  rule_id, quantity, line_total_cents, base_cents, tax_cents) values
  ('f1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 1,
   'b0000000-0000-0000-0000-000000000001', 'Con claves propias', 'PIECE', 11600, 'PIECE', 1, 11600, 10000, 1600),
  ('f1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000001', 2,
   'b0000000-0000-0000-0000-000000000002', 'Con claves de la categoría', 'PIECE', 11600, 'PIECE', 1, 11600, 10000, 1600);
insert into public.payments (id, group_id, counter_sale_id, kind, method, amount_cents, cash_received_cents,
  change_cents, user_id, device_id, paid_at, op_id)
values ('b3000000-0000-0000-0000-000000000001', gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001',
  'SALE', 'CASH', 23200, 23200, 0, 'a0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001', '2090-06-15T18:00:00Z', gen_random_uuid());
insert into public.payments (id, group_id, counter_sale_id, kind, method, amount_cents, user_id, device_id, paid_at, op_id)
values ('b3000000-0000-0000-0000-000000000002', gen_random_uuid(), 'e1000000-0000-0000-0000-000000000001',
  'SALE', 'TRANSFER', 1, 'a0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001', '2090-06-15T18:00:00Z', gen_random_uuid());

-- ---------- Nadie más que el servidor ----------
set local role anon;
select throws_ok($$ select public.portal_invoice_begin(gen_random_uuid(), 'COUNTER_SALE',
  'e1000000-0000-0000-0000-000000000001', 'PORTAL') $$, '42501', null, 'un anónimo no abre solicitudes');
select throws_ok($$ select public.portal_invoice_files('COUNTER_SALE', 'e1000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'ni baja archivos');
select throws_ok($$ select public.portal_invoice_mark_stamped(gen_random_uuid(), 'u', now(), '{}', '01', 'x', 'y') $$,
  '42501', null, 'ni guarda timbres');
reset role;

set local role service_role;

-- ---------- Lo que trae la búsqueda para facturar ----------
select is((select public.portal_find_document('T1-0001', 'BBBBBBBB') -> 'lines' -> 0 ->> 'productServiceKey'), '30171500',
  'una línea trae las claves propias de su producto');
select is((select public.portal_find_document('T1-0001', 'BBBBBBBB') -> 'lines' -> 0 ->> 'unitKey'), 'H87',
  'incluida la unidad');
select is((select public.portal_find_document('T1-0001', 'BBBBBBBB') -> 'lines' -> 1 ->> 'productServiceKey'), '01010101',
  'si el producto no las tiene, las de su categoría');
select is((select public.portal_find_document('T1-0001', 'BBBBBBBB') -> 'lines' -> 1 ->> 'taxObject'), '02',
  'y el objeto de impuesto');
select is((select (public.portal_find_document('T1-0001', 'BBBBBBBB') -> 'lines' -> 0 ->> 'baseCents')::int), 10000,
  'trae el importe sin IVA');
select is((select (public.portal_find_document('T1-0001', 'BBBBBBBB') -> 'lines' -> 0 ->> 'taxCents')::int), 1600,
  'y el IVA ya guardado');
select is((select public.portal_find_document('T1-0001', 'BBBBBBBB') -> 'paymentMethods'), '["CASH", "TRANSFER"]'::jsonb,
  'y con qué se pagó, para decidir la forma de pago');

-- ---------- Una operación, una factura vigente; la misma solicitud no se duplica ----------
select is((select public.portal_invoice_begin('90000000-0000-0000-0000-000000000001', 'COUNTER_SALE',
  'e1000000-0000-0000-0000-000000000001', 'PORTAL') ->> 'kind'), 'STARTED', 'la primera solicitud se abre');
select is((select public.portal_invoice_begin('90000000-0000-0000-0000-000000000001', 'COUNTER_SALE',
  'e1000000-0000-0000-0000-000000000001', 'PORTAL') ->> 'kind'), 'EXISTING', 'repetirla devuelve la misma');
select is((select public.portal_invoice_begin('90000000-0000-0000-0000-000000000002', 'COUNTER_SALE',
  'e1000000-0000-0000-0000-000000000001', 'SYSTEM') ->> 'kind'), 'ALREADY_INVOICED',
  'otra solicitud sobre la misma venta se rechaza');

-- ---------- El timbre asigna el folio F del año de México, consecutivo, y es idempotente ----------
select is((select public.portal_invoice_mark_stamped('90000000-0000-0000-0000-000000000001', 'UUID-1',
  '2090-06-15T18:00:00Z', '{"rfc":"XAXX010101000"}', '03', '<xml/>', 'cGRm')), 'F-2090-0001',
  'el primer timbre lleva F-AAAA-0001');
select is((select public.portal_invoice_mark_stamped('90000000-0000-0000-0000-000000000001', 'UUID-OTRO',
  '2090-06-15T18:00:00Z', '{}', '03', '<otro/>', 'b3RybyA=')), 'F-2090-0001',
  'guardarlo otra vez devuelve el mismo folio y no asigna otro');
select is((select invoice_uuid from public.invoice_requests where request_id = '90000000-0000-0000-0000-000000000001'),
  'UUID-1', 'y no pisa lo ya guardado');
select is((select xml || '|' || pdf_base64 from public.portal_invoice_files('COUNTER_SALE',
  'e1000000-0000-0000-0000-000000000001')), '<xml/>|cGRm', 'los archivos se pueden bajar');
select is((select (public.portal_find_document('T1-0001', 'BBBBBBBB') ->> 'invoiced')::boolean), true,
  'la venta ya figura como facturada');
select is((select privacy_notice_version from public.invoice_requests
  where request_id = '90000000-0000-0000-0000-000000000001') >= 1, true,
  'queda la versión del aviso de privacidad vigente al pedirla');

-- El año del folio es el de México: 1 ene 2091 03:00 UTC todavía es 2090.
insert into public.counter_sales (id, temp_folio, public_code, issued_at, subtotal_cents, tax_cents, total_cents,
  device_id, user_id, op_id)
values ('e1000000-0000-0000-0000-000000000002', 'T1-0002', 'CCCCCCCC', '2090-06-16T18:00:00Z', 100, 16, 116,
  'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', gen_random_uuid());
select public.portal_invoice_begin('90000000-0000-0000-0000-000000000003', 'COUNTER_SALE',
  'e1000000-0000-0000-0000-000000000002', 'PORTAL');
select is((select public.portal_invoice_mark_stamped('90000000-0000-0000-0000-000000000003', 'UUID-3',
  '2091-01-01T03:00:00Z', '{}', '01', '<xml/>', 'cGRm')), 'F-2090-0002',
  'el año del folio es el de México, no el de UTC');

-- ---------- Una solicitud fallida libera la venta para otra ----------
insert into public.counter_sales (id, temp_folio, public_code, issued_at, subtotal_cents, tax_cents, total_cents,
  device_id, user_id, op_id)
values ('e1000000-0000-0000-0000-000000000003', 'T1-0003', 'DDDDDDDD', '2090-06-16T18:00:00Z', 100, 16, 116,
  'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', gen_random_uuid());
select public.portal_invoice_begin('90000000-0000-0000-0000-000000000004', 'COUNTER_SALE',
  'e1000000-0000-0000-0000-000000000003', 'PORTAL');
select public.portal_invoice_mark_failed('90000000-0000-0000-0000-000000000004');
select is((select public.portal_invoice_begin('90000000-0000-0000-0000-000000000005', 'COUNTER_SALE',
  'e1000000-0000-0000-0000-000000000003', 'PORTAL') ->> 'kind'), 'STARTED',
  'si la primera falló, se puede pedir otra para esa venta');
select is((select status from public.invoice_requests where request_id = '90000000-0000-0000-0000-000000000004'),
  'FAILED', 'y la fallida queda registrada, no se borra [RN-18]');

reset role;
select * from finish();
rollback;
