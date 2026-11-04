-- S4-19 · Pedir y descargar la factura desde el portal [RF-M10-12 a RF-M10-14, RN-24, RN-15, ADR-0030].
--
-- Se guardan el timbre con sus archivos y los datos del receptor (la factura es un registro fiscal que se
-- conserva, igual que lo contable [RN-18]). El folio `F-AAAA-0001` lo asigna la base, sin huecos, al guardar
-- el timbre. Todo se hace con funciones que solo ejecuta el rol de servicio.

alter table public.invoice_requests
  add column recipient jsonb,
  add column payment_form text check (payment_form in ('01', '03')),
  add column xml text,
  add column pdf_base64 text,
  add column stamped_at timestamptz,
  -- Versión del aviso de privacidad vigente cuando el cliente aceptó, con la transferencia al PAC [RF-M9-05].
  add column privacy_notice_version integer check (privacy_notice_version >= 1);

comment on column public.invoice_requests.recipient is
  'Datos fiscales del receptor tal como los capturó (RFC, nombre, código postal, régimen y uso de CFDI).';

-- ---------------------------------------------------------------------------------------------------------
-- La búsqueda del portal ahora trae también lo necesario para facturar: importes sin IVA, IVA, claves del SAT
-- (del producto o, si no tiene, de su categoría) y cómo se pagó. Sigue siendo solo para el rol de servicio.
-- ---------------------------------------------------------------------------------------------------------
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
  v_methods jsonb;
