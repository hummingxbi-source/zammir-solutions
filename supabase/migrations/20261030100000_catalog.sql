-- S1-05 · Catálogo: categorías iniciales y productos [RF-M1-01, RF-M1-02, RN-01, RN-02, RN-06, RN-28].
--
-- Quién puede qué (docs/arquitectura/AUTENTICACION.md §6):
--   administradores → leen y dan de alta productos; leen categorías
--   dispositivos    → leen categorías y la vista sellable_products (productos activos, sin datos
--                     fiscales ni de administración); NO leen la tabla products
--   cualquier otro  → nada
-- Nada se borra: no hay política de DELETE; los productos se desactivan (S1-06).

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  sort_order integer not null unique,
  -- Valores fiscales de PRUEBA hasta que el contador o el PAC los validen (PD-29).
  fiscal_product_service_key text check (fiscal_product_service_key ~ '^\d{8}$'),
  fiscal_unit_key text check (fiscal_unit_key ~ '^[A-Z0-9]{2,3}$'),
  fiscal_tax_object text check (fiscal_tax_object ~ '^\d{2}$')
);

comment on table public.product_categories is
  'Categorías del catálogo. Las iniciales salen de RF-M1-02; las demás esperan a Luis (PD-49).';

insert into public.product_categories
  (name, sort_order, fiscal_product_service_key, fiscal_unit_key, fiscal_tax_object)
values
  ('Vidrio claro / flotado',     1, '01010101', 'MTK', '02'),
  ('Vidrio templado',            2, '01010101', 'MTK', '02'),
  ('Esmerilado / satinado',      3, '01010101', 'MTK', '02'),
  ('Decorado / emplomado',       4, '01010101', 'MTK', '02'),
  ('Espejo',                     5, '01010101', 'MTK', '02'),
  ('Cristal doble / termopanel', 6, '01010101', 'MTK', '02'),
  ('Acrílico',                   7, '01010101', 'MTK', '02'),
  ('Aluminio y cancelería',      8, '01010101', 'H87', '02'),
  ('Herrajes',                   9, '01010101', 'H87', '02'),
  ('Selladores y silicón',      10, '01010101', 'H87', '02'),
  ('Servicios',                 11, '01010101', 'E48', '02');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text check (code is null or length(btrim(code)) > 0),
  name text not null check (length(btrim(name)) > 0),
  category_id uuid not null references public.product_categories (id),
  kind text not null check (kind in ('CUSTOM', 'STANDARD', 'SERVICE')),
  charge_unit text not null check (charge_unit in ('SQUARE_METER', 'LINEAR_METER', 'PIECE', 'SERVICE')),
  -- Precio con IVA incluido, en centavos enteros [RN-05, RN-06].
  list_price_cents bigint not null check (list_price_cents >= 0),
  is_tax_exempt boolean not null default false,
  is_active boolean not null default true,
  -- Regla de precio y sus parámetros, en datos y no en código [RN-02, ADR-0006].
  rule_id text not null check (length(rule_id) > 0),
  rule_params jsonb not null default '{}'::jsonb,
  fiscal_product_service_key text check (fiscal_product_service_key ~ '^\d{8}$'),
  fiscal_unit_key text check (fiscal_unit_key ~ '^[A-Z0-9]{2,3}$'),
  fiscal_tax_object text check (fiscal_tax_object ~ '^\d{2}$'),
  warranty_months integer check (warranty_months > 0),
  warranty_text text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  -- El tipo limita la unidad de cobro, igual que el dominio.
  check (
    (kind = 'CUSTOM' and charge_unit in ('SQUARE_METER', 'LINEAR_METER', 'PIECE'))
    or (kind = 'STANDARD' and charge_unit = 'PIECE')
    or (kind = 'SERVICE' and charge_unit = 'SERVICE')
  )
);

comment on table public.products is
  'Productos del catálogo. Nunca se borran: se desactivan [CLAUDE.md regla 4].';

-- El código es opcional, pero si existe no se repite (sin distinguir mayúsculas).
create unique index products_code_unique on public.products (lower(btrim(code))) where code is not null;
create index products_category_idx on public.products (category_id);

alter table public.product_categories enable row level security;
alter table public.products enable row level security;

create policy "administradores y dispositivos leen las categorías"
  on public.product_categories
  for select
  to authenticated
  using ((select private.is_admin()) or (select private.is_device()));

create policy "solo administradores leen los productos"
  on public.products
  for select
  to authenticated
  using ((select private.is_admin()));

create policy "solo administradores dan de alta productos"
  on public.products
  for insert
  to authenticated
  with check ((select private.is_admin()));

revoke all on public.product_categories from anon, authenticated;
grant select on public.product_categories to authenticated;
revoke all on public.products from anon, authenticated;
grant select, insert on public.products to authenticated;

-- Lo que se necesita para vender: productos activos, sin datos fiscales ni de administración.
-- La vista se ejecuta con los permisos de su dueño (los dispositivos no leen la tabla), por eso
-- ella misma exige ser administrador o dispositivo activo.
create view public.sellable_products as
select
  id, code, name, category_id, kind, charge_unit, list_price_cents,
  is_tax_exempt, rule_id, rule_params
from public.products
where is_active and ((select private.is_admin()) or (select private.is_device()));

revoke all on public.sellable_products from anon, authenticated;
grant select on public.sellable_products to authenticated;
