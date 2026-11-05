-- S4-16 · Facturar desde el sistema [RF-M10-04 a RF-M10-08, RN-24, RN-25, ADR-0032].
--
-- Un administrador factura una venta u orden liquidada desde la aplicación. Se reutiliza lo que el portal ya
-- lee de un documento (importes sin IVA, IVA, claves del SAT y con qué se pagó), pero por su identificador y no
-- por el código del QR. La lógica de "qué trae un documento" vive en un solo lugar: `private.invoice_source`.

create or replace function private.invoice_source(p_type text, p_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_sale public.counter_sales%rowtype;
  v_order public.work_orders%rowtype;
  v_paid bigint;
  v_settled timestamptz;
  v_methods jsonb;
begin
  if p_type = 'COUNTER_SALE' then
    select * into v_sale from public.counter_sales where id = p_id;
    if not found then
      return null;
    end if;
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
      -- En una venta de mostrador, la compra es el momento de cobrarla.
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

  if p_type = 'WORK_ORDER' then
    select * into v_order from public.work_orders where id = p_id;
    if not found then
      return null;
    end if;
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
      -- Un trabajo se liquida con el último pago, siempre que ya cubra el total.
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

revoke all on function private.invoice_source(text, uuid) from public, anon, authenticated;

-- El portal ahora solo resuelve el código y el folio; lo que trae el documento sale de `invoice_source`.
create or replace function public.portal_find_document(p_folio text, p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.counter_sales
   where public_code = p_code and (folio = p_folio or temp_folio = p_folio);
  if found then
    return private.invoice_source('COUNTER_SALE', v_id);
  end if;
  select id into v_id from public.work_orders
   where public_code = p_code and (folio = p_folio or temp_folio = p_folio);
  if found then
    return private.invoice_source('WORK_ORDER', v_id);
  end if;
  return null;
end;
$$;

-- Lo que una función de servidor lee para facturar a petición de un administrador (por identificador).
create or replace function public.system_find_invoice_source(p_type text, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.invoice_source(p_type, p_id)
$$;

revoke all on function public.system_find_invoice_source(text, uuid) from public, anon, authenticated;
grant execute on function public.system_find_invoice_source(text, uuid) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Lo que el administrador ve en la pantalla de facturas
-- ---------------------------------------------------------------------------------------------------------

-- Ventas y órdenes liquidadas, sin factura vigente ni en proceso y sin cancelar [RN-25].
create or replace function public.admin_invoice_candidates()
returns table (
  source_type text,
  source_id uuid,
  folio text,
  customer_name text,
  customer_fiscal jsonb,
  total_cents bigint,
  settled_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Solo los administradores ven lo facturable' using errcode = '42501';
  end if;
  return query
  select * from (
    select 'COUNTER_SALE'::text, s.id, coalesce(s.folio, s.temp_folio), c.name,
           case when c.fiscal_rfc is null then null else jsonb_build_object(
             'rfc', c.fiscal_rfc, 'name', c.fiscal_legal_name, 'fiscalZip', c.fiscal_zip,
             'regime', c.fiscal_regime, 'cfdiUse', c.fiscal_cfdi_use) end,
           s.total_cents, s.issued_at
      from public.counter_sales s
      left join public.customers c on c.id = s.customer_id
     where s.status = 'COMPLETED'
       and (select coalesce(sum(amount_cents), 0) from public.payments p where p.counter_sale_id = s.id)
           >= s.total_cents
       and not exists (select 1 from public.invoice_requests r
                        where r.counter_sale_id = s.id and r.status in ('IN_PROCESS', 'STAMPED'))
    union all
    select 'WORK_ORDER'::text, o.id, coalesce(o.folio, o.temp_folio), c.name,
           case when c.fiscal_rfc is null then null else jsonb_build_object(
             'rfc', c.fiscal_rfc, 'name', c.fiscal_legal_name, 'fiscalZip', c.fiscal_zip,
             'regime', c.fiscal_regime, 'cfdiUse', c.fiscal_cfdi_use) end,
           o.total_cents,
           (select max(p.paid_at) from public.payments p where p.work_order_id = o.id)
      from public.work_orders o
      left join public.customers c on c.id = o.customer_id
     where o.status <> 'CANCELLED'
       and (select coalesce(sum(amount_cents), 0) from public.payments p where p.work_order_id = o.id)
           >= o.total_cents
       and not exists (select 1 from public.invoice_requests r
                        where r.work_order_id = o.id and r.status in ('IN_PROCESS', 'STAMPED'))
  ) t
  order by 7 desc nulls last
  limit 200;
end;
$$;

revoke all on function public.admin_invoice_candidates() from public, anon;
grant execute on function public.admin_invoice_candidates() to authenticated;
