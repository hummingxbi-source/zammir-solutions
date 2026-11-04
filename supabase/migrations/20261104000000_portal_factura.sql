-- S4-18 · Portal público de autofacturación: qué lee y cómo se protege [RF-M10-09 a RF-M10-11, RN-24 a RN-26,
-- RNF-12, ADR-0030].
--
-- El portal lo abre cualquiera con el QR de su ticket, sin entrar al sistema. Por eso:
--   · Nada se lee con tablas directas: el navegador solo habla con la función de servidor
--     `consultar-factura`, que usa la llave de servicio y estas funciones.
--   · Las funciones de abajo solo las puede ejecutar el rol de servicio (ni anónimos ni tablets).
--   · Los intentos fallidos se guardan con la IP **convertida en huella** (nunca la IP) para limitarlos sin
--     guardar datos personales de más.

-- ---------------------------------------------------------------------------------------------------------
-- Facturas por operación: una operación, una factura vigente [RN-24]
-- ---------------------------------------------------------------------------------------------------------
-- Aquí solo vive lo necesario para saber si algo ya se facturó o está en proceso. Los datos fiscales, el
-- timbrado y los reintentos se agregan con las historias de facturación (S4-16, S4-20).

create table public.invoice_requests (
  id uuid primary key default gen_random_uuid(),
  -- Una solicitud, un timbre: el mismo identificador nunca timbra dos veces [RN-24].
  request_id uuid not null unique,
  work_order_id uuid references public.work_orders (id),
  counter_sale_id uuid references public.counter_sales (id),
  channel text not null check (channel in ('SYSTEM', 'PORTAL')),
  status text not null default 'IN_PROCESS'
    check (status in ('IN_PROCESS', 'STAMPED', 'CANCELLED', 'FAILED')),
  invoice_uuid text,
  invoice_folio text check (invoice_folio ~ '^F-[0-9]{4}-[0-9]{4,}$'),
  created_at timestamptz not null default now(),
  check ((work_order_id is not null) <> (counter_sale_id is not null))
);

comment on table public.invoice_requests is
  'Facturas pedidas por venta u orden. Solo las escriben funciones del servidor; una operación tiene a lo más una vigente o en proceso.';

create unique index invoice_requests_una_por_orden
  on public.invoice_requests (work_order_id)
  where work_order_id is not null and status in ('IN_PROCESS', 'STAMPED');
create unique index invoice_requests_una_por_venta
  on public.invoice_requests (counter_sale_id)
  where counter_sale_id is not null and status in ('IN_PROCESS', 'STAMPED');

alter table public.invoice_requests enable row level security;

create policy "los administradores leen las facturas pedidas"
  on public.invoice_requests
  for select
  to authenticated
  using ((select private.is_admin()));

revoke all on public.invoice_requests from anon;
grant select on public.invoice_requests to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Intentos fallidos del portal
-- ---------------------------------------------------------------------------------------------------------

create table public.portal_attempts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('IP', 'FOLIO')),
  -- Huella (hash) de la IP o del folio escrito; nunca el dato en claro.
  key_hash text not null check (length(key_hash) between 16 and 128),
  attempted_at timestamptz not null default now()
);

comment on table public.portal_attempts is
  'Intentos fallidos del portal de autofacturación, por huella de IP y de folio. Se limpian solos después de un día.';

create index portal_attempts_busqueda_idx on public.portal_attempts (kind, key_hash, attempted_at);

alter table public.portal_attempts enable row level security;
-- Sin políticas y sin permisos: solo el rol de servicio (que se salta RLS) la usa.
revoke all on public.portal_attempts from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Funciones del servidor para el portal
-- ---------------------------------------------------------------------------------------------------------

