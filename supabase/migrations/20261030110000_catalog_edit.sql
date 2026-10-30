-- S1-06 · Edición, desactivación e historial de precios [RF-M1-04, RF-M1-06, RN-18, RN-19].
--
-- Los administradores editan productos; nadie los borra (no hay política ni permiso de DELETE).
-- El historial de precios y la bitácora no dependen de que la aplicación se acuerde de escribirlos:
-- los dispara la propia base en el mismo paso que el cambio, así no hay forma de saltárselos.

create table public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  old_price_cents bigint not null check (old_price_cents >= 0),
  new_price_cents bigint not null check (new_price_cents >= 0),
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);

comment on table public.product_price_history is
  'Historial de cambios de precio de lista. Solo se agrega; nadie lo modifica ni lo borra.';

create index product_price_history_product_idx on public.product_price_history (product_id, changed_at);

alter table public.product_price_history enable row level security;

create policy "solo administradores leen el historial de precios"
  on public.product_price_history
  for select
  to authenticated
  using ((select private.is_admin()));

revoke all on public.product_price_history from anon, authenticated;
grant select on public.product_price_history to authenticated;

-- El historial nunca cambia, ni para el dueño de la tabla.
create or replace function private.product_price_history_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'El historial de precios no se modifica ni se borra' using errcode = 'P0001';
end;
$$;

create trigger product_price_history_no_update
  before update or delete on public.product_price_history
  for each row execute function private.product_price_history_inmutable();

create trigger product_price_history_no_truncate
  before truncate on public.product_price_history
  for each statement execute function private.product_price_history_inmutable();

-- Edición: solo administradores, y solo las columnas que se pueden cambiar
-- (el identificador, la fecha de alta y quien dio de alta no se tocan).
create policy "solo administradores editan productos"
  on public.products
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

grant update (
  code, name, category_id, kind, charge_unit, list_price_cents, is_tax_exempt, is_active,
  rule_id, rule_params, fiscal_product_service_key, fiscal_unit_key, fiscal_tax_object,
  warranty_months, warranty_text
) on public.products to authenticated;

-- Un cambio de precio o de estado deja su historial y su bitácora en el mismo paso.
create or replace function private.products_registrar_cambios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.list_price_cents is distinct from old.list_price_cents then
    insert into public.product_price_history (product_id, old_price_cents, new_price_cents)
    values (new.id, old.list_price_cents, new.list_price_cents);

    insert into public.audit_log
      (id, occurred_at, recorded_by, user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      gen_random_uuid(), now(), (select auth.uid()), (select auth.uid()), 'PRODUCT_PRICE_CHANGED',
      'product', new.id::text,
      jsonb_build_object('precio_centavos', old.list_price_cents),
      jsonb_build_object('precio_centavos', new.list_price_cents)
    );
  end if;

  if new.is_active is distinct from old.is_active then
    insert into public.audit_log
      (id, occurred_at, recorded_by, user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      gen_random_uuid(), now(), (select auth.uid()), (select auth.uid()),
      case when new.is_active then 'PRODUCT_ACTIVATED' else 'PRODUCT_DEACTIVATED' end,
      'product', new.id::text,
      jsonb_build_object('activo', old.is_active),
      jsonb_build_object('activo', new.is_active)
    );
  end if;

  return new;
end;
$$;

create trigger products_registrar_cambios
  after update on public.products
  for each row execute function private.products_registrar_cambios();
