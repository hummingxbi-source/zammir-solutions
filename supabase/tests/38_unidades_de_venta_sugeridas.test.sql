-- PP-40 · Unidades de venta sugeridas [RF-M1-11]: el ajuste nace con la lista base; un administrador la cambia y
-- un cajero no.
begin;
select plan(3);

select is(
  (select value from public.business_settings where key = 'sale_unit_suggestions'),
  '["rollo", "kilo", "juego", "par", "cartucho", "hoja", "tramo", "visita", "hora"]'::jsonb,
  'nace con la lista base');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
update public.business_settings set value = '["galón"]'::jsonb where key = 'sale_unit_suggestions';
reset role;
select is(
  (select value->>0 from public.business_settings where key = 'sale_unit_suggestions'), 'rollo',
  'un cajero no la cambia');

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;
update public.business_settings set value = '["galón", "cartucho"]'::jsonb where key = 'sale_unit_suggestions';
reset role;
select is(
  (select value from public.business_settings where key = 'sale_unit_suggestions'), '["galón", "cartucho"]'::jsonb,
  'un administrador sí');

select * from finish();
rollback;