-- Cuántos fallos recientes tienen esta IP y este folio.
create or replace function public.portal_failure_counts(
  p_ip_hash text,
  p_folio_hash text,
  p_window_seconds integer
)
returns table (ip_failures integer, folio_failures integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::integer from public.portal_attempts
      where kind = 'IP' and key_hash = p_ip_hash
        and attempted_at > now() - make_interval(secs => p_window_seconds)),
    (select count(*)::integer from public.portal_attempts
      where kind = 'FOLIO' and key_hash = p_folio_hash
        and attempted_at > now() - make_interval(secs => p_window_seconds))
$$;

-- Registra un intento fallido (de IP y de folio) y limpia los de hace más de un día.
create or replace function public.portal_record_failure(p_ip_hash text, p_folio_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.portal_attempts (kind, key_hash) values ('IP', p_ip_hash), ('FOLIO', p_folio_hash);
  delete from public.portal_attempts where attempted_at < now() - interval '1 day';
end;
$$;

-- Busca la venta u orden que lleva ese código público y ese folio (definitivo o provisional). Devuelve solo lo
-- necesario para decidir si se puede facturar y para mostrar conceptos y total; `null` si el código no existe
-- o el folio no es el de ese documento (el servidor no distingue entre ambos al responder) [RF-M10-12].
create or replace function public.portal_find_document(p_folio text, p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sale public.counter_sales%rowtype;
  v_order public.work_orders%rowtype;
  v_paid bigint;
  v_settled timestamptz;
begin
  select * into v_sale from public.counter_sales where public_code = p_code;
  if found and (v_sale.folio = p_folio or v_sale.temp_folio = p_folio) then
    select coalesce(sum(amount_cents), 0) into v_paid
      from public.payments where counter_sale_id = v_sale.id;
    return jsonb_build_object(
      'type', 'COUNTER_SALE',
      'id', v_sale.id,
      'folio', coalesce(v_sale.folio, v_sale.temp_folio),
      'cancelled', v_sale.status = 'CANCELLED',
      'totalCents', v_sale.total_cents,
      'paidCents', v_paid,
      -- En una venta de mostrador, la compra es el momento de cobrarla.
      'settledAt', v_sale.issued_at,
      'invoiced', exists (
        select 1 from public.invoice_requests
         where counter_sale_id = v_sale.id and status in ('IN_PROCESS', 'STAMPED')),
      'lines', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'name', l.name, 'quantity', l.quantity, 'lineTotalCents', l.line_total_cents)
               order by l.position)
          from public.counter_sale_lines l where l.counter_sale_id = v_sale.id), '[]'::jsonb)
    );
  end if;

  select * into v_order from public.work_orders where public_code = p_code;
  if found and (v_order.folio = p_folio or v_order.temp_folio = p_folio) then
    select coalesce(sum(amount_cents), 0), max(paid_at) into v_paid, v_settled
      from public.payments where work_order_id = v_order.id;
    return jsonb_build_object(
      'type', 'WORK_ORDER',
      'id', v_order.id,
      'folio', coalesce(v_order.folio, v_order.temp_folio),
      'cancelled', v_order.status = 'CANCELLED',
      'totalCents', v_order.total_cents,
      'paidCents', v_paid,
      -- Un trabajo se liquida con el último pago, siempre que ya cubra el total.
      'settledAt', case when v_paid >= v_order.total_cents then v_settled else null end,
      'invoiced', exists (
        select 1 from public.invoice_requests
         where work_order_id = v_order.id and status in ('IN_PROCESS', 'STAMPED')),
      'lines', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'name', l.name, 'quantity', l.quantity, 'lineTotalCents', l.line_total_cents)
               order by l.position)
          from public.work_order_lines l where l.work_order_id = v_order.id), '[]'::jsonb)
    );
  end if;

  return null;
end;
$$;

revoke all on function public.portal_failure_counts(text, text, integer) from public, anon, authenticated;
revoke all on function public.portal_record_failure(text, text) from public, anon, authenticated;
revoke all on function public.portal_find_document(text, text) from public, anon, authenticated;
grant execute on function public.portal_failure_counts(text, text, integer) to service_role;
grant execute on function public.portal_record_failure(text, text) to service_role;
grant execute on function public.portal_find_document(text, text) to service_role;
