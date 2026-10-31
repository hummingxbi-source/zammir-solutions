-- S2-08 y S2-11 · Estados de la cotización, conflictos y descuentos con autorización
-- [RN-18, RN-19, RF-M2-03, RF-M2-07, SINCRONIZACION.md §6].
--
--  - Cada línea guarda el precio del catálogo con el que se cotizó (`catalog_price_cents`); si el precio
--    cobrado es menor, es un descuento: queda en la bitácora con valor anterior, valor nuevo y quién lo
--    autorizó. Un descuento sin autorizador no se rechaza (ya ocurrió): queda POR REVISAR.
--  - MarkQuoteAccepted / MarkQuoteRejected cambian el estado con la tabla de transiciones. Si la
--    transición ya no es válida (otra tablet ya la cambió), la operación se aplica como POR REVISAR con
--    motivo, sin perder nada y sin tocar la cotización.

alter table public.quote_lines add column catalog_price_cents bigint check (catalog_price_cents >= 0);

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
      is_tax_exempt, detail
    ) values (
      (v_line->>'id')::uuid, v_quote_id, v_position, nullif(v_line->>'productId', '')::uuid,
      v_line->>'name', v_line->>'chargeUnit', v_unit, v_catalog,
      v_line->>'ruleId', coalesce(v_line->'ruleParams', '{}'::jsonb),
      nullif(v_line->>'widthMm', '')::integer, nullif(v_line->>'heightMm', '')::integer,
      (v_line->>'quantity')::integer, (v_line->>'lineTotalCents')::bigint,
      (v_line->>'baseCents')::bigint, (v_line->>'taxCents')::bigint,
      coalesce((v_line->>'isTaxExempt')::boolean, false), coalesce(v_line->>'detail', '')
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

-- Aceptar o rechazar una cotización. La cotización existe porque la operación que la emitió tiene un
-- `seq` anterior y se aplica antes.
create function private.apply_mark_quote(
  p_op_id uuid,
  p_device public.devices,
  p_user_id uuid,
  p_payload jsonb,
  p_new_status text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_quote public.quotes;
  v_id uuid := nullif(p_payload->>'quoteId', '')::uuid;
begin
  select * into v_quote from public.quotes where id = v_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'QUOTE_NOT_FOUND');
  end if;

  -- Transición no válida (otra tablet ya la aceptó o la rechazó): se registra y queda por revisar.
  if v_quote.status <> 'SENT' then
    return jsonb_build_object(
      'ok', true, 'status', 'TO_REVIEW', 'reason', 'INVALID_TRANSITION',
      'folio', v_quote.folio, 'documentId', v_quote.id
    );
  end if;

  update public.quotes set status = p_new_status where id = v_quote.id;

  insert into public.audit_log (id, occurred_at, user_id, device_id, action, entity_type, entity_id,
                                old_value, new_value, op_id)
  values (gen_random_uuid(), now(), p_user_id, p_device.id,
          case p_new_status when 'ACCEPTED' then 'QUOTE_ACCEPTED' else 'QUOTE_REJECTED' end,
          'quote', v_quote.id::text,
          jsonb_build_object('estado', v_quote.status), jsonb_build_object('estado', p_new_status),
          p_op_id);

  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_quote.folio, 'documentId', v_quote.id);
end;
$$;

revoke all on function private.apply_issue_quote(uuid, public.devices, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.apply_mark_quote(uuid, public.devices, uuid, jsonb, text)
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
  -- 1. Quien manda es un dispositivo activo y la operación es suya.
  select * into v_device
    from public.devices
   where id = v_device_id and auth_user_id = (select auth.uid()) and status = 'ACTIVE'
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'DEVICE_REVOKED');
  end if;

  -- 2. Idempotencia: lo ya aplicado devuelve su resultado guardado, sin repetir nada.
  select result into v_existing from public.operations where op_id = v_op_id;
  if found then
    return v_existing;
  end if;

  -- 3. Orden por dispositivo.
  if v_seq <> v_device.last_seq + 1 then
    return jsonb_build_object('ok', false, 'code', 'OUT_OF_ORDER', 'expectedSeq', v_device.last_seq + 1);
  end if;

  -- 4. Persona activa (si no, se aplica y queda por revisar [ADR-0013]).
  v_status := 'APPLIED';
  if v_user_id is null or not exists (
       select 1 from public.app_users where id = v_user_id and is_active
     ) then
    v_status := 'TO_REVIEW';
    v_reason := 'USER_INACTIVE';
  end if;

  -- 5. Según el tipo.
  case v_type
    when 'IssueQuote' then
      v_result := private.apply_issue_quote(v_op_id, v_device, v_user_id, v_authorized_by, v_payload);
    when 'MarkQuoteAccepted' then
      v_result := private.apply_mark_quote(v_op_id, v_device, v_user_id, v_payload, 'ACCEPTED');
    when 'MarkQuoteRejected' then
      v_result := private.apply_mark_quote(v_op_id, v_device, v_user_id, v_payload, 'REJECTED');
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
