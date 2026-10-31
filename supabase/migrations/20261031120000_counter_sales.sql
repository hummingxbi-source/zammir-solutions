-- S3-11 a S3-15 · Ventas de mostrador [RF-M4-01 a RF-M4-07, RN-09, RN-10, RN-11, RN-18, RN-19].
--
-- Una venta de mostrador entra por UNA operación (`CreateCounterSale`) que trae sus líneas y el cobro
-- completo: la venta y sus pagos se guardan en la misma transacción, con el usuario, el dispositivo y la
-- hora de quien cobró [RN-11]. Se paga completa: no hay anticipo ni saldo en el mostrador [RF-M4-02].
-- Cancelar (`CancelCounterSale`) es de un administrador, con motivo y bitácora. Nada se borra [RN-18].
-- PD-24 sin respuesta: la cancelación se registra; no hay regla automática sobre la caja.

create sequence public.counter_sale_change_seq;

create function private.stamp_counter_sale_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.change_seq := nextval('public.counter_sale_change_seq');
  return new;
end;
$$;

create table public.counter_sales (
  id uuid primary key,
  temp_folio text not null check (temp_folio ~ '^T[0-9]+-[0-9]+$'),
  folio text unique check (folio ~ '^V-[0-9]{4}-[0-9]{4,}$'),
  public_code text not null unique check (public_code ~ '^[A-Z2-9]{8}$'),
  status text not null default 'COMPLETED' check (status in ('COMPLETED', 'CANCELLED')),
  customer_id uuid references public.customers (id),
  issued_at timestamptz not null,
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  cancelled_at timestamptz,
  cancel_reason text,
  cancelled_by uuid,
  cash_shift_id uuid,
  device_id uuid not null references public.devices (id),
  user_id uuid not null,
  op_id uuid not null,
  review_reason text,
  change_seq bigint not null,
  created_at timestamptz not null default now(),
  check (total_cents = subtotal_cents + tax_cents)
);

create unique index counter_sales_change_seq_idx on public.counter_sales (change_seq);
create index counter_sales_issued_idx on public.counter_sales (issued_at);
create trigger counter_sales_stamp_change
  before insert or update on public.counter_sales
  for each row execute function private.stamp_counter_sale_change();

create table public.counter_sale_lines (
  id uuid primary key,
  counter_sale_id uuid not null references public.counter_sales (id),
  position integer not null check (position >= 1),
  product_id uuid,
  name text not null check (length(btrim(name)) > 0),
  charge_unit text not null check (charge_unit in ('SQUARE_METER', 'LINEAR_METER', 'PIECE', 'SERVICE')),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  catalog_price_cents bigint check (catalog_price_cents >= 0),
  rule_id text not null,
  rule_params jsonb not null default '{}'::jsonb,
  width_mm integer check (width_mm > 0),
  height_mm integer check (height_mm > 0),
  quantity integer not null check (quantity >= 1),
  line_total_cents bigint not null check (line_total_cents >= 0),
  base_cents bigint not null check (base_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  is_tax_exempt boolean not null default false,
  detail text not null default '',
  display_unit text check (display_unit in ('cm', 'm')),
  unique (counter_sale_id, position),
  check (line_total_cents = base_cents + tax_cents)
);
create index counter_sale_lines_sale_idx on public.counter_sale_lines (counter_sale_id);

-- Los pagos de una venta apuntan a ella.
alter table public.payments
  add constraint payments_counter_sale_fk foreign key (counter_sale_id)
  references public.counter_sales (id);

alter table public.counter_sales enable row level security;
alter table public.counter_sale_lines enable row level security;
create policy "solo administradores leen las ventas" on public.counter_sales
  for select to authenticated using ((select private.is_admin()));
create policy "solo administradores leen las líneas de venta" on public.counter_sale_lines
  for select to authenticated using ((select private.is_admin()));
revoke all on public.counter_sales, public.counter_sale_lines from anon, authenticated;
grant select on public.counter_sales, public.counter_sale_lines to authenticated;

create view public.counter_sales_for_device as
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
      'displayUnit', l.display_unit) order by l.position)
    from public.counter_sale_lines l where l.counter_sale_id = s.id
  ), '[]'::jsonb) as lines
