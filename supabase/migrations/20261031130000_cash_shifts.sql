-- S3-16 a S3-19 · Turno de caja y corte [RF-M4-06, RN-11, RN-17, RN-18, RN-19, SINCRONIZACION.md §6.1].
--
-- Un turno es de UNA persona (PD-36 sin respuesta: turno por cajero) y se abre con un fondo inicial
-- opcional. Todo cobro se liga al turno abierto de quien cobra. Al cerrarlo, la tablet manda lo que contó
-- y lo que esperaba; el servidor RECALCULA el efectivo esperado con los pagos del turno y, si no coincide,
-- deja el corte "por revisar" sin perder nada. Un corte cerrado no se edita: solo un administrador lo
-- reabre, con motivo y bitácora. Las ventas canceladas salen del cobro del turno (PD-24).

create sequence public.cash_shift_change_seq;

create function private.stamp_cash_shift_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.change_seq := nextval('public.cash_shift_change_seq');
  return new;
end;
$$;

create table public.cash_shifts (
  id uuid primary key,
  user_id uuid not null,
  device_id uuid not null references public.devices (id),
  opened_at timestamptz not null,
  -- Día del negocio al que pertenece el turno: el de su apertura, en hora de México [RN-17].
  business_day date not null,
  opening_float_cents bigint not null default 0 check (opening_float_cents >= 0),
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  closed_at timestamptz,
  counted_cash_cents bigint check (counted_cash_cents >= 0),
  -- Lo que calculó la tablet y lo que recalculó el servidor; si difieren, el corte queda por revisar.
  expected_cash_cents bigint,
  server_expected_cash_cents bigint,
  difference_cents bigint,
  -- Operaciones que quedaban sin enviar al cerrar (informativo) [SINCRONIZACION §6.1].
  pending_at_close integer,
  review_reason text,
  op_id uuid not null,
  change_seq bigint not null,
  created_at timestamptz not null default now()
);

create unique index cash_shifts_change_seq_idx on public.cash_shifts (change_seq);
create index cash_shifts_user_idx on public.cash_shifts (user_id, status);
create index cash_shifts_day_idx on public.cash_shifts (business_day);
create trigger cash_shifts_stamp_change
  before insert or update on public.cash_shifts
  for each row execute function private.stamp_cash_shift_change();

create table public.cash_shift_reopenings (
  id uuid primary key default gen_random_uuid(),
  cash_shift_id uuid not null references public.cash_shifts (id),
  reopened_by uuid not null,
  reason text not null check (length(btrim(reason)) > 0),
  occurred_at timestamptz not null default now(),
  op_id uuid
);

create trigger cash_shift_reopenings_append_only
  before update or delete on public.cash_shift_reopenings
  for each row execute function private.payments_are_append_only();

alter table public.payments
  add constraint payments_cash_shift_fk foreign key (cash_shift_id) references public.cash_shifts (id);
alter table public.counter_sales
  add constraint counter_sales_cash_shift_fk foreign key (cash_shift_id) references public.cash_shifts (id);

alter table public.cash_shifts enable row level security;
alter table public.cash_shift_reopenings enable row level security;
create policy "solo administradores leen los turnos" on public.cash_shifts
  for select to authenticated using ((select private.is_admin()));
create policy "solo administradores leen las reaperturas" on public.cash_shift_reopenings
  for select to authenticated using ((select private.is_admin()));
revoke all on public.cash_shifts, public.cash_shift_reopenings from anon, authenticated;
grant select on public.cash_shifts, public.cash_shift_reopenings to authenticated;

create view public.cash_shifts_for_device as
select id, user_id, opened_at, business_day, opening_float_cents, status, closed_at, counted_cash_cents,
       expected_cash_cents, difference_cents, pending_at_close, review_reason, change_seq
from public.cash_shifts
where (select private.is_admin()) or (select private.is_device());
revoke all on public.cash_shifts_for_device from anon, authenticated;
grant select on public.cash_shifts_for_device to authenticated;

-- La vista de ventas para la tablet ahora dice a qué turno pertenece cada venta.
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
      'displayUnit', l.display_unit) order by l.position)
    from public.counter_sale_lines l where l.counter_sale_id = s.id
  ), '[]'::jsonb) as lines,
  s.cash_shift_id
