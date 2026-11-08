-- Exportación de los datos de ZAMMIR [S5-08, RNF-22, ADR-0036].
-- Un administrador puede llevarse todos los datos del negocio en formatos estándar (CSV, JSON y PDF, que se arman
-- en la aplicación a partir de esto). La función entrega solo lo que le pertenece al negocio:
--   · NO entrega los PIN (sal, iteraciones, huella y versión), ni la cuenta de acceso de cada tablet, ni los
--     códigos de registro, ni los contadores de folios, ni los intentos del portal, ni el registro de errores,
--     ni el registro técnico de operaciones de las tablets (sus datos ya están en las tablas del negocio).
--   · De las facturas entrega el XML y los datos, pero no el PDF en base64 (se vuelve a generar) ni la solicitud
--     guardada para reintentos (es técnica).
-- Es solo para administradores y deja una entrada en la bitácora con quién exportó y cuántos renglones [RN-19].
create or replace function public.admin_export_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '60s'
as $$
declare
  r record;
  v_filas jsonb;
  v_tablas jsonb := '{}'::jsonb;
  v_conteos jsonb := '{}'::jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'Solo los administradores exportan los datos' using errcode = '42501';
  end if;

  for r in
    select * from (values
      ('customers',                '{}'::text[]),
      ('product_categories',       '{}'::text[]),
      ('products',                 '{}'::text[]),
      ('product_price_history',    '{}'::text[]),
      ('quotes',                   '{}'::text[]),
      ('quote_lines',              '{}'::text[]),
      ('work_orders',              '{}'::text[]),
      ('work_order_lines',         '{}'::text[]),
      ('work_order_status_events', '{}'::text[]),
      ('warranties',               '{}'::text[]),
      ('payments',                 '{}'::text[]),
      ('counter_sales',            '{}'::text[]),
      ('counter_sale_lines',       '{}'::text[]),
      ('cash_shifts',              '{}'::text[]),
      ('cash_shift_reopenings',    '{}'::text[]),
      ('invoice_requests',         array['pdf_base64', 'request_snapshot']),
      ('legal_documents',          '{}'::text[]),
      ('business_settings',        '{}'::text[]),
      ('audit_log',                '{}'::text[]),
      ('app_users',                array['pin_salt', 'pin_iterations', 'pin_hash', 'pin_version']),
      ('devices',                  array['auth_user_id'])
    ) as t(nombre, excluir)
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t) - $1), ''[]''::jsonb) from public.%I t', r.nombre
    ) into v_filas using r.excluir;
    v_tablas := v_tablas || jsonb_build_object(r.nombre, v_filas);
    v_conteos := v_conteos || jsonb_build_object(r.nombre, jsonb_array_length(v_filas));
  end loop;

  insert into public.audit_log
    (id, occurred_at, recorded_by, user_id, action, entity_type, entity_id, old_value, new_value)
  values (
    gen_random_uuid(), now(), (select auth.uid()), (select auth.uid()), 'DATA_EXPORTED',
    'export', 'all', null, jsonb_build_object('rows', v_conteos)
  );

  return jsonb_build_object('generated_at', now(), 'tables', v_tablas);
end;
$$;

revoke all on function public.admin_export_data() from public, anon;
grant execute on function public.admin_export_data() to authenticated;
