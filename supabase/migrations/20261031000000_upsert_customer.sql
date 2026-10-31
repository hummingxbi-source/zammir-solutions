-- S2-10 · Clientes como operación en cola [ADR-0023, ADR-0021 queda sustituida].
--
-- La tablet captura clientes sin internet y los manda como operación `UpsertCustomer`. Aquí:
--   1. cada cliente recibe un número de cambio (para que las tablets bajen "lo que cambió después"),
--   2. el receptor sabe aplicar `UpsertCustomer`: por campo gana el último que llega y el valor
--      anterior queda en la bitácora [RN-19],
--   3. se retira el alta directa de la tablet en la tabla (ya no hace falta).
-- Los datos fiscales NO viajan por aquí: solo los captura un administrador en línea [RNF-06].

create sequence public.customers_change_seq;

create function private.stamp_customer_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.change_seq := nextval('public.customers_change_seq');
  return new;
end;
$$;

alter table public.customers add column change_seq bigint;
update public.customers set change_seq = nextval('public.customers_change_seq');
alter table public.customers alter column change_seq set not null;
create unique index customers_change_seq_idx on public.customers (change_seq);

create trigger customers_stamp_change
  before insert or update on public.customers
  for each row execute function private.stamp_customer_change();

-- Lo que la tablet replica de un cliente: sin datos fiscales, con su número de cambio.
drop view public.customers_for_device;
create view public.customers_for_device as
select id, name, phone, email, notes, privacy_notice_version, anonymized_at, change_seq
from public.customers
where (select private.is_admin()) or (select private.is_device());

revoke all on public.customers_for_device from anon, authenticated;
grant select on public.customers_for_device to authenticated;

-- Las tablets ya no escriben en la tabla: todo entra por `receive_operation`.
drop policy "administradores y dispositivos dan de alta clientes" on public.customers;
create policy "administradores dan de alta clientes"
  on public.customers
  for insert
  to authenticated
  with check ((select private.is_admin()));

create function private.apply_upsert_customer(
  p_op_id uuid,
  p_device public.devices,
  p_user_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'id')::uuid;
  v_name text := btrim(p_payload->>'name');
  v_phone text := p_payload->>'phone';
  v_email text := p_payload->'email' #>> '{}';
  v_notes text := p_payload->'notes' #>> '{}';
  v_privacy integer := nullif(p_payload->>'privacyNoticeVersion', '')::integer;
  v_old public.customers;
begin
  if v_name is null or v_name = '' or v_phone is null or v_phone !~ '^\d{10}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'CUSTOMER_FIELDS');
  end if;

  select * into v_old from public.customers where id = v_id for update;

  if not found then
    insert into public.customers (id, name, phone, email, notes, privacy_notice_version, created_by)
    values (v_id, v_name, v_phone, v_email, v_notes, v_privacy, null);
    insert into public.audit_log (id, occurred_at, user_id, device_id, action, entity_type, entity_id,
                                  old_value, new_value, op_id)
    values (gen_random_uuid(), now(), p_user_id, p_device.id, 'CUSTOMER_UPSERTED', 'customer',
            v_id::text, null, jsonb_build_object('creado', true), p_op_id);
    return jsonb_build_object('ok', true, 'status', 'APPLIED', 'documentId', v_id);
  end if;

  -- Un cliente anonimizado ya no se corrige: se conserva y la operación queda por revisar.
  if v_old.anonymized_at is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'CUSTOMER_ANONYMIZED',
                              'documentId', v_id);
  end if;

  -- Gana el último que llega; lo anterior queda en la bitácora (sin datos fiscales ni de más).
  update public.customers
     set name = v_name, phone = v_phone, email = v_email, notes = v_notes,
         privacy_notice_version = coalesce(v_privacy, privacy_notice_version)
   where id = v_id;

  if (v_old.name, v_old.phone, v_old.email, v_old.notes)
     is distinct from (v_name, v_phone, v_email, v_notes) then
    insert into public.audit_log (id, occurred_at, user_id, device_id, action, entity_type, entity_id,
                                  old_value, new_value, op_id)
    values (gen_random_uuid(), now(), p_user_id, p_device.id, 'CUSTOMER_UPSERTED', 'customer',
            v_id::text,
            jsonb_build_object('nombre', v_old.name, 'telefono', v_old.phone,
                               'correo', v_old.email, 'notas', v_old.notes),
            jsonb_build_object('nombre', v_name, 'telefono', v_phone,
                               'correo', v_email, 'notas', v_notes),
            p_op_id);
  end if;

  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'documentId', v_id);
end;
$$;

revoke all on function private.apply_upsert_customer(uuid, public.devices, uuid, jsonb)
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
