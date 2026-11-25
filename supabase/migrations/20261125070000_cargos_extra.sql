-- AJ-09 · Cargos extra ligados a la línea [RF-M1-09, RN-02, ADR-0044, PD-02].
-- Los cantos, perforaciones, biselados y similares son productos de tipo "Cargo extra" (EXTRA) que se agregan a una
-- línea de vidrio y se cobran con la medida de esa línea según su propia regla (m², metro lineal o pieza). Su importe
-- ya viene sumado en la línea (base + IVA = total sigue igual), así que los totales, las revisiones y la factura no
-- cambian: aquí solo se guarda el detalle de los extras en cada línea y viaja a la tablet.

-- Un nuevo tipo de producto: EXTRA, con m², metro lineal o pieza.
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.products'::regclass and contype = 'c'
       and (pg_get_constraintdef(oid) like '%kind = %' or pg_get_constraintdef(oid) like '%kind = ANY%')
  loop
    execute format('alter table public.products drop constraint %I', r.conname);
  end loop;
end;
$$;
alter table public.products add constraint products_kind_valid
  check (kind in ('CUSTOM', 'STANDARD', 'SERVICE', 'EXTRA'));
alter table public.products add constraint products_kind_unit
  check (
    (kind = 'CUSTOM' and charge_unit in ('SQUARE_METER', 'LINEAR_METER', 'PIECE'))
    or (kind = 'STANDARD' and charge_unit = 'PIECE')
    or (kind = 'SERVICE' and charge_unit = 'SERVICE')
    or (kind = 'EXTRA' and charge_unit in ('SQUARE_METER', 'LINEAR_METER', 'PIECE'))
  );

-- El detalle de los cargos extra de cada línea (un arreglo; vacío en las líneas de antes).
alter table public.quote_lines
  add column extras jsonb not null default '[]'::jsonb check (jsonb_typeof(extras) = 'array');
alter table public.work_order_lines
  add column extras jsonb not null default '[]'::jsonb check (jsonb_typeof(extras) = 'array');
alter table public.counter_sale_lines
  add column extras jsonb not null default '[]'::jsonb check (jsonb_typeof(extras) = 'array');

create or replace function private.apply_issue_quote(
  p_op_id uuid,
  p_device public.devices,
  p_user_id uuid,
  p_authorized_by uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_quote_id uuid := (p_payload->>'id')::uuid;
  v_issued_at timestamptz := (p_payload->>'issuedAt')::timestamptz;
  v_year integer;
  v_number bigint;
  v_folio text;
  v_line jsonb;
  v_position integer := 0;
  v_unit bigint;
  v_catalog bigint;
  v_discount boolean := false;
begin
  if not exists (select 1 from public.customers where id = (p_payload->>'customerId')::uuid) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'CUSTOMER_NOT_FOUND');
  end if;

  if exists (select 1 from public.quotes where public_code = p_payload->>'publicCode') then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'PUBLIC_CODE_CONFLICT');
  end if;

  insert into public.quotes (
    id, temp_folio, public_code, customer_id, site_address, issued_at, valid_until,
    conditions_text, privacy_notice_version, subtotal_cents, tax_cents, total_cents,
    catalog_version, device_id, user_id, authorized_by, op_id
  ) values (
    v_quote_id, p_payload->>'tempFolio', p_payload->>'publicCode',
    (p_payload->>'customerId')::uuid, p_payload->>'siteAddress', v_issued_at,
    (p_payload->>'validUntil')::date, p_payload->>'conditionsText',
    nullif(p_payload->>'privacyNoticeVersion', '')::integer,
    (p_payload->>'subtotalCents')::bigint, (p_payload->>'taxCents')::bigint,
    (p_payload->>'totalCents')::bigint, nullif(p_payload->>'catalogVersion', '')::bigint,
    p_device.id, p_user_id, p_authorized_by, p_op_id
  );

  for v_line in select * from jsonb_array_elements(p_payload->'lines') loop
    v_position := v_position + 1;
    v_unit := (v_line->>'unitPriceCents')::bigint;
    v_catalog := coalesce((v_line->>'catalogPriceCents')::bigint, v_unit);
    insert into public.quote_lines (
      id, quote_id, position, product_id, name, charge_unit, unit_price_cents, catalog_price_cents,
      rule_id, rule_params, width_mm, height_mm, quantity, line_total_cents, base_cents, tax_cents,
      is_tax_exempt, detail, extras
    ) values (
      (v_line->>'id')::uuid, v_quote_id, v_position, nullif(v_line->>'productId', '')::uuid,
      v_line->>'name', v_line->>'chargeUnit', v_unit, v_catalog,
      v_line->>'ruleId', coalesce(v_line->'ruleParams', '{}'::jsonb),
      nullif(v_line->>'widthMm', '')::integer, nullif(v_line->>'heightMm', '')::integer,
      (v_line->>'quantity')::integer, (v_line->>'lineTotalCents')::bigint,
      (v_line->>'baseCents')::bigint, (v_line->>'taxCents')::bigint,
      coalesce((v_line->>'isTaxExempt')::boolean, false), coalesce(v_line->>'detail', ''),
      coalesce(v_line->'extras', '[]'::jsonb)
    );

    -- Descuento: bitácora con el precio anterior y el nuevo [RN-19].
    if v_unit < v_catalog then
      v_discount := true;
      insert into public.audit_log (id, occurred_at, user_id, device_id, action, entity_type, entity_id,
                                    old_value, new_value, authorized_by, op_id)
      values (gen_random_uuid(), v_issued_at, p_user_id, p_device.id, 'QUOTE_LINE_PRICE_CHANGED',
              'quote_line', v_line->>'id',
              jsonb_build_object('precio_centavos', v_catalog),
              jsonb_build_object('precio_centavos', v_unit, 'cotizacion', v_quote_id),
              p_authorized_by, p_op_id);
    end if;
  end loop;

  -- El folio es el último paso: el bloqueo de su fila dura lo menos posible.
  v_year := private.folio_year(v_issued_at);
  v_number := private.next_folio('QUOTE', v_year);
  v_folio := 'COT-' || v_year::text || '-' || lpad(v_number::text, 4, '0');
  update public.quotes set folio = v_folio where id = v_quote_id;

  insert into public.audit_log (id, occurred_at, user_id, device_id, action, entity_type, entity_id,
                                new_value, authorized_by, op_id)
  values (gen_random_uuid(), v_issued_at, p_user_id, p_device.id, 'QUOTE_ISSUED', 'quote',
          v_quote_id::text,
          jsonb_build_object('folio', v_folio, 'tempFolio', p_payload->>'tempFolio',
                             'totalCents', (p_payload->>'totalCents')::bigint),
          p_authorized_by, p_op_id);

  -- Un descuento sin quien lo autorice no se rechaza (ya se dio al cliente): se revisa.
  if v_discount and p_authorized_by is null then
    return jsonb_build_object(
      'ok', true, 'status', 'TO_REVIEW', 'reason', 'DISCOUNT_WITHOUT_AUTHORIZATION',
      'folio', v_folio, 'documentId', v_quote_id
    );
  end if;

  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_folio, 'documentId', v_quote_id);
