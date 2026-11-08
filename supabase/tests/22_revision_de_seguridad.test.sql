-- Revisión de seguridad [S5-07, RNF-08 a RNF-13, RNF-19]: reglas que toda la base debe cumplir hoy y mañana.
-- Si alguien agrega una tabla, una vista o una función que rompa una, esta prueba falla y dice cuál.
-- Cada lista permitida es corta y está explicada: agregar un renglón a una lista es una decisión de seguridad.
begin;
select plan(12);

-- 1. Ninguna tabla sin RLS (las tablas de `public` y `private`).
select is(
  array(select (n.nspname || '.' || c.relname)::text
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where c.relkind in ('r', 'p') and n.nspname in ('public', 'private') and not c.relrowsecurity
         order by 1),
  array[]::text[],
  'toda tabla tiene RLS activada'
);

-- 2. Tablas con RLS y sin políticas = nadie las toca desde el navegador; solo las funciones del servidor.
--    Permitidas: códigos de registro de tablets, contadores de folios e intentos del portal.
select is(
  array(select (n.nspname || '.' || c.relname)::text
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where c.relkind in ('r', 'p') and n.nspname in ('public', 'private') and c.relrowsecurity
           and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
         order by 1),
  array['public.device_registration_codes', 'public.folio_counters', 'public.portal_attempts'],
  'las únicas tablas sin política son las que solo toca el servidor'
);

-- 3. Un visitante sin sesión (anon) solo lee los documentos legales vigentes; nada más.
select is(
  array(select (table_schema || '.' || table_name || ':' || privilege_type)::text
          from information_schema.role_table_grants
         where grantee = 'anon' and table_schema in ('public', 'private')
         order by 1),
  array['public.legal_documents:SELECT'],
  'anon solo puede leer los documentos legales'
);

-- 4. Las vistas corren con los derechos de su dueño: por eso cada una debe filtrar por administrador o tablet.
select is(
  array(select c.relname::text
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where c.relkind = 'v' and n.nspname = 'public'
           and not coalesce(c.reloptions @> array['security_invoker=true'], false)
           and pg_get_viewdef(c.oid) !~ 'is_admin|is_device'
         order by 1),
  array[]::text[],
  'toda vista sin security_invoker filtra por is_admin o is_device'
);

-- 5. Ninguna vista de `public` la ve un visitante sin sesión.
select is(
  array(select distinct table_name::text
          from information_schema.role_table_grants g
         where grantee in ('anon', 'public') and table_schema = 'public'
           and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                        where c.relname = g.table_name and n.nspname = 'public' and c.relkind = 'v')
         order by 1),
  array[]::text[],
  'ninguna vista es visible para anon'
);

-- 6. Toda función SECURITY DEFINER fija su search_path (evita que alguien cambie qué tabla se lee).
select is(
  array(select p.proname::text
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'private') and p.prosecdef
           and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
         order by 1),
  array[]::text[],
  'toda función SECURITY DEFINER fija su search_path'
);

-- 7. Qué funciones puede llamar un visitante sin sesión (sin contar los disparadores, que no se llaman a mano).
select is(
  array(select p.proname::text
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'private') and p.prorettype <> 'trigger'::regtype
           and has_function_privilege('anon', p.oid, 'execute')
         order by 1),
  array['is_admin', 'is_device', 'public_business_contact'],
  'anon solo llama las funciones de identidad y el contacto público del negocio'
);

-- 8. Las funciones que un usuario con sesión puede llamar son estas y ninguna otra.
--    Todo lo del PAC, el portal, los reintentos y los errores es solo del servidor.
select is(
  array(select p.proname::text
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'private') and p.prorettype <> 'trigger'::regtype
           and has_function_privilege('authenticated', p.oid, 'execute')
         order by 1),
  array['admin_customer_invoices', 'admin_error_log', 'admin_export_data', 'admin_invoice_candidates', 'admin_invoice_list',
        'admin_stamp_usage', 'anonymize_customer', 'create_device_registration_code', 'is_admin', 'is_device',
        'list_devices', 'public_business_contact', 'receive_operation', 'revoke_device'],
  'las funciones que llama un usuario con sesión son las esperadas'
);

-- 9. Las funciones de administrador y de tablet comprueban quién llama dentro de la propia función.
select is(
  array(select p.proname::text
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'private') and p.prosecdef and p.prorettype <> 'trigger'::regtype
           and has_function_privilege('authenticated', p.oid, 'execute')
           and p.proname not in ('public_business_contact', 'is_device')
           and p.prosrc !~ 'is_admin|is_device|auth\.uid\(\)'
         order by 1),
  array[]::text[],
  'toda función SECURITY DEFINER que llama un usuario con sesión comprueba su rol'
);

-- 10. Las fotos de medición viven en un depósito privado.
select is(
  (select count(*)::int from storage.buckets where public),
  0,
  'ningún depósito de archivos es público'
);

-- 11. Nada se borra desde el navegador: ni anon ni un usuario con sesión tienen DELETE ni TRUNCATE en ninguna tabla.
--     (TRUNCATE no pasa por RLS.) Lo contable solo se cancela, con motivo y rastro [RN-18].
select is(
  array(select (table_name || ':' || privilege_type)::text
          from information_schema.role_table_grants g
         where grantee in ('anon', 'authenticated') and privilege_type in ('DELETE', 'TRUNCATE')
           and table_schema in ('public', 'private')
           and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                        where c.relname = g.table_name and n.nspname = g.table_schema and c.relkind in ('r', 'p'))
         order by 1),
  array[]::text[],
  'nadie con sesión ni anónimo puede borrar ni vaciar una tabla [RN-18]'
);

-- 12. Tampoco REFERENCES ni TRIGGER: no sirven para nada desde el navegador.
select is(
  array(select (table_name || ':' || privilege_type)::text
          from information_schema.role_table_grants g
         where grantee in ('anon', 'authenticated') and privilege_type in ('REFERENCES', 'TRIGGER')
           and table_schema in ('public', 'private')
           and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                        where c.relname = g.table_name and n.nspname = g.table_schema and c.relkind in ('r', 'p'))
         order by 1),
  array[]::text[],
  'nadie con sesión ni anónimo tiene REFERENCES ni TRIGGER en una tabla'
);

select * from finish();
rollback;
