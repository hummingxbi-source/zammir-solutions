-- S1-12 · Anonimización de clientes [RF-M5-05, RNF-14, RNF-15, RN-18, RN-19].
-- Un cliente que pide que se borren sus datos personales se anonimiza: se vacían nombre, teléfono, correo,
-- notas y datos fiscales, y se conservan su identificador y todo lo contable y fiscal que apunte a él.
-- Solo administradores. La bitácora lo anota SIN datos personales. No se puede deshacer ni editar después.

create or replace function public.anonymize_customer(p_id uuid)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente public.customers;
begin
  if not (select private.is_admin()) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  select * into v_cliente from public.customers where id = p_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Anonimizar a uno ya anonimizado no cambia nada ni deja otra entrada.
  if v_cliente.anonymized_at is not null then
    return v_cliente;
  end if;

  update public.customers
  set name = 'Cliente anonimizado',
      phone = '0000000000',
      email = null,
      notes = null,
      fiscal_rfc = null,
      fiscal_legal_name = null,
      fiscal_zip = null,
      fiscal_regime = null,
      fiscal_cfdi_use = null,
      anonymized_at = now()
  where id = p_id
  returning * into v_cliente;

  insert into public.audit_log
    (id, occurred_at, recorded_by, user_id, action, entity_type, entity_id, old_value, new_value)
  values (
    gen_random_uuid(), now(), (select auth.uid()), (select auth.uid()), 'CUSTOMER_ANONYMIZED',
    'customer', p_id::text,
    jsonb_build_object('anonimizado', false), jsonb_build_object('anonimizado', true)
  );

  return v_cliente;
end;
$$;

revoke execute on function public.anonymize_customer(uuid) from public, anon;
grant execute on function public.anonymize_customer(uuid) to authenticated;

-- Un cliente anonimizado ya no se edita: ni por la función ni por la tabla.
create or replace function private.customers_anonimizado_no_se_edita()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.anonymized_at is not null then
    raise exception 'ANONYMIZED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger customers_anonimizado_no_se_edita
  before update on public.customers
  for each row execute function private.customers_anonimizado_no_se_edita();