end;
$$;
revoke all on function private.apply_issue_quote(uuid, public.devices, uuid, uuid, jsonb) from public, anon, authenticated;

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
      is_tax_exempt, detail, display_unit, extras
    ) values (
      v_line_id, v_id, v_position, nullif(v_line->>'productId', '')::uuid,
      v_line->>'name', v_line->>'chargeUnit', (v_line->>'unitPriceCents')::bigint,
      coalesce((v_line->>'catalogPriceCents')::bigint, (v_line->>'unitPriceCents')::bigint),
      v_line->>'ruleId', coalesce(v_line->'ruleParams', '{}'::jsonb),
      nullif(v_line->>'widthMm', '')::integer, nullif(v_line->>'heightMm', '')::integer,
      (v_line->>'quantity')::integer, (v_line->>'lineTotalCents')::bigint,
      (v_line->>'baseCents')::bigint, (v_line->>'taxCents')::bigint,
      coalesce((v_line->>'isTaxExempt')::boolean, false), coalesce(v_line->>'detail', ''),
      nullif(v_line->>'displayUnit', ''),
      coalesce(v_line->'extras', '[]'::jsonb)
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

create or replace function private.apply_create_counter_sale(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'id')::uuid;
  v_issued_at timestamptz := (p_payload->>'issuedAt')::timestamptz;
  v_customer uuid := nullif(p_payload->>'customerId', '')::uuid;
  v_total bigint := (p_payload->>'totalCents')::bigint;
  v_shift uuid := nullif(p_payload->>'cashShiftId', '')::uuid;
  v_line jsonb;
  v_row jsonb;
  v_position integer := 0;
  v_paid bigint := 0;
  v_reason text;
  v_year integer;
  v_number bigint;
  v_folio text;
begin
  if v_customer is not null and not exists (select 1 from public.customers where id = v_customer) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'CUSTOMER_NOT_FOUND');
  end if;
  if v_shift is not null and not exists (select 1 from public.cash_shifts where id = v_shift) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'SHIFT_NOT_FOUND');
  end if;
  if exists (select 1 from public.counter_sales where public_code = p_payload->>'publicCode') then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'PUBLIC_CODE_CONFLICT');
  end if;

  insert into public.counter_sales (
    id, temp_folio, public_code, customer_id, issued_at, subtotal_cents, tax_cents, total_cents,
    cash_shift_id, device_id, user_id, op_id, change_seq
  ) values (
    v_id, p_payload->>'tempFolio', p_payload->>'publicCode', v_customer, v_issued_at,
    (p_payload->>'subtotalCents')::bigint, (p_payload->>'taxCents')::bigint, v_total,
    v_shift, p_device.id, p_user_id, p_op_id, 0
  );

  for v_line in select * from jsonb_array_elements(p_payload->'lines') loop
    v_position := v_position + 1;
    insert into public.counter_sale_lines (
      id, counter_sale_id, position, product_id, name, charge_unit, unit_price_cents, catalog_price_cents,
      rule_id, rule_params, width_mm, height_mm, quantity, line_total_cents, base_cents, tax_cents,
      is_tax_exempt, detail, display_unit, extras
    ) values (
      (v_line->>'id')::uuid, v_id, v_position, nullif(v_line->>'productId', '')::uuid,
      v_line->>'name', v_line->>'chargeUnit', (v_line->>'unitPriceCents')::bigint,
      coalesce((v_line->>'catalogPriceCents')::bigint, (v_line->>'unitPriceCents')::bigint),
      v_line->>'ruleId', coalesce(v_line->'ruleParams', '{}'::jsonb),
      nullif(v_line->>'widthMm', '')::integer, nullif(v_line->>'heightMm', '')::integer,
      (v_line->>'quantity')::integer, (v_line->>'lineTotalCents')::bigint,
      (v_line->>'baseCents')::bigint, (v_line->>'taxCents')::bigint,
      coalesce((v_line->>'isTaxExempt')::boolean, false), coalesce(v_line->>'detail', ''),
      nullif(v_line->>'displayUnit', ''),
      coalesce(v_line->'extras', '[]'::jsonb)
    );
  end loop;

  for v_row in select * from jsonb_array_elements(p_payload#>'{payment,rows}') loop
    v_paid := v_paid + (v_row->>'amountCents')::bigint;
    insert into public.payments (
      id, group_id, counter_sale_id, kind, method, amount_cents, cash_received_cents, change_cents,
      reference, user_id, device_id, paid_at, cash_shift_id, op_id
    ) values (
      (v_row->>'id')::uuid, (p_payload#>>'{payment,groupId}')::uuid, v_id, 'SALE', v_row->>'method',
      (v_row->>'amountCents')::bigint, nullif(v_row->>'cashReceivedCents', '')::bigint,
      case when v_row->>'method' = 'CASH'
           then (v_row->>'cashReceivedCents')::bigint - (v_row->>'amountCents')::bigint end,
      nullif(v_row->>'reference', ''), p_user_id, p_device.id, v_issued_at, v_shift, p_op_id
    );
  end loop;
  if v_paid <> v_total then
    v_reason := 'PAYMENT_NOT_EQUAL_TOTAL';
  elsif v_shift is not null and exists (select 1 from public.cash_shifts where id = v_shift and status = 'CLOSED') then
    v_reason := 'SHIFT_CLOSED';
  end if;
  if v_reason is not null then
    update public.counter_sales set review_reason = v_reason where id = v_id;
  end if;

  v_year := private.folio_year(v_issued_at);
  v_number := private.next_folio('COUNTER_SALE', v_year);
  v_folio := 'V-' || v_year::text || '-' || lpad(v_number::text, 4, '0');
  update public.counter_sales set folio = v_folio where id = v_id;

  perform private.add_audit(p_user_id, p_device.id, 'COUNTER_SALE_CREATED', 'counter_sale', v_id::text, null,
    jsonb_build_object('folio', v_folio, 'tempFolio', p_payload->>'tempFolio', 'totalCents', v_total,
                       'cobradoCentavos', v_paid), null, p_op_id);

  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason,
                              'folio', v_folio, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_folio, 'documentId', v_id);
end;
$$;
revoke all on function private.apply_create_counter_sale(uuid, public.devices, uuid, jsonb) from public, anon, authenticated;

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
      'displayUnit', l.display_unit, 'extras', l.extras) order by l.position)
    from public.work_order_lines l where l.work_order_id = o.id
  ), '[]'::jsonb) as lines,
       o.in_parts
