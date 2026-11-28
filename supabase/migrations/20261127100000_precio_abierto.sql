-- CE-01 · Precio abierto [RF-M1-10, ADR-0048].
--
-- Un producto con precio abierto tiene un precio de referencia (`list_price_cents`) y su precio se fija al
-- cotizar o vender. El servidor ya acepta una línea con un precio distinto del catálogo: si queda debajo, es un
-- descuento y va a revisión si no trae quien lo autorizó (S2-11). Aquí solo se guarda la marca y se manda a
-- la tablet. Un cargo extra copia su precio del catálogo a la pieza: no puede tener precio abierto.

alter table public.products add column is_open_price boolean not null default false;

alter table public.products add constraint products_open_price_not_extra
  check (not is_open_price or kind <> 'EXTRA');

-- El administrador edita productos con un permiso por columna (20261030110000_catalog_edit.sql): la marca
-- nueva entra a esa lista; sin esto, guardar cualquier cambio de un producto se rechaza.
grant update (is_open_price) on public.products to authenticated;

-- Las dos vistas que leen las tablets agregan la marca al final (las columnas de antes no cambian).
create or replace view public.sellable_products as
select
  id, code, name, category_id, kind, charge_unit, list_price_cents,
  is_tax_exempt, rule_id, rule_params, is_open_price
from public.products
where is_active and ((select private.is_admin()) or (select private.is_device()));

create or replace view public.catalog_products_for_device as
select
  id, code, name, category_id, kind, charge_unit, list_price_cents,
  is_tax_exempt, is_active, rule_id, rule_params, change_seq, is_open_price
from public.products
where (select private.is_admin()) or (select private.is_device());
