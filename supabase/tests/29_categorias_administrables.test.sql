-- Categorías que administra el administrador [RF-M1-08, ADR-0044, AJ-08]: alta y cambio solo del administrador,
-- sin nombres repetidos, sin desactivar con productos activos, sin borrar y con bitácora.
begin;
select plan(8);

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;

insert into public.product_categories (id, name, sort_order, fiscal_product_service_key, fiscal_unit_key, fiscal_tax_object)
values ('c9000000-0000-0000-0000-000000000001', 'Vitrales', 12, '01010101', 'MTK', '02');
select is((select is_active from public.product_categories where id = 'c9000000-0000-0000-0000-000000000001'), true,
  'el administrador agrega una categoría, activa');
select throws_ok(
  $$ insert into public.product_categories (name, sort_order) values ('  vitrales ', 13) $$,
  '23505', null, 'no se repite un nombre aunque cambien mayúsculas o espacios');

update public.product_categories set name = 'Vitrales y emplomados' where id = 'c9000000-0000-0000-0000-000000000001';
insert into public.products (name, category_id, kind, charge_unit, list_price_cents, rule_id)
values ('Vitral', 'c9000000-0000-0000-0000-000000000001', 'CUSTOM', 'SQUARE_METER', 100000, 'AREA');
select throws_ok(
  $$ update public.product_categories set is_active = false where id = 'c9000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'no se desactiva con productos activos');
update public.products set is_active = false where category_id = 'c9000000-0000-0000-0000-000000000001';
update public.product_categories set is_active = false where id = 'c9000000-0000-0000-0000-000000000001';
select is((select is_active from public.product_categories where id = 'c9000000-0000-0000-0000-000000000001'), false,
  'sin productos activos sí se desactiva');
select throws_ok(
  $$ delete from public.product_categories where id = 'c9000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'una categoría no se borra');
reset role;

select is(
  -- En una sola transacción todas llevan la misma hora: se comparan como conjunto.
  (select array_agg(action order by action) from public.audit_log
    where entity_id = 'c9000000-0000-0000-0000-000000000001'),
  array['CATEGORY_CREATED', 'CATEGORY_DEACTIVATED', 'CATEGORY_UPDATED'],
  'el alta y los cambios quedan en la bitácora');

-- Un dispositivo (tablet) no agrega ni cambia categorías.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.product_categories (name, sort_order) values ('Intento', 20) $$,
  '42501', null, 'la tablet no agrega categorías');
update public.product_categories set name = 'X' where sort_order = 1;
select is((select count(*)::int from public.product_categories where name = 'X'), 0,
  'ni las cambia: el nombre quedó igual');
reset role;

select * from finish();
rollback;