from public.counter_sales s
where (select private.is_admin()) or (select private.is_device());
revoke all on public.counter_sales_for_device from anon, authenticated;
grant select on public.counter_sales_for_device to authenticated;

create function private.apply_create_counter_sale(
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
  if exists (select 1 from public.counter_sales where public_code = p_payload->>'publicCode') then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'PUBLIC_CODE_CONFLICT');
  end if;

  insert into public.counter_sales (
    id, temp_folio, public_code, customer_id, issued_at, subtotal_cents, tax_cents, total_cents,
    device_id, user_id, op_id, change_seq
  ) values (
    v_id, p_payload->>'tempFolio', p_payload->>'publicCode', v_customer, v_issued_at,
    (p_payload->>'subtotalCents')::bigint, (p_payload->>'taxCents')::bigint, v_total,
    p_device.id, p_user_id, p_op_id, 0
  );

  for v_line in select * from jsonb_array_elements(p_payload->'lines') loop
    v_position := v_position + 1;
    insert into public.counter_sale_lines (
      id, counter_sale_id, position, product_id, name, charge_unit, unit_price_cents, catalog_price_cents,
      rule_id, rule_params, width_mm, height_mm, quantity, line_total_cents, base_cents, tax_cents,
      is_tax_exempt, detail, display_unit
    ) values (
      (v_line->>'id')::uuid, v_id, v_position, nullif(v_line->>'productId', '')::uuid,
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

  -- El cobro: una fila por forma de pago, del mismo grupo [RN-10]. El dinero recibido nunca se rechaza.
  for v_row in select * from jsonb_array_elements(p_payload#>'{payment,rows}') loop
    v_paid := v_paid + (v_row->>'amountCents')::bigint;
    insert into public.payments (
      id, group_id, counter_sale_id, kind, method, amount_cents, cash_received_cents, change_cents,
      reference, user_id, device_id, paid_at, op_id
    ) values (
      (v_row->>'id')::uuid, (p_payload#>>'{payment,groupId}')::uuid, v_id, 'SALE', v_row->>'method',
      (v_row->>'amountCents')::bigint, nullif(v_row->>'cashReceivedCents', '')::bigint,
      case when v_row->>'method' = 'CASH'
           then (v_row->>'cashReceivedCents')::bigint - (v_row->>'amountCents')::bigint end,
      nullif(v_row->>'reference', ''), p_user_id, p_device.id, v_issued_at, p_op_id
    );
  end loop;
  if v_paid <> v_total then
    v_reason := 'PAYMENT_NOT_EQUAL_TOTAL';
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

create function private.apply_cancel_counter_sale(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_authorized_by uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'id')::uuid;
  v_sale public.counter_sales;
  v_text text := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  v_reason text;
  v_admin boolean;
begin
  select * into v_sale from public.counter_sales where id = v_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'SALE_NOT_FOUND');
  end if;
  if v_sale.status = 'CANCELLED' then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'INVALID_TRANSITION',
                              'folio', v_sale.folio, 'documentId', v_id);
  end if;

  select exists (select 1 from public.app_users where id = coalesce(p_authorized_by, p_user_id)
                   and role = 'ADMIN' and is_active) into v_admin;
  if not v_admin or v_text is null then
    v_reason := 'CANCEL_WITHOUT_AUTHORIZATION';
  end if;

  update public.counter_sales
     set status = 'CANCELLED', cancelled_at = now(), cancel_reason = v_text, cancelled_by = p_user_id
   where id = v_id;
  perform private.add_audit(p_user_id, p_device.id, 'COUNTER_SALE_CANCELLED', 'counter_sale', v_id::text,
    jsonb_build_object('estado', v_sale.status),
    jsonb_build_object('estado', 'CANCELLED', 'motivo', v_text, 'totalCentavos', v_sale.total_cents),
    p_authorized_by, p_op_id);

  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason,
                              'folio', v_sale.folio, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_sale.folio, 'documentId', v_id);
end;
$$;

