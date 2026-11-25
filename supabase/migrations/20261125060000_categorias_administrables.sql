-- AJ-08 · Categorías que administra el administrador [RF-M1-08, ADR-0044, PD-49].
-- El administrador agrega, renombra, ordena y desactiva categorías desde el sistema, sin ayuda técnica. No se
-- borran (no hay permiso de borrado) ni se desactivan mientras tengan productos activos. Cada alta y cada cambio
-- quedan en la bitácora. Las tablets siguen leyendo las categorías completas en cada actualización.

alter table public.product_categories
  add column is_active boolean not null default true,
  add column created_at timestamptz not null default now();

-- El orden ya no es único: al subir o bajar una categoría se intercambia con su vecina en dos pasos.
alter table public.product_categories drop constraint product_categories_sort_order_key;
alter table public.product_categories add constraint product_categories_sort_order_positive check (sort_order > 0);

-- Un nombre no se repite aunque cambien mayúsculas o espacios (sin acentos lo revisa la aplicación).
create unique index product_categories_name_unique on public.product_categories (lower(btrim(name)));

-- Solo el administrador agrega y cambia; nadie borra.
create policy "administradores agregan categorías" on public.product_categories
  for insert to authenticated with check ((select private.is_admin()));
create policy "administradores cambian categorías" on public.product_categories
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
grant insert (id, name, sort_order, fiscal_product_service_key, fiscal_unit_key, fiscal_tax_object, is_active)
  on public.product_categories to authenticated;
grant update (name, sort_order, fiscal_product_service_key, fiscal_unit_key, fiscal_tax_object, is_active)
  on public.product_categories to authenticated;

-- Una categoría con productos activos no se desactiva: primero se mueven o se desactivan sus productos.
create function private.categoria_sin_productos_activos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active
     and exists (select 1 from public.products where category_id = new.id and is_active) then
    raise exception 'La categoría tiene productos activos' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger product_categories_sin_productos_activos
  before update on public.product_categories
  for each row execute function private.categoria_sin_productos_activos();

-- Bitácora del alta y de cada cambio [RN-19].
create function private.categorias_registrar_cambios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_accion text;
begin
  if tg_op = 'INSERT' then
    v_accion := 'CATEGORY_CREATED';
  elsif new.is_active is distinct from old.is_active then
    v_accion := case when new.is_active then 'CATEGORY_ACTIVATED' else 'CATEGORY_DEACTIVATED' end;
  elsif (new.name, new.sort_order, new.fiscal_product_service_key, new.fiscal_unit_key, new.fiscal_tax_object)
        is distinct from
        (old.name, old.sort_order, old.fiscal_product_service_key, old.fiscal_unit_key, old.fiscal_tax_object) then
    v_accion := 'CATEGORY_UPDATED';
  else
    return new;
  end if;
  insert into public.audit_log
    (id, occurred_at, recorded_by, user_id, action, entity_type, entity_id, old_value, new_value)
  values (
    gen_random_uuid(), now(), (select auth.uid()), (select auth.uid()), v_accion,
    'product_category', new.id::text,
    case when tg_op = 'INSERT' then null
         else jsonb_build_object('nombre', old.name, 'activa', old.is_active, 'orden', old.sort_order) end,
    jsonb_build_object('nombre', new.name, 'activa', new.is_active, 'orden', new.sort_order)
  );
  return new;
end;
$$;
revoke all on function private.categorias_registrar_cambios() from public, anon, authenticated;
revoke all on function private.categoria_sin_productos_activos() from public, anon, authenticated;
create trigger product_categories_registrar_cambios
  after insert or update on public.product_categories
  for each row execute function private.categorias_registrar_cambios();
