-- AJ-06 · Devolución al cancelar una venta de mostrador [RF-M4-10, ADR-0044, PD-24].
-- Al cancelar una venta cobrada se le devuelve el dinero al cliente por el mismo medio, y la devolución queda en el
-- turno abierto de quien cancela: el efectivo sale de su cajón. El cobro original se queda en el turno donde se
-- cobró, así que un corte cerrado ya no cambia después. Las devoluciones solo se agregan [RN-18].
-- Una cancelación vieja en cola, sin devoluciones, se aplica como antes (su cobro sale del turno de la venta) y
-- queda por revisar (REFUND_MISSING).

create sequence public.refund_change_seq;

create table public.refunds (
  id uuid primary key,
  counter_sale_id uuid not null references public.counter_sales (id),
  method text not null check (method in ('CASH', 'TRANSFER')),
  amount_cents bigint not null check (amount_cents > 0),
  cash_shift_id uuid references public.cash_shifts (id),
  user_id uuid not null,
  authorized_by uuid,
  device_id uuid,
  refunded_at timestamptz not null,
  op_id uuid not null,
  change_seq bigint not null default nextval('public.refund_change_seq'),
  created_at timestamptz not null default now()
);
create index refunds_sale_idx on public.refunds (counter_sale_id);
create index refunds_shift_idx on public.refunds (cash_shift_id);
create unique index refunds_change_seq_idx on public.refunds (change_seq);

comment on table public.refunds is
  'Devoluciones al cancelar ventas de mostrador, por medio de pago y en el turno de quien cancela [RF-M4-10].';

create trigger refunds_append_only
  before update or delete on public.refunds
  for each row execute function private.payments_are_append_only();
create trigger refunds_no_truncate
  before truncate on public.refunds
  for each statement execute function private.payments_are_append_only();

alter table public.refunds enable row level security;
create policy "administradores leen las devoluciones" on public.refunds
  for select to authenticated using ((select private.is_admin()));
revoke all on public.refunds from anon, authenticated;
grant select on public.refunds to authenticated;

create view public.refunds_for_device as
select id, counter_sale_id, method, amount_cents, cash_shift_id, user_id, authorized_by, refunded_at, change_seq
from public.refunds
where (select private.is_admin()) or (select private.is_device());
revoke all on public.refunds_for_device from anon, authenticated;
grant select on public.refunds_for_device to authenticated;

-- Efectivo del turno: lo cobrado en él (una venta cancelada sin devolución registrada no cuenta, como antes)
-- menos el efectivo devuelto en él.
create or replace function private.shift_cash_collected_cents(p_shift_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select (
    coalesce((
      select sum(p.amount_cents)
        from public.payments p
        left join public.counter_sales s on s.id = p.counter_sale_id
       where p.cash_shift_id = p_shift_id
         and p.method = 'CASH'
         and (s.id is null or s.status <> 'CANCELLED'
              or exists (select 1 from public.refunds r where r.counter_sale_id = s.id))
    ), 0)
    - coalesce((
      select sum(r.amount_cents) from public.refunds r
       where r.cash_shift_id = p_shift_id and r.method = 'CASH'
    ), 0)
  )::bigint;
$$;
revoke all on function private.shift_cash_collected_cents(uuid) from public, anon, authenticated;

create or replace function private.apply_cancel_counter_sale(
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
  v_row jsonb;
  v_shift uuid;
  v_paid_cash bigint;
  v_paid_transfer bigint;
  v_refund_cash bigint := 0;
  v_refund_transfer bigint := 0;
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

  if p_payload ? 'refunds' then
    for v_row in select * from jsonb_array_elements(p_payload->'refunds') loop
      v_shift := nullif(v_row->>'cashShiftId', '')::uuid;
      if v_shift is not null and not exists (select 1 from public.cash_shifts where id = v_shift) then
        return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'SHIFT_NOT_FOUND');
      end if;
      -- Efectivo devuelto en un turno ya cerrado: se guarda y se revisa.
      if v_row->>'method' = 'CASH' and v_shift is not null
         and exists (select 1 from public.cash_shifts where id = v_shift and status = 'CLOSED') then
        v_reason := coalesce(v_reason, 'SHIFT_CLOSED');
      end if;
      insert into public.refunds (id, counter_sale_id, method, amount_cents, cash_shift_id, user_id,
                                  authorized_by, device_id, refunded_at, op_id)
      values ((v_row->>'id')::uuid, v_id, v_row->>'method', (v_row->>'amountCents')::bigint, v_shift,
              p_user_id, p_authorized_by, p_device.id, now(), p_op_id);
      if v_row->>'method' = 'CASH' then
        v_refund_cash := v_refund_cash + (v_row->>'amountCents')::bigint;
      else
        v_refund_transfer := v_refund_transfer + (v_row->>'amountCents')::bigint;
      end if;
    end loop;
    -- Lo devuelto debe ser lo cobrado, por cada medio.
    select coalesce(sum(amount_cents) filter (where method = 'CASH'), 0),
           coalesce(sum(amount_cents) filter (where method = 'TRANSFER'), 0)
      into v_paid_cash, v_paid_transfer
      from public.payments where counter_sale_id = v_id;
    if v_refund_cash <> v_paid_cash or v_refund_transfer <> v_paid_transfer then
      v_reason := coalesce(v_reason, 'REFUND_MISMATCH');
    end if;
  else
    v_reason := coalesce(v_reason, 'REFUND_MISSING');
  end if;

  update public.counter_sales
     set status = 'CANCELLED', cancelled_at = now(), cancel_reason = v_text, cancelled_by = p_user_id
   where id = v_id;
  perform private.add_audit(p_user_id, p_device.id, 'COUNTER_SALE_CANCELLED', 'counter_sale', v_id::text,
    jsonb_build_object('estado', v_sale.status),
    jsonb_build_object('estado', 'CANCELLED', 'motivo', v_text, 'totalCentavos', v_sale.total_cents,
                       'devueltoEfectivoCentavos', v_refund_cash,
                       'devueltoTransferenciaCentavos', v_refund_transfer),
    p_authorized_by, p_op_id);

  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason,
                              'folio', v_sale.folio, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_sale.folio, 'documentId', v_id);
end;
$$;
revoke all on function private.apply_cancel_counter_sale(uuid, public.devices, uuid, uuid, jsonb)
  from public, anon, authenticated;

-- La exportación de los datos incluye las devoluciones [RNF-22].
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
      ('refunds',                  '{}'::text[]),
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