from public.work_orders o
where (select private.is_admin()) or (select private.is_device());
revoke all on public.work_orders_for_device from anon, authenticated;
grant select on public.work_orders_for_device to authenticated;

create or replace view public.counter_sales_for_device as
select
  s.id, s.temp_folio, s.folio, s.public_code, s.status, s.customer_id, s.issued_at, s.subtotal_cents,
  s.tax_cents, s.total_cents, s.cancelled_at, s.cancel_reason, s.cancelled_by, s.user_id, s.review_reason,
  s.change_seq,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'productId', l.product_id, 'name', l.name, 'chargeUnit', l.charge_unit,
      'unitPriceCents', l.unit_price_cents, 'catalogPriceCents', l.catalog_price_cents,
      'ruleId', l.rule_id, 'ruleParams', l.rule_params, 'widthMm', l.width_mm, 'heightMm', l.height_mm,
      'quantity', l.quantity, 'lineTotalCents', l.line_total_cents, 'baseCents', l.base_cents,
      'taxCents', l.tax_cents, 'isTaxExempt', l.is_tax_exempt, 'detail', l.detail,
      'displayUnit', l.display_unit, 'extras', l.extras) order by l.position)
    from public.counter_sale_lines l where l.counter_sale_id = s.id
  ), '[]'::jsonb) as lines,
  s.cash_shift_id
from public.counter_sales s
where (select private.is_admin()) or (select private.is_device());
revoke all on public.counter_sales_for_device from anon, authenticated;
grant select on public.counter_sales_for_device to authenticated;
