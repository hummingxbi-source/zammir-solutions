-- AJ-07 · Entregas por partes [RF-M3-10, ADR-0044, PD-46].
-- Un trabajo que se entrega por partes es una orden por cada parte: al convertir la cotización se eligen las líneas
-- de esa parte y las demás quedan para otra. Cada línea de cotización entra en una sola orden (la línea de la orden
-- conserva su id), así una parte no cobra dos veces lo mismo. Las partes se reconocen por su cotización y la marca
-- `in_parts`; su número (Parte 1, Parte 2…) se calcula por orden de creación en la tablet.

alter table public.work_orders add column in_parts boolean not null default false;
comment on column public.work_orders.in_parts is 'Parte de un trabajo que se entrega por partes [RF-M3-10].';

create or replace function private.apply_create_work_order(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'id')::uuid;
  v_issued_at timestamptz := (p_payload->>'issuedAt')::timestamptz;
  v_quote_id uuid := nullif(p_payload->>'quoteId', '')::uuid;
  v_quote public.quotes;
  v_reason text;
  v_year integer;
  v_number bigint;
  v_folio text;
  v_line jsonb;
  v_position integer := 0;
  -- RF-M3-09: la fecha estimada llega desde la creación. Una orden vieja en cola no la trae y se acepta igual.
  v_delivery date := nullif(p_payload->>'estimatedDeliveryDate', '')::date;
  -- RF-M3-10: una parte de un trabajo que se entrega por partes.
  v_in_parts boolean := coalesce((p_payload->>'inParts')::boolean, false);
  v_line_id uuid;
begin
  if not exists (select 1 from public.customers where id = (p_payload->>'customerId')::uuid) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'CUSTOMER_NOT_FOUND');
  end if;

  if exists (select 1 from public.work_orders where public_code = p_payload->>'publicCode') then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'PUBLIC_CODE_CONFLICT');
  end if;

  if v_quote_id is not null then
    select * into v_quote from public.quotes where id = v_quote_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'QUOTE_NOT_FOUND');
    end if;
    -- La orden ya existe en la tablet: se guarda y se revisa, no se descarta.
    -- Por partes, la cotización se convierte otra vez mientras sus líneas no estén en otra orden [RF-M3-10].
    if v_in_parts then
      if exists (select 1 from public.work_order_lines l
                  where l.id in (select (x->>'id')::uuid from jsonb_array_elements(p_payload->'lines') x)) then
        v_reason := 'QUOTE_LINE_ALREADY_CONVERTED';
      end if;
    elsif v_quote.converted_work_order_id is not null then
      v_reason := 'QUOTE_ALREADY_CONVERTED';
    end if;
    if v_reason is null and v_quote.status <> 'ACCEPTED' then
      v_reason := 'QUOTE_NOT_ACCEPTED';
    end if;
  end if;

  insert into public.work_orders (
    id, temp_folio, public_code, customer_id, quote_id, site_address, description, issued_at,
    subtotal_cents, tax_cents, total_cents, deposit_percent_bps, deposit_required_cents,
    device_id, user_id, op_id, review_reason, change_seq, estimated_delivery_date, in_parts
  ) values (
    v_id, p_payload->>'tempFolio', p_payload->>'publicCode', (p_payload->>'customerId')::uuid,
    v_quote_id, p_payload->>'siteAddress', p_payload->>'description', v_issued_at,
    (p_payload->>'subtotalCents')::bigint, (p_payload->>'taxCents')::bigint,
    (p_payload->>'totalCents')::bigint, (p_payload->>'depositPercentBps')::integer,
    (p_payload->>'depositRequiredCents')::bigint, p_device.id, p_user_id, p_op_id, v_reason, 0, v_delivery,
    v_in_parts
  );

  for v_line in select * from jsonb_array_elements(p_payload->'lines') loop
    v_position := v_position + 1;
    -- La línea conserva el id de la de la cotización; si ya está en otra orden (una parte repetida), entra con
    -- un id nuevo y la orden queda por revisar arriba: así nada choca.
    v_line_id := (v_line->>'id')::uuid;
    if exists (select 1 from public.work_order_lines where id = v_line_id) then
      v_line_id := gen_random_uuid();
    end if;
    insert into public.work_order_lines (
      id, work_order_id, position, product_id, name, charge_unit, unit_price_cents, catalog_price_cents,
      rule_id, rule_params, width_mm, height_mm, quantity, line_total_cents, base_cents, tax_cents,
      is_tax_exempt, detail, display_unit
    ) values (
      v_line_id, v_id, v_position, nullif(v_line->>'productId', '')::uuid,
      v_line->>'name', v_line->>'chargeUnit', (v_line->>'unitPriceCents')::bigint,
      coalesce((v_line->>'catalogPriceCents')::bigint, (v_line->>'unitPriceCents')::bigint),
      v_line->>'ruleId', coalesce(v_line->'ruleParams', '{}'::jsonb),
      nullif(v_line->>'widthMm', '')::integer, nullif(v_line->>'heightMm', '')::integer,
      (v_line->>'quantity')::integer, (v_line->>'lineTotalCents')::bigint,
      (v_line->>'baseCents')::bigint, (v_line->>'taxCents')::bigint,
      coalesce((v_line->>'isTaxExempt')::boolean, false), coalesce(v_line->>'detail', ''),
      nullif(v_line->>'displayUnit', '')
    );
  end loop;

  -- La primera orden se queda como "la" orden de la cotización, como antes.
  if v_quote_id is not null and v_reason is null then
    update public.quotes set converted_work_order_id = coalesce(converted_work_order_id, v_id)
     where id = v_quote_id;
  end if;

  insert into public.work_order_status_events (work_order_id, from_status, to_status, user_id, device_id,
                                               occurred_at, op_id)
  values (v_id, null, 'WAITING', p_user_id, p_device.id, v_issued_at, p_op_id);

  -- El folio es el último paso: el bloqueo de su fila dura lo menos posible.
  v_year := private.folio_year(v_issued_at);
  v_number := private.next_folio('WORK_ORDER', v_year);
  v_folio := 'OT-' || v_year::text || '-' || lpad(v_number::text, 4, '0');
  update public.work_orders set folio = v_folio where id = v_id;

  perform private.add_audit(p_user_id, p_device.id, 'WORK_ORDER_CREATED', 'work_order', v_id::text, null,
    jsonb_build_object('folio', v_folio, 'tempFolio', p_payload->>'tempFolio',
                       'totalCents', (p_payload->>'totalCents')::bigint, 'quoteId', v_quote_id,
                       'fechaEstimadaDeEntrega', v_delivery, 'porPartes', v_in_parts),
    null, p_op_id);

  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason,
                              'folio', v_folio, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_folio, 'documentId', v_id);
