-- S4-20, S4-21 y S4-22 · Solicitudes en proceso y reintentos, cancelación de facturas y timbres [RF-M10-15, RF-M10-17
-- a RF-M10-21, RN-24, RN-27, RN-28, ADR-0033].
--
-- Una solicitud que el PAC no contestó queda "en proceso" y se reintenta con el MISMO identificador, sin duplicar
-- el timbre [RN-24]. Para poder reintentarla hay que guardar lo que se le mandó. Cancelar una factura deja su
-- rastro en la bitácora [RN-18, RN-19]. Todo lo que toca al PAC pasa por funciones del servidor.

alter table public.invoice_requests
  -- Lo que se mandó al PAC (receptor, forma de pago, conceptos y fecha), para reintentar sin pedirlo otra vez.
  add column request_snapshot jsonb,
  add column attempts integer not null default 0 check (attempts >= 0),
  add column last_attempt_at timestamptz,
  add column last_error text,
  add column cancel_motive text check (cancel_motive in ('01', '02', '03', '04')),
  add column cancel_substitute_uuid text,
  add column cancel_requested_at timestamptz,
  add column cancelled_at timestamptz,
  add column cancelled_by uuid;

-- La solicitud ahora también guarda lo que se mandó al PAC.
drop function if exists public.portal_invoice_begin(uuid, text, uuid, text);
create or replace function public.portal_invoice_begin(
  p_request_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_channel text,
  p_snapshot jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.invoice_requests%rowtype;
begin
  select * into v_row from public.invoice_requests where request_id = p_request_id;
  if found then
    return jsonb_build_object('kind', 'EXISTING', 'record', jsonb_build_object(
      'status', v_row.status, 'uuid', v_row.invoice_uuid, 'folio', v_row.invoice_folio));
  end if;

  begin
    insert into public.invoice_requests
      (request_id, work_order_id, counter_sale_id, channel, request_snapshot)
    values (
      p_request_id,
      case when p_source_type = 'WORK_ORDER' then p_source_id end,
      case when p_source_type = 'COUNTER_SALE' then p_source_id end,
      p_channel,
      p_snapshot);
  exception when unique_violation then
    -- Otra solicitud (o esta misma, en paralelo) ya la ganó.
    select * into v_row from public.invoice_requests where request_id = p_request_id;
    if found then
      return jsonb_build_object('kind', 'EXISTING', 'record', jsonb_build_object(
        'status', v_row.status, 'uuid', v_row.invoice_uuid, 'folio', v_row.invoice_folio));
    end if;
    return jsonb_build_object('kind', 'ALREADY_INVOICED');
  end;
  return jsonb_build_object('kind', 'STARTED');
end;
$$;

revoke all on function public.portal_invoice_begin(uuid, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.portal_invoice_begin(uuid, text, uuid, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Reintentos [RF-M10-15]
-- ---------------------------------------------------------------------------------------------------------

-- Anota un intento que no terminó (el PAC no respondió): cuántos van y por qué.
create or replace function public.invoice_record_attempt(p_request_id uuid, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invoice_requests
     set attempts = attempts + 1, last_attempt_at = now(), last_error = left(p_error, 200)
   where request_id = p_request_id and status = 'IN_PROCESS';
$$;

-- Las solicitudes en proceso que ya toca reintentar: con lo que se mandó al PAC, con menos de `p_max_attempts`
-- intentos y cuyo último intento fue hace al menos `p_wait_seconds`.
create or replace function public.invoice_pending_retries(
  p_wait_seconds integer,
  p_max_attempts integer,
  p_limit integer
)
returns table (request_id uuid, source_type text, source_id uuid, attempts integer, request_snapshot jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select r.request_id,
         case when r.work_order_id is not null then 'WORK_ORDER' else 'COUNTER_SALE' end,
         coalesce(r.work_order_id, r.counter_sale_id),
         r.attempts,
         r.request_snapshot
    from public.invoice_requests r
   where r.status = 'IN_PROCESS'
     and r.request_snapshot is not null
     and r.attempts < p_max_attempts
     and (r.last_attempt_at is null or r.last_attempt_at <= now() - make_interval(secs => p_wait_seconds))
   order by r.created_at
   limit p_limit
$$;

-- Una solicitud por su identificador, para reintentarla a petición de un administrador.
create or replace function public.invoice_request_get(p_request_id uuid)
returns table (request_id uuid, status text, source_type text, source_id uuid, attempts integer,
               request_snapshot jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select r.request_id, r.status,
         case when r.work_order_id is not null then 'WORK_ORDER' else 'COUNTER_SALE' end,
         coalesce(r.work_order_id, r.counter_sale_id), r.attempts, r.request_snapshot
    from public.invoice_requests r
   where r.request_id = p_request_id
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Cancelación de una factura [RF-M10-19, RN-18, RN-19, RN-28]
-- ---------------------------------------------------------------------------------------------------------

-- Una factura vigente por su folio, para cancelarla.
create or replace function public.invoice_find_by_folio(p_folio text)
returns table (request_id uuid, status text, invoice_uuid text, invoice_folio text, cancel_requested_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.request_id, r.status, r.invoice_uuid, r.invoice_folio, r.cancel_requested_at
    from public.invoice_requests r
   where r.invoice_folio = p_folio
$$;

-- Deja asentada la cancelación (o su solicitud, si el receptor debe aceptarla) con su rastro en la bitácora.
create or replace function public.invoice_mark_cancelled(
  p_request_id uuid,
  p_motive text,
  p_substitute_uuid text,
  p_by uuid,
  p_pending boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.invoice_requests%rowtype;
begin
  select * into v_row from public.invoice_requests where request_id = p_request_id for update;
  if not found or v_row.status <> 'STAMPED' then
    raise exception 'INVOICE_NOT_CANCELLABLE' using errcode = 'P0002';
  end if;

  update public.invoice_requests
     set cancel_motive = p_motive,
         cancel_substitute_uuid = p_substitute_uuid,
         cancel_requested_at = coalesce(cancel_requested_at, now()),
         status = case when p_pending then status else 'CANCELLED' end,
         cancelled_at = case when p_pending then null else now() end,
         cancelled_by = case when p_pending then null else p_by end
   where request_id = p_request_id;

  insert into public.audit_log
    (id, occurred_at, recorded_by, user_id, action, entity_type, entity_id, old_value, new_value)
  values (
    gen_random_uuid(), now(), p_by, p_by,
    case when p_pending then 'INVOICE_CANCELLATION_REQUESTED' else 'INVOICE_CANCELLED' end,
    'invoice', v_row.invoice_folio,
    jsonb_build_object('estado', v_row.status),
    jsonb_build_object('motivo', p_motive, 'sustituye', p_substitute_uuid, 'uuid', v_row.invoice_uuid));
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Lo que ve el administrador
-- ---------------------------------------------------------------------------------------------------------

-- Las facturas pedidas, con lo que hace falta para revisarlas: emitidas, en proceso, canceladas y fallidas.
create or replace function public.admin_invoice_list()
returns table (
  request_id uuid,
  status text,
  invoice_folio text,
  channel text,
  source_type text,
  source_id uuid,
  source_folio text,
  customer_name text,
  total_cents bigint,
  recipient jsonb,
  stamped_at timestamptz,
  created_at timestamptz,
  attempts integer,
  last_error text,
  cancel_motive text,
  cancel_requested_at timestamptz,
  cancelled_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Solo los administradores ven las facturas' using errcode = '42501';
  end if;
  return query
  select r.request_id, r.status, r.invoice_folio, r.channel,
         case when r.work_order_id is not null then 'WORK_ORDER' else 'COUNTER_SALE' end,
         coalesce(r.work_order_id, r.counter_sale_id),
         coalesce(o.folio, o.temp_folio, s.folio, s.temp_folio),
         c.name,
         coalesce(o.total_cents, s.total_cents),
         r.recipient, r.stamped_at, r.created_at, r.attempts, r.last_error,
         r.cancel_motive, r.cancel_requested_at, r.cancelled_at
    from public.invoice_requests r
    left join public.work_orders o on o.id = r.work_order_id
    left join public.counter_sales s on s.id = r.counter_sale_id
    left join public.customers c on c.id = coalesce(o.customer_id, s.customer_id)
   order by r.created_at desc
   limit 300;
end;
$$;

-- Timbres usados este año (hora de México) contra el límite del paquete y el porcentaje de aviso [RF-M10-20].
-- Un timbre ya gastado cuenta aunque la factura se cancele después. Sin límite definido (PD-26), no hay aviso.
create or replace function public.admin_stamp_usage()
returns table (used integer, yearly_limit integer, warning_percent integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from (now() at time zone 'America/Mexico_City'))::integer;
begin
  if not (select private.is_admin()) then
    raise exception 'Solo los administradores ven los timbres' using errcode = '42501';
  end if;
  return query
  select
    (select count(*)::integer from public.invoice_requests r
      where r.status in ('STAMPED', 'CANCELLED')
        and extract(year from (r.stamped_at at time zone 'America/Mexico_City')) = v_year),
    (select (value #>> '{}')::integer from public.business_settings where key = 'stamps_yearly_limit'
        and jsonb_typeof(value) = 'number'),
    (select coalesce((value #>> '{}')::integer, 80) from public.business_settings
      where key = 'stamps_warning_percent');
end;
$$;

-- Las facturas de un cliente, para su historial [RF-M10-21, RF-M5-02]: las de sus ventas y órdenes.
create or replace function public.admin_customer_invoices(p_customer_id uuid)
returns table (
  invoice_folio text,
  status text,
  source_type text,
  source_folio text,
  total_cents bigint,
  stamped_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Solo los administradores ven las facturas' using errcode = '42501';
  end if;
  return query
  select r.invoice_folio, r.status,
         case when r.work_order_id is not null then 'WORK_ORDER' else 'COUNTER_SALE' end,
         coalesce(o.folio, o.temp_folio, s.folio, s.temp_folio),
         coalesce(o.total_cents, s.total_cents),
         r.stamped_at
    from public.invoice_requests r
    left join public.work_orders o on o.id = r.work_order_id
    left join public.counter_sales s on s.id = r.counter_sale_id
   where r.status in ('STAMPED', 'CANCELLED')
     and coalesce(o.customer_id, s.customer_id) = p_customer_id
   order by r.stamped_at desc;
end;
$$;

-- Permisos: lo del PAC solo para el rol de servicio; lo que ve el administrador, para su sesión.
revoke all on function public.invoice_record_attempt(uuid, text) from public, anon, authenticated;
revoke all on function public.invoice_pending_retries(integer, integer, integer) from public, anon, authenticated;
revoke all on function public.invoice_request_get(uuid) from public, anon, authenticated;
revoke all on function public.invoice_find_by_folio(text) from public, anon, authenticated;
revoke all on function public.invoice_mark_cancelled(uuid, text, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.invoice_record_attempt(uuid, text) to service_role;
grant execute on function public.invoice_pending_retries(integer, integer, integer) to service_role;
grant execute on function public.invoice_request_get(uuid) to service_role;
grant execute on function public.invoice_find_by_folio(text) to service_role;
grant execute on function public.invoice_mark_cancelled(uuid, text, text, uuid, boolean) to service_role;

revoke all on function public.admin_invoice_list() from public, anon;
revoke all on function public.admin_stamp_usage() from public, anon;
revoke all on function public.admin_customer_invoices(uuid) from public, anon;
grant execute on function public.admin_invoice_list() to authenticated;
grant execute on function public.admin_stamp_usage() to authenticated;
grant execute on function public.admin_customer_invoices(uuid) to authenticated;