from public.counter_sales s
where (select private.is_admin()) or (select private.is_device());

-- Efectivo cobrado en un turno: lo APLICADO en efectivo (el cambio no queda en el cajón), sin las ventas
-- canceladas.
create function private.shift_cash_collected_cents(p_shift_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(p.amount_cents), 0)::bigint
    from public.payments p
    left join public.counter_sales s on s.id = p.counter_sale_id
   where p.cash_shift_id = p_shift_id
     and p.method = 'CASH'
     and (s.id is null or s.status <> 'CANCELLED');
$$;

create function private.apply_open_cash_shift(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'id')::uuid;
  v_opened timestamptz := (p_payload->>'openedAt')::timestamptz;
  v_reason text;
begin
  -- Dos turnos abiertos de la misma persona no deberían existir: se guarda y se revisa.
  if exists (select 1 from public.cash_shifts where user_id = p_user_id and status = 'OPEN') then
    v_reason := 'SHIFT_ALREADY_OPEN';
  end if;
  insert into public.cash_shifts (id, user_id, device_id, opened_at, business_day, opening_float_cents,
                                  review_reason, op_id, change_seq)
  values (v_id, p_user_id, p_device.id, v_opened, (v_opened at time zone 'America/Mexico_City')::date,
          coalesce((p_payload->>'openingFloatCents')::bigint, 0), v_reason, p_op_id, 0);
  perform private.add_audit(p_user_id, p_device.id, 'CASH_SHIFT_OPENED', 'cash_shift', v_id::text, null,
    jsonb_build_object('fondoCentavos', coalesce((p_payload->>'openingFloatCents')::bigint, 0)), null, p_op_id);
  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'documentId', v_id);
end;
$$;

create function private.apply_close_cash_shift(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'id')::uuid;
  v_shift public.cash_shifts;
  v_expected bigint;
  v_counted bigint := (p_payload->>'countedCashCents')::bigint;
  v_reason text;
begin
  select * into v_shift from public.cash_shifts where id = v_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'SHIFT_NOT_FOUND');
  end if;
  if v_shift.status = 'CLOSED' then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'INVALID_TRANSITION', 'documentId', v_id);
  end if;

  v_expected := v_shift.opening_float_cents + private.shift_cash_collected_cents(v_id);
  -- El servidor recalcula: si no coincide con lo que calculó la tablet, queda por revisar [SINCRONIZACION §6.1].
  if v_expected <> (p_payload->>'expectedCashCents')::bigint then
    v_reason := 'CASH_SUMMARY_MISMATCH';
  end if;

  update public.cash_shifts
     set status = 'CLOSED', closed_at = (p_payload->>'closedAt')::timestamptz, counted_cash_cents = v_counted,
         expected_cash_cents = (p_payload->>'expectedCashCents')::bigint, server_expected_cash_cents = v_expected,
         difference_cents = v_counted - v_expected, pending_at_close = nullif(p_payload->>'pendingAtClose', '')::integer,
         review_reason = coalesce(v_reason, review_reason)
   where id = v_id;
  perform private.add_audit(p_user_id, p_device.id, 'CASH_SHIFT_CLOSED', 'cash_shift', v_id::text, null,
    jsonb_build_object('esperadoCentavos', v_expected, 'contadoCentavos', v_counted,
                       'diferenciaCentavos', v_counted - v_expected), null, p_op_id);
  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'documentId', v_id);
end;
$$;

create function private.apply_reopen_cash_shift(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_authorized_by uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'id')::uuid;
  v_shift public.cash_shifts;
  v_text text := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  v_admin boolean;
  v_reason text;
begin
  select * into v_shift from public.cash_shifts where id = v_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'SHIFT_NOT_FOUND');
  end if;
  if v_shift.status <> 'CLOSED' then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'INVALID_TRANSITION', 'documentId', v_id);
  end if;
  select exists (select 1 from public.app_users where id = coalesce(p_authorized_by, p_user_id)
                   and role = 'ADMIN' and is_active) into v_admin;
  if not v_admin or v_text is null then
    v_reason := 'REOPEN_WITHOUT_AUTHORIZATION';
  end if;
  update public.cash_shifts set status = 'OPEN', closed_at = null where id = v_id;
  insert into public.cash_shift_reopenings (cash_shift_id, reopened_by, reason, op_id)
  values (v_id, coalesce(p_authorized_by, p_user_id), coalesce(v_text, '(sin motivo)'), p_op_id);
  perform private.add_audit(p_user_id, p_device.id, 'CASH_SHIFT_REOPENED', 'cash_shift', v_id::text,
    jsonb_build_object('estado', 'CLOSED'), jsonb_build_object('estado', 'OPEN', 'motivo', v_text),
    p_authorized_by, p_op_id);
  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'documentId', v_id);
