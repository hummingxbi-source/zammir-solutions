-- S2-03 · Receptor de operaciones idempotente [RNF-03, RNF-11, RN-16, RN-18, ADR-0016].
--
-- Toda operación de la tablet llega por `receive_operation`, que en UNA transacción:
--   1. comprueba que quien la manda es un dispositivo activo (y bloquea su fila: sus operaciones
--      se atienden una por una);
--   2. si el `opId` ya se aplicó, devuelve el MISMO resultado guardado y no repite nada;
--   3. comprueba el orden: `seq` debe ser la última aplicada + 1, si no responde OUT_OF_ORDER;
--   4. aplica la operación según su tipo (desconocido = rechazo estructural);
--   5. asigna el folio definitivo como ÚLTIMO paso y guarda la operación y su resultado.
-- Cualquier excepción revierte todo: no quedan folios consumidos ni documentos a medias.
--
-- Rechazos estructurales (no se guarda nada; la tablet detiene su cola): DEVICE_REVOKED,
-- OUT_OF_ORDER, UNKNOWN_TYPE, INVALID_PAYLOAD. Una persona desactivada o desconocida no rechaza:
-- se aplica y queda TO_REVIEW [ADR-0013, RN-18].

create table public.operations (
  op_id uuid primary key,
  device_id uuid not null references public.devices (id),
  seq bigint not null check (seq >= 1),
  type text not null check (length(type) > 0),
  schema_version integer not null check (schema_version >= 1),
  payload jsonb not null,
  user_id uuid,
  authorized_by uuid,
  client_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  status text not null check (status in ('APPLIED', 'TO_REVIEW')),
  reason text,
  result jsonb not null,
  unique (device_id, seq)
);

comment on table public.operations is
  'Operaciones recibidas de las tablets y su resultado. Solo se agrega [ADR-0016].';

alter table public.operations enable row level security;

create policy "solo administradores leen las operaciones"
  on public.operations for select to authenticated
  using ((select private.is_admin()));

revoke all on public.operations from anon, authenticated;
grant select on public.operations to authenticated;

create function private.operations_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Las operaciones no se modifican ni se borran' using errcode = 'P0001';
end;
$$;

create trigger operations_inmutable
  before update or delete on public.operations
  for each row execute function private.operations_inmutable();

alter table public.devices add column last_seq bigint not null default 0 check (last_seq >= 0);

-- Aplica una cotización emitida: guarda la cotización y sus líneas y asigna el folio definitivo.
-- Devuelve el resultado; si el código público ya existe, no aplica y pide revisión.
create function private.apply_issue_quote(
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
begin
  if not exists (select 1 from public.customers where id = (p_payload->>'customerId')::uuid) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'CUSTOMER_NOT_FOUND');
  end if;

  if exists (select 1 from public.quotes where public_code = p_payload->>'publicCode') then
    return jsonb_build_object(
      'ok', true, 'status', 'TO_REVIEW', 'reason', 'PUBLIC_CODE_CONFLICT'
    );
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
    insert into public.quote_lines (
      id, quote_id, position, product_id, name, charge_unit, unit_price_cents, rule_id,
      rule_params, width_mm, height_mm, quantity, line_total_cents, base_cents, tax_cents,
      is_tax_exempt, detail
    ) values (
      (v_line->>'id')::uuid, v_quote_id, v_position, nullif(v_line->>'productId', '')::uuid,
      v_line->>'name', v_line->>'chargeUnit', (v_line->>'unitPriceCents')::bigint,
      v_line->>'ruleId', coalesce(v_line->'ruleParams', '{}'::jsonb),
      nullif(v_line->>'widthMm', '')::integer, nullif(v_line->>'heightMm', '')::integer,
      (v_line->>'quantity')::integer, (v_line->>'lineTotalCents')::bigint,
      (v_line->>'baseCents')::bigint, (v_line->>'taxCents')::bigint,
      coalesce((v_line->>'isTaxExempt')::boolean, false), coalesce(v_line->>'detail', '')
    );
  end loop;

  -- El folio es el último paso: el bloqueo de su fila dura lo menos posible.
  v_year := private.folio_year(v_issued_at);
  v_number := private.next_folio('QUOTE', v_year);
  v_folio := 'COT-' || v_year::text || '-' || lpad(v_number::text, 4, '0');
  update public.quotes set folio = v_folio where id = v_quote_id;

  insert into public.audit_log (id, occurred_at, user_id, device_id, action, entity_type, entity_id,
                                new_value, authorized_by, op_id)
  values (gen_random_uuid(), (p_payload->>'issuedAt')::timestamptz, p_user_id, p_device.id,
          'QUOTE_ISSUED', 'quote', v_quote_id::text,
          jsonb_build_object('folio', v_folio, 'tempFolio', p_payload->>'tempFolio',
                             'totalCents', (p_payload->>'totalCents')::bigint),
          p_authorized_by, p_op_id);

  return jsonb_build_object(
    'ok', true, 'status', 'APPLIED', 'folio', v_folio, 'documentId', v_quote_id
  );
end;
$$;

revoke all on function private.apply_issue_quote(uuid, public.devices, uuid, uuid, jsonb)
  from public, anon, authenticated;

create function public.receive_operation(p jsonb)
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

revoke all on function public.receive_operation(jsonb) from public, anon;
grant execute on function public.receive_operation(jsonb) to authenticated;
