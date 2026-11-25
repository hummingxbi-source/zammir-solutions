-- AJ-05 · Confirmar que llegó una transferencia [RF-M4-11, ADR-0044, PD-43].
-- Un administrador revisa su banco y marca "Ya llegó" en un pago por transferencia. El pago no se toca (es
-- contable y de solo agregar [RN-18]): la confirmación es una tabla aparte, también de solo agregar, con quién y
-- cuándo. Llega a las tablets por su propia vista y su número de cambio. Los totales no cambian.

create sequence public.payment_confirmation_change_seq;

create table public.payment_confirmations (
  payment_id uuid primary key references public.payments (id),
  confirmed_by uuid not null,
  confirmed_at timestamptz not null,
  device_id uuid,
  user_id uuid,
  op_id uuid not null,
  change_seq bigint not null default nextval('public.payment_confirmation_change_seq'),
  created_at timestamptz not null default now()
);
create unique index payment_confirmations_change_seq_idx on public.payment_confirmations (change_seq);

comment on table public.payment_confirmations is
  'Confirmaciones de que llegó el dinero de una transferencia [RF-M4-11]. Solo se agregan.';

-- Solo se agregan: ni se cambian ni se borran (el mismo guardián que los pagos).
create trigger payment_confirmations_append_only
  before update or delete on public.payment_confirmations
  for each row execute function private.payments_are_append_only();
create trigger payment_confirmations_no_truncate
  before truncate on public.payment_confirmations
  for each statement execute function private.payments_are_append_only();

alter table public.payment_confirmations enable row level security;
create policy "administradores leen las confirmaciones" on public.payment_confirmations
  for select to authenticated using ((select private.is_admin()));
revoke all on public.payment_confirmations from anon, authenticated;
grant select on public.payment_confirmations to authenticated;

create view public.payment_confirmations_for_device as
select payment_id, confirmed_by, confirmed_at, change_seq
from public.payment_confirmations
where (select private.is_admin()) or (select private.is_device());
revoke all on public.payment_confirmations_for_device from anon, authenticated;
grant select on public.payment_confirmations_for_device to authenticated;

-- Nada se rechaza: si no se puede confirmar, se registra la operación por revisar sin guardar nada.
create function private.apply_confirm_transfer(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_authorized_by uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'paymentId')::uuid;
  v_payment public.payments;
  v_confirms uuid := coalesce(p_authorized_by, p_user_id);
  v_reason text;
begin
  select * into v_payment from public.payments where id = v_id;
  if not found then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'PAYMENT_NOT_FOUND', 'documentId', v_id);
  end if;
  if v_payment.method <> 'TRANSFER' then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'NOT_A_TRANSFER', 'documentId', v_id);
  end if;
  if exists (select 1 from public.payment_confirmations where payment_id = v_id) then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'ALREADY_CONFIRMED', 'documentId', v_id);
  end if;

  -- Confirma un administrador activo (en persona o con su PIN); si no, se guarda y queda por revisar.
  if not exists (select 1 from public.app_users where id = v_confirms and role = 'ADMIN' and is_active) then
    v_reason := 'CONFIRM_WITHOUT_AUTHORIZATION';
  end if;

  insert into public.payment_confirmations (payment_id, confirmed_by, confirmed_at, device_id, user_id, op_id)
  values (v_id, v_confirms, (p_payload->>'confirmedAt')::timestamptz, p_device.id, p_user_id, p_op_id);

  perform private.add_audit(p_user_id, p_device.id, 'TRANSFER_CONFIRMED', 'payment', v_id::text, null,
    jsonb_build_object('montoCentavos', v_payment.amount_cents, 'referencia', v_payment.reference,
                       'confirmadaEl', p_payload->>'confirmedAt'),
    p_authorized_by, p_op_id);

  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'documentId', v_id);
end;
$$;
revoke all on function private.apply_confirm_transfer(uuid, public.devices, uuid, uuid, jsonb) from public, anon, authenticated;

-- El receptor de operaciones conoce el tipo nuevo.
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
    when 'ConfirmTransfer' then
      v_result := private.apply_confirm_transfer(v_op_id, v_device, v_user_id, v_authorized_by, v_payload);
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

-- La exportación de los datos incluye las confirmaciones [RNF-22].
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
      ('payment_confirmations',    '{}'::text[]),
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
