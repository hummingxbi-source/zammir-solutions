-- AJ-04 · Cuentas atrasadas desde la entrega, con 1 día por omisión [RF-M6-01, ADR-0044, PD-33].
-- 1) El saldo de una orden se vuelve exigible al entregarla: los días de la cuenta por cobrar se cuentan desde
--    la entrega (en la tablet). El umbral por omisión pasa de 10 a 1 día: lo entregado hoy y sin pagar está al
--    corriente y desde el día siguiente sale atrasado. Sigue siendo configurable (1 a 365).
-- 2) La hora de la entrega es la de la tablet, no la del envío: una orden entregada sin internet ya no queda
--    fechada el día en que volvió la señal. La garantía empieza ese mismo día.

update public.business_settings
   set value = '1'::jsonb,
       description = 'Días desde la entrega a partir de los cuales una cuenta por cobrar sale atrasada [RF-M6-01, ADR-0044]'
 where key = 'receivable_aging_threshold_days';

create or replace function private.apply_deliver_work_order(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_authorized_by uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'id')::uuid;
  v_order public.work_orders;
  v_balance bigint;
  v_reason text;
  v_text text := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  v_months integer;
  v_now timestamptz := now();
  v_client timestamptz := nullif(p_payload->>'deliveredAt', '')::timestamptz;
  v_delivered timestamptz;
begin
  select * into v_order from public.work_orders where id = v_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'ORDER_NOT_FOUND');
  end if;
  if v_order.status <> 'READY' then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'INVALID_TRANSITION',
                              'folio', v_order.folio, 'documentId', v_id);
  end if;

  -- La hora de la entrega es la de la tablet: si entregó sin internet, cuenta el día real y no el del envío
  -- [ADR-0044]. Se limita a no ser anterior a la orden ni posterior a la hora del servidor (con 5 minutos de
  -- tolerancia para relojes adelantados). Una entrega vieja en cola, sin hora, usa la del servidor.
  v_delivered := greatest(v_order.issued_at,
                          least(coalesce(v_client, v_now), v_now + interval '5 minutes'));

  v_balance := v_order.total_cents - private.work_order_paid_cents(v_id);
  -- Entregar con saldo: solo con autorización de un administrador y motivo. Si ya ocurrió sin ellas, se
  -- aplica y se revisa [RN-09, RF-M3-04].
  if v_balance > 0 and (p_authorized_by is null or v_text is null) then
    v_reason := 'DELIVERED_WITH_BALANCE_WITHOUT_AUTHORIZATION';
  end if;

  update public.work_orders
     set status = 'DELIVERED', delivered_at = v_delivered, delivered_with_balance = v_balance > 0,
         delivery_reason = case when v_balance > 0 then v_text end,
         delivery_authorized_by = case when v_balance > 0 then p_authorized_by end
   where id = v_id;
  insert into public.work_order_status_events (work_order_id, from_status, to_status, user_id, device_id,
                                               reason, authorized_by, op_id, occurred_at)
  values (v_id, 'READY', 'DELIVERED', p_user_id, p_device.id, v_text, p_authorized_by, p_op_id, v_delivered);

  -- Garantía escrita [RN-14]: la duración sale de la configuración y, si no está definida, queda vacía.
  select (value)::integer into v_months from public.business_settings where key = 'warranty_months_default'
     and value <> 'null'::jsonb;
  insert into public.warranties (work_order_id, starts_on, duration_months)
  values (v_id, (v_delivered at time zone 'America/Mexico_City')::date, v_months)
  on conflict (work_order_id) do nothing;

  perform private.add_audit(p_user_id, p_device.id, 'WORK_ORDER_DELIVERED', 'work_order', v_id::text,
    jsonb_build_object('estado', 'READY'),
    jsonb_build_object('estado', 'DELIVERED', 'saldoCentavos', v_balance, 'motivo', v_text,
                       'entregadaEl', v_delivered,
                       'horaAjustada', v_client is not null and v_client <> v_delivered),
    p_authorized_by, p_op_id);

  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason,
                              'folio', v_order.folio, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_order.folio, 'documentId', v_id);
end;
$$;
revoke all on function private.apply_deliver_work_order(uuid, public.devices, uuid, uuid, jsonb) from public, anon, authenticated;