revoke all on function private.apply_create_counter_sale(uuid, public.devices, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.apply_cancel_counter_sale(uuid, public.devices, uuid, uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.receive_operation(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op_id uuid := (p->>'opId')::uuid;
  v_device_id uuid := (p->>'deviceId')::uuid;
  v_seq bigint := (p->>'seq')::bigint;
  v_type text := p->>'type';
  v_user_id uuid := nullif(p->>'userId', '')::uuid;
  v_authorized_by uuid := nullif(p->>'authorizedBy', '')::uuid;
  v_payload jsonb := p->'payload';
  v_device public.devices;
  v_existing jsonb;
  v_result jsonb;
  v_status text;
  v_reason text;
begin
  select * into v_device
    from public.devices
   where id = v_device_id and auth_user_id = (select auth.uid()) and status = 'ACTIVE'
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'DEVICE_REVOKED');
  end if;

  select result into v_existing from public.operations where op_id = v_op_id;
  if found then
    return v_existing;
  end if;

  if v_seq <> v_device.last_seq + 1 then
    return jsonb_build_object('ok', false, 'code', 'OUT_OF_ORDER', 'expectedSeq', v_device.last_seq + 1);
  end if;

  v_status := 'APPLIED';
  if v_user_id is null or not exists (
       select 1 from public.app_users where id = v_user_id and is_active
     ) then
    v_status := 'TO_REVIEW';
    v_reason := 'USER_INACTIVE';
  end if;

  case v_type
    when 'IssueQuote' then
      v_result := private.apply_issue_quote(v_op_id, v_device, v_user_id, v_authorized_by, v_payload);
    when 'MarkQuoteAccepted' then
      v_result := private.apply_mark_quote(v_op_id, v_device, v_user_id, v_payload, 'ACCEPTED');
    when 'MarkQuoteRejected' then
      v_result := private.apply_mark_quote(v_op_id, v_device, v_user_id, v_payload, 'REJECTED');
    when 'UpsertCustomer' then
      v_result := private.apply_upsert_customer(v_op_id, v_device, v_user_id, v_payload);
    when 'CreateWorkOrder' then
      v_result := private.apply_create_work_order(v_op_id, v_device, v_user_id, v_payload);
    when 'UpdateWorkOrder' then
      v_result := private.apply_update_work_order(v_op_id, v_device, v_user_id, v_payload);
    when 'AdvanceWorkOrder' then
      v_result := private.apply_advance_work_order(v_op_id, v_device, v_user_id, v_authorized_by, v_payload);
    when 'DeliverWorkOrder' then
      v_result := private.apply_deliver_work_order(v_op_id, v_device, v_user_id, v_authorized_by, v_payload);
    when 'CancelWorkOrder' then
      v_result := private.apply_cancel_work_order(v_op_id, v_device, v_user_id, v_authorized_by, v_payload);
    when 'RegisterPayment' then
      v_result := private.apply_register_payment(v_op_id, v_device, v_user_id, v_payload);
    when 'CreateCounterSale' then
      v_result := private.apply_create_counter_sale(v_op_id, v_device, v_user_id, v_payload);
    when 'CancelCounterSale' then
      v_result := private.apply_cancel_counter_sale(v_op_id, v_device, v_user_id, v_authorized_by, v_payload);
    else
      return jsonb_build_object('ok', false, 'code', 'UNKNOWN_TYPE');
  end case;

  if not (v_result->>'ok')::boolean then
    return v_result;
  end if;
  if v_result->>'status' = 'TO_REVIEW' then
    v_status := 'TO_REVIEW';
    v_reason := coalesce(v_result->>'reason', v_reason);
  end if;

  v_result := v_result || jsonb_build_object('status', v_status)
              || case when v_reason is null then '{}'::jsonb else jsonb_build_object('reason', v_reason) end;

  insert into public.operations (
    op_id, device_id, seq, type, schema_version, payload, user_id, authorized_by,
    client_created_at, status, reason, result
  ) values (
    v_op_id, v_device_id, v_seq, v_type, (p->>'schemaVersion')::integer, v_payload, v_user_id,
    v_authorized_by, (p->>'clientCreatedAt')::timestamptz, v_status, v_reason, v_result
  );

  update public.devices set last_seq = v_seq, last_sent_at = now() where id = v_device_id;

  return v_result;
end;
$$;