end;
$$;
revoke all on function private.apply_create_work_order(uuid, public.devices, uuid, jsonb) from public, anon, authenticated;

create or replace view public.work_orders_for_device as
select
  o.id, o.temp_folio, o.folio, o.public_code, o.status, o.customer_id, o.quote_id, o.site_address,
  o.description, o.issued_at, o.subtotal_cents, o.tax_cents, o.total_cents, o.deposit_percent_bps,
  o.deposit_required_cents, o.measured_by, o.built_by, o.installed_by, o.estimated_delivery_date,
  o.notes, o.delivered_at, o.delivered_with_balance, o.delivery_reason, o.delivery_authorized_by,
  o.cancelled_at, o.cancel_reason, o.cancelled_by, o.cancelled_from_status, o.cancel_deposit_paid_cents,
  o.user_id, o.review_reason, o.change_seq,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'productId', l.product_id, 'name', l.name, 'chargeUnit', l.charge_unit,
      'unitPriceCents', l.unit_price_cents, 'catalogPriceCents', l.catalog_price_cents,
      'ruleId', l.rule_id, 'ruleParams', l.rule_params, 'widthMm', l.width_mm, 'heightMm', l.height_mm,
      'quantity', l.quantity, 'lineTotalCents', l.line_total_cents, 'baseCents', l.base_cents,
      'taxCents', l.tax_cents, 'isTaxExempt', l.is_tax_exempt, 'detail', l.detail,
      'displayUnit', l.display_unit) order by l.position)
    from public.work_order_lines l where l.work_order_id = o.id
  ), '[]'::jsonb) as lines,
       o.in_parts
from public.work_orders o
where (select private.is_admin()) or (select private.is_device());
revoke all on public.work_orders_for_device from anon, authenticated;
grant select on public.work_orders_for_device to authenticated;
