-- AJ-02 · El corte pide explicación si hay diferencia [RF-M4-09, ADR-0044, PD-44].
-- Si el efectivo contado difiere del esperado, aunque sea un centavo, el cierre lleva una explicación escrita.
-- La tablet ya no deja cerrar sin ella; si llega un cierre viejo en cola sin explicación, se aplica igual pero
-- queda por revisar (DIFFERENCE_WITHOUT_NOTE): una operación nunca se rechaza por esto, para no detener la
-- fila de envío de la tablet.

alter table public.cash_shifts
  add column difference_note text
    check (difference_note is null or (length(btrim(difference_note)) between 1 and 500));

comment on column public.cash_shifts.difference_note is
  'Explicación de la diferencia entre lo contado y lo esperado al cerrar [RF-M4-09].';

-- La columna nueva va al final de la vista: Postgres no deja reordenar columnas con create or replace.
create or replace view public.cash_shifts_for_device as
select id, user_id, opened_at, business_day, opening_float_cents, status, closed_at, counted_cash_cents,
       expected_cash_cents, difference_cents, pending_at_close, review_reason, change_seq, difference_note
from public.cash_shifts
where (select private.is_admin()) or (select private.is_device());
revoke all on public.cash_shifts_for_device from anon, authenticated;
grant select on public.cash_shifts_for_device to authenticated;

create or replace function private.apply_close_cash_shift(
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
  v_note text := nullif(btrim(coalesce(p_payload->>'differenceNote', '')), '');
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
  elsif v_counted <> v_expected and v_note is null then
    -- Con diferencia y sin explicación: un cierre viejo en cola [RF-M4-09].
    v_reason := 'DIFFERENCE_WITHOUT_NOTE';
  end if;

  update public.cash_shifts
     set status = 'CLOSED', closed_at = (p_payload->>'closedAt')::timestamptz, counted_cash_cents = v_counted,
         expected_cash_cents = (p_payload->>'expectedCashCents')::bigint, server_expected_cash_cents = v_expected,
         difference_cents = v_counted - v_expected, pending_at_close = nullif(p_payload->>'pendingAtClose', '')::integer,
         difference_note = left(v_note, 500),
         review_reason = coalesce(v_reason, review_reason)
   where id = v_id;
  perform private.add_audit(p_user_id, p_device.id, 'CASH_SHIFT_CLOSED', 'cash_shift', v_id::text, null,
    jsonb_build_object('esperadoCentavos', v_expected, 'contadoCentavos', v_counted,
                       'diferenciaCentavos', v_counted - v_expected, 'explicacion', v_note), null, p_op_id);
  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'documentId', v_id);
end;
$$;
revoke all on function private.apply_close_cash_shift(uuid, public.devices, uuid, jsonb) from public, anon, authenticated;
