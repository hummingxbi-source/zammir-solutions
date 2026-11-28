-- CE-09 · Paquetes [RF-M1-18, ADR-0048].
--
-- Un paquete ("cancel de baño" = vidrio templado + kit + tubo) es un producto de tipo BUNDLE con su lista de
-- componentes. Al agregarlo en el cotizador o el mostrador, la tablet lo convierte en un renglón normal por
-- componente, cada uno con su regla, precio e IVA: las cotizaciones, órdenes, ventas, documentos y el envío
-- desde la tablet no cambian. Aquí solo se guarda el paquete y viaja a la tablet.

-- El tipo nuevo. Se guarda como pieza para que la tabla valga; cada componente lleva su propia unidad.
alter table public.products drop constraint products_kind_valid;
alter table public.products add constraint products_kind_valid
  check (kind in ('CUSTOM', 'STANDARD', 'SERVICE', 'EXTRA', 'BUNDLE'));
alter table public.products drop constraint products_kind_unit;
alter table public.products add constraint products_kind_unit
  check (
    (kind = 'CUSTOM' and charge_unit in ('SQUARE_METER', 'LINEAR_METER', 'PIECE'))
    or (kind = 'STANDARD' and charge_unit = 'PIECE')
    or (kind = 'SERVICE' and charge_unit = 'SERVICE')
    or (kind = 'EXTRA' and charge_unit in ('SQUARE_METER', 'LINEAR_METER', 'PIECE'))
    or (kind = 'BUNDLE' and charge_unit = 'PIECE')
  );

-- Los componentes: [{ "productId": "...", "quantity": 2 }, ...]. Solo y siempre en un paquete, de 1 a 20.
-- Que existan y se puedan vender lo revisa la aplicación al guardar, con el catálogo de ese momento.
alter table public.products
  add column bundle_items jsonb not null default '[]'::jsonb
  check (jsonb_typeof(bundle_items) = 'array' and jsonb_array_length(bundle_items) <= 20);
alter table public.products add constraint products_bundle_items_only_bundle
  check ((kind = 'BUNDLE') = (jsonb_array_length(bundle_items) > 0));
-- Un paquete no tiene precio abierto: su precio es el de sus componentes.
alter table public.products drop constraint products_open_price_not_extra;
alter table public.products add constraint products_open_price_not_extra
  check (not is_open_price or kind not in ('EXTRA', 'BUNDLE'));

-- Entra a la lista de columnas que el administrador puede editar (20261030110000_catalog_edit.sql).
grant update (bundle_items) on public.products to authenticated;

create or replace view public.sellable_products as
select
  id, code, name, category_id, kind, charge_unit, list_price_cents,
  is_tax_exempt, rule_id, rule_params, is_open_price, description, sale_unit_name, bundle_items
from public.products
where is_active and ((select private.is_admin()) or (select private.is_device()));

create or replace view public.catalog_products_for_device as
select
  id, code, name, category_id, kind, charge_unit, list_price_cents,
  is_tax_exempt, is_active, rule_id, rule_params, change_seq, is_open_price, description, sale_unit_name,
  bundle_items
from public.products
where (select private.is_admin()) or (select private.is_device());
