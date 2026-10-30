-- Pruebas del aviso de privacidad y términos versionados [S1-13].
begin;
select plan(20);

select has_table('public', 'legal_documents', 'existe la tabla de documentos legales');
select ok((select relrowsecurity from pg_class where oid = 'public.legal_documents'::regclass), 'tiene RLS');
select is(
  (select count(*)::int from public.legal_documents where type = 'PRIVACY_NOTICE' and version = 1),
  1, 'nace con el borrador del aviso de privacidad como versión 1'
);
select matches((select body from public.legal_documents where type = 'PRIVACY_NOTICE' and version = 1),
  'BORRADOR', 'el borrador dice que está pendiente de revisión');

insert into public.devices (name, temp_series, auth_user_id)
values ('Tablet de prueba', 1, '00000000-0000-0000-0000-0000000000d1');

-- ---------- Un administrador publica una versión nueva ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.legal_documents (id, type, body, effective_from)
     values ('60000000-0000-0000-0000-000000000001', 'PRIVACY_NOTICE', 'Texto nuevo del aviso', '2026-11-01T00:00:00Z') $$,
  'el administrador publica una versión nueva'
);
select is(
  (select version from public.legal_documents where id = '60000000-0000-0000-0000-000000000001'),
  2, 'la base le asigna la versión siguiente'
);
select lives_ok(
  $$ insert into public.legal_documents (id, type, body, version)
     values ('60000000-0000-0000-0000-000000000002', 'PRIVACY_NOTICE', 'Otro texto', 1) $$,
  'si la aplicación manda una versión, la base la ignora'
);
select is(
  (select version from public.legal_documents where id = '60000000-0000-0000-0000-000000000002'),
  3, 'y asigna la que sigue'
);
select lives_ok(
  $$ insert into public.legal_documents (id, type, body)
     values ('60000000-0000-0000-0000-000000000003', 'TERMS', 'Términos') $$,
  'los términos llevan su propia numeración'
);
select is(
  (select version from public.legal_documents where id = '60000000-0000-0000-0000-000000000003'),
  1, 'y empiezan en 1'
);
select throws_ok($$ insert into public.legal_documents (type, body) values ('PRIVACY_NOTICE', '   ') $$,
  '23514', null, 'el texto no puede estar en blanco');
select throws_ok($$ insert into public.legal_documents (type, body) values ('OTRO', 'x') $$,
  '23514', null, 'el tipo debe ser aviso de privacidad o términos');
select throws_ok(
  $$ update public.legal_documents set body = 'Cambiado' where id = '60000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'el administrador no modifica una versión'
);
select throws_ok(
  $$ delete from public.legal_documents where id = '60000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'ni la borra'
);
reset role;

-- Ni el dueño de la base
select throws_ok(
  $$ update public.legal_documents set body = 'Cambiado' where id = '60000000-0000-0000-0000-000000000001' $$,
  'P0001', 'Las versiones de los documentos legales no se modifican ni se borran', 'el dueño tampoco las modifica'
);

select is(
  (select array_agg(action) from public.audit_log where entity_id = '60000000-0000-0000-0000-000000000001'),
  array['LEGAL_DOCUMENT_PUBLISHED'], 'publicar deja su entrada de bitácora'
);

-- ---------- Un dispositivo lee pero no publica ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated","app_metadata":{"rol":"DEVICE"}}', true);
set local role authenticated;
select ok((select count(*) from public.legal_documents) >= 4, 'la tablet lee los documentos');
select throws_ok($$ insert into public.legal_documents (type, body) values ('PRIVACY_NOTICE', 'Intento de la tablet') $$,
  '42501', null, 'la tablet no publica');
reset role;

-- ---------- Un cajero sin dispositivo y un anónimo no ven nada ----------
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
select is((select count(*)::int from public.legal_documents), 0, 'un cajero sin dispositivo no los ve');
reset role;
set local role anon;
select throws_ok($$ select * from public.legal_documents $$, '42501', null, 'un anónimo tampoco');
reset role;

select * from finish();
rollback;