end;
$$;

revoke all on function private.shift_cash_collected_cents(uuid) from public, anon, authenticated;
revoke all on function private.apply_open_cash_shift(uuid, public.devices, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.apply_close_cash_shift(uuid, public.devices, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.apply_reopen_cash_shift(uuid, public.devices, uuid, uuid, jsonb)
  from public, anon, authenticated;

-- Los cobros ahora pueden traer el turno al que pertenecen. Se vuelven a definir las dos funciones que
-- guardan pagos para que lo anoten; si el turno ya está cerrado, el pago se guarda igual y queda por revisar.
create or replace function private.apply_register_payment(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_order_id uuid := nullif(p_payload#>>'{target,id}', '')::uuid;
  v_order public.work_orders;
  v_row jsonb;
  v_applied bigint := 0;
  v_balance bigint;
  v_reason text;
  v_paid_at timestamptz := (p_payload->>'paidAt')::timestamptz;
  v_shift uuid := nullif(p_payload->>'cashShiftId', '')::uuid;
begin
  if p_payload#>>'{target,type}' <> 'WORK_ORDER' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'TARGET_NOT_SUPPORTED');
  end if;
  select * into v_order from public.work_orders where id = v_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'ORDER_NOT_FOUND');
  end if;
  if v_shift is not null and not exists (select 1 from public.cash_shifts where id = v_shift) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'SHIFT_NOT_FOUND');
  end if;

  for v_row in select * from jsonb_array_elements(p_payload->'rows') loop
    v_applied := v_applied + (v_row->>'amountCents')::bigint;
  end loop;
  v_balance := v_order.total_cents - private.work_order_paid_cents(v_order_id);
  if v_applied > v_balance then
    v_reason := 'PAYMENT_EXCEEDS_BALANCE';
  elsif v_order.status = 'CANCELLED' then
    v_reason := 'ORDER_CANCELLED';
  elsif v_shift is not null and exists (select 1 from public.cash_shifts where id = v_shift and status = 'CLOSED') then
    v_reason := 'SHIFT_CLOSED';
  end if;

  for v_row in select * from jsonb_array_elements(p_payload->'rows') loop
    insert into public.payments (
      id, group_id, work_order_id, kind, method, amount_cents, cash_received_cents, change_cents,
      reference, user_id, device_id, paid_at, cash_shift_id, op_id
    ) values (
      (v_row->>'id')::uuid, (p_payload->>'groupId')::uuid, v_order_id, p_payload->>'kind',
      v_row->>'method', (v_row->>'amountCents')::bigint,
      nullif(v_row->>'cashReceivedCents', '')::bigint,
      case when v_row->>'method' = 'CASH'
           then (v_row->>'cashReceivedCents')::bigint - (v_row->>'amountCents')::bigint end,
      nullif(v_row->>'reference', ''), p_user_id, p_device.id, v_paid_at, v_shift, p_op_id
    );
  end loop;

  perform private.add_audit(p_user_id, p_device.id, 'PAYMENT_REGISTERED', 'work_order', v_order_id::text,
    jsonb_build_object('saldoCentavos', v_balance),
    jsonb_build_object('aplicadoCentavos', v_applied, 'tipo', p_payload->>'kind'), null, p_op_id);

  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason,
                              'folio', v_order.folio, 'documentId', v_order_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_order.folio, 'documentId', v_order_id);
end;
$$;

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
    when 'OpenCashShift' then
      v_result := private.apply_open_cash_shift(v_op_id, v_device, v_user_id, v_payload);
    when 'CloseCashShift' then
      v_result := private.apply_close_cash_shift(v_op_id, v_device, v_user_id, v_payload);
    when 'ReopenCashShift' then
      v_result := private.apply_reopen_cash_shift(v_op_id, v_device, v_user_id, v_authorized_by, v_payload);
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