begin
  select * into v_sale from public.counter_sales where public_code = p_code;
  if found and (v_sale.folio = p_folio or v_sale.temp_folio = p_folio) then
    select coalesce(sum(amount_cents), 0),
           coalesce(jsonb_agg(distinct method), '[]'::jsonb)
      into v_paid, v_methods
      from public.payments where counter_sale_id = v_sale.id;
    return jsonb_build_object(
      'type', 'COUNTER_SALE',
      'id', v_sale.id,
      'folio', coalesce(v_sale.folio, v_sale.temp_folio),
      'cancelled', v_sale.status = 'CANCELLED',
      'totalCents', v_sale.total_cents,
      'paidCents', v_paid,
      'settledAt', v_sale.issued_at,
      'invoiced', exists (
        select 1 from public.invoice_requests
         where counter_sale_id = v_sale.id and status in ('IN_PROCESS', 'STAMPED')),
      'paymentMethods', v_methods,
      'lines', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'name', l.name,
                 'quantity', l.quantity,
                 'lineTotalCents', l.line_total_cents,
                 'baseCents', l.base_cents,
                 'taxCents', l.tax_cents,
                 'productServiceKey', coalesce(p.fiscal_product_service_key, c.fiscal_product_service_key),
                 'unitKey', coalesce(p.fiscal_unit_key, c.fiscal_unit_key),
                 'taxObject', coalesce(p.fiscal_tax_object, c.fiscal_tax_object))
               order by l.position)
          from public.counter_sale_lines l
          left join public.products p on p.id = l.product_id
          left join public.product_categories c on c.id = p.category_id
         where l.counter_sale_id = v_sale.id), '[]'::jsonb)
    );
  end if;

  select * into v_order from public.work_orders where public_code = p_code;
  if found and (v_order.folio = p_folio or v_order.temp_folio = p_folio) then
    select coalesce(sum(amount_cents), 0), max(paid_at),
           coalesce(jsonb_agg(distinct method), '[]'::jsonb)
      into v_paid, v_settled, v_methods
      from public.payments where work_order_id = v_order.id;
    return jsonb_build_object(
      'type', 'WORK_ORDER',
      'id', v_order.id,
      'folio', coalesce(v_order.folio, v_order.temp_folio),
      'cancelled', v_order.status = 'CANCELLED',
      'totalCents', v_order.total_cents,
      'paidCents', v_paid,
      'settledAt', case when v_paid >= v_order.total_cents then v_settled else null end,
      'invoiced', exists (
        select 1 from public.invoice_requests
         where work_order_id = v_order.id and status in ('IN_PROCESS', 'STAMPED')),
      'paymentMethods', v_methods,
      'lines', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'name', l.name,
                 'quantity', l.quantity,
                 'lineTotalCents', l.line_total_cents,
                 'baseCents', l.base_cents,
                 'taxCents', l.tax_cents,
                 'productServiceKey', coalesce(p.fiscal_product_service_key, c.fiscal_product_service_key),
                 'unitKey', coalesce(p.fiscal_unit_key, c.fiscal_unit_key),
                 'taxObject', coalesce(p.fiscal_tax_object, c.fiscal_tax_object))
               order by l.position)
          from public.work_order_lines l
          left join public.products p on p.id = l.product_id
          left join public.product_categories c on c.id = p.category_id
         where l.work_order_id = v_order.id), '[]'::jsonb)
    );
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Abrir la solicitud: una operación, una factura vigente [RN-24]
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.portal_invoice_begin(
  p_request_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_channel text
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
    insert into public.invoice_requests (request_id, work_order_id, counter_sale_id, channel)
    values (
      p_request_id,
      case when p_source_type = 'WORK_ORDER' then p_source_id end,
      case when p_source_type = 'COUNTER_SALE' then p_source_id end,
      p_channel);
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

-- ---------------------------------------------------------------------------------------------------------
-- Guardar el timbre: asigna el folio F-AAAA-0001 (año de México) y deja los archivos
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.portal_invoice_mark_stamped(
  p_request_id uuid,
  p_uuid text,
  p_stamped_at timestamptz,
  p_recipient jsonb,
  p_payment_form text,
  p_xml text,
  p_pdf_base64 text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.invoice_requests%rowtype;
  v_year integer;
  v_folio text;
begin
  select * into v_row from public.invoice_requests where request_id = p_request_id for update;
  if not found then
    raise exception 'INVOICE_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Idempotente: si ya se guardó, devuelve su folio y no asigna otro.
  if v_row.status = 'STAMPED' then
    return v_row.invoice_folio;
  end if;

  v_year := extract(year from (p_stamped_at at time zone 'America/Mexico_City'))::integer;
  v_folio := 'F-' || v_year::text || '-' || lpad(private.next_folio('INVOICE', v_year)::text, 4, '0');

  update public.invoice_requests
     set status = 'STAMPED',
         invoice_uuid = p_uuid,
         invoice_folio = v_folio,
         stamped_at = p_stamped_at,
         recipient = p_recipient,
         payment_form = p_payment_form,
         xml = p_xml,
         pdf_base64 = p_pdf_base64,
         privacy_notice_version = (
           select max(version) from public.legal_documents
            where type = 'PRIVACY_NOTICE' and effective_from <= now())
   where request_id = p_request_id;
  return v_folio;
end;
$$;

create or replace function public.portal_invoice_mark_failed(p_request_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.invoice_requests set status = 'FAILED'
   where request_id = p_request_id and status = 'IN_PROCESS';
$$;

-- Los archivos de la factura vigente de una venta u orden.
create or replace function public.portal_invoice_files(p_source_type text, p_source_id uuid)
returns table (invoice_folio text, invoice_uuid text, xml text, pdf_base64 text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.invoice_folio, r.invoice_uuid, r.xml, r.pdf_base64
    from public.invoice_requests r
   where r.status = 'STAMPED'
     and ((p_source_type = 'WORK_ORDER' and r.work_order_id = p_source_id)
       or (p_source_type = 'COUNTER_SALE' and r.counter_sale_id = p_source_id))
$$;

revoke all on function public.portal_find_document(text, text) from public, anon, authenticated;
revoke all on function public.portal_invoice_begin(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.portal_invoice_mark_stamped(uuid, text, timestamptz, jsonb, text, text, text)
  from public, anon, authenticated;
revoke all on function public.portal_invoice_mark_failed(uuid) from public, anon, authenticated;
revoke all on function public.portal_invoice_files(text, uuid) from public, anon, authenticated;
grant execute on function public.portal_find_document(text, text) to service_role;
grant execute on function public.portal_invoice_begin(uuid, text, uuid, text) to service_role;
grant execute on function public.portal_invoice_mark_stamped(uuid, text, timestamptz, jsonb, text, text, text)
  to service_role;
grant execute on function public.portal_invoice_mark_failed(uuid) to service_role;
grant execute on function public.portal_invoice_files(text, uuid) to service_role;
