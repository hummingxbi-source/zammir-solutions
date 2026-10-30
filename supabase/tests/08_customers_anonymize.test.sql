-- Pruebas de anonimización de clientes [S1-12].
begin;
select plan(16);

insert into public.devices (name, temp_series, auth_user_id)
values ('Tablet de prueba', 1, '00000000-0000-0000-0000-0000000000d1');

insert into public.customers (id, name, phone, email, notes, fiscal_rfc, fiscal_legal_name, fiscal_zip, fiscal_regime,
                              fiscal_cfdi_use, privacy_notice_version)
values ('50000000-0000-0000-0000-000000000001', 'Ana López', '5512345678', 'ana@ejemplo.invalid', 'Llamar en la tarde',
        'XAXX010101000', 'Ana López SA', '55600', '601', 'G03', 2);

-- Un registro contable que apunta al cliente y debe sobrevivir (representa cotizaciones, ventas y facturas)
create table public.registro_contable_prueba (
  id int primary key,
  customer_id uuid not null references public.customers (id),
  total_cents bigint
);
grant all on public.registro_contable_prueba to public;
insert into public.registro_contable_prueba values (1, '50000000-0000-0000-0000-000000000001', 127500);

-- ---------- Un cajero, la tablet y un anónimo no pueden anonimizar ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
select throws_ok($$ select * from public.anonymize_customer('50000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'un cajero no anonimiza');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
select throws_ok($$ select * from public.anonymize_customer('50000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'la tablet no anonimiza');
reset role;

set local role anon;
select throws_ok($$ select * from public.anonymize_customer('50000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'un anónimo no anonimiza');
reset role;

select is((select name from public.customers where id = '50000000-0000-0000-0000-000000000001'),
  'Ana López', 'los intentos rechazados no cambiaron nada');

-- ---------- Un administrador anonimiza ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;

select lives_ok($$ select * from public.anonymize_customer('50000000-0000-0000-0000-000000000001') $$,
  'el administrador anonimiza');
select throws_ok($$ select * from public.anonymize_customer('99999999-9999-9999-9999-999999999999') $$,
  'P0002', 'NOT_FOUND', 'un cliente que no existe se reporta');
select lives_ok($$ select * from public.anonymize_customer('50000000-0000-0000-0000-000000000001') $$,
  'anonimizar otra vez no falla');

select is(
  (select array[name, phone, coalesce(email, '-'), coalesce(notes, '-'), coalesce(fiscal_rfc, '-'),
                coalesce(fiscal_legal_name, '-'), coalesce(fiscal_zip, '-')]
   from public.customers where id = '50000000-0000-0000-0000-000000000001'),
  array['Cliente anonimizado', '0000000000', '-', '-', '-', '-', '-'],
  'se borraron los datos personales y fiscales'
);
select ok((select anonymized_at is not null from public.customers where id = '50000000-0000-0000-0000-000000000001'),
  'queda anonymized_at');
select is((select privacy_notice_version from public.customers where id = '50000000-0000-0000-0000-000000000001'),
  2, 'se conserva la versión del aviso que se le informó');

select throws_ok(
  $$ update public.customers set name = 'Ana otra vez' where id = '50000000-0000-0000-0000-000000000001' $$,
  'P0001', 'ANONYMIZED', 'un cliente anonimizado ya no se edita'
);
reset role;

-- Ni el dueño de la base lo edita
select throws_ok(
  $$ update public.customers set name = 'Ana otra vez' where id = '50000000-0000-0000-0000-000000000001' $$,
  'P0001', 'ANONYMIZED', 'ni el dueño de la base puede editarlo'
);

-- ---------- Los registros contables se conservan ----------
select is((select total_cents from public.registro_contable_prueba where customer_id = '50000000-0000-0000-0000-000000000001'),
  127500::bigint, 'el registro contable que apunta al cliente sigue ahí');
select is(
  (select c.name from public.registro_contable_prueba r join public.customers c on c.id = r.customer_id where r.id = 1),
  'Cliente anonimizado', 'y sigue ligado al mismo cliente, ya anonimizado'
);

-- ---------- Bitácora: una sola entrada y sin datos personales ----------
select is(
  (select array_agg(action) from public.audit_log where entity_id = '50000000-0000-0000-0000-000000000001'),
  array['CUSTOMER_ANONYMIZED'], 'la anonimización deja una sola entrada de bitácora'
);
select is(
  (select count(*)::int from public.audit_log
   where entity_id = '50000000-0000-0000-0000-000000000001'
     and (old_value::text ilike '%Ana%' or new_value::text ilike '%Ana%' or old_value::text like '%5512345678%'
          or new_value::text like '%XAXX%')),
  0, 'la bitácora no guarda datos personales'
);

select * from finish();
rollback;
