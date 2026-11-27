-- CE-04 · Descripción del producto [RF-M1-13, ADR-0048, PP-04].
--
-- Texto opcional de hasta 500 caracteres. Se busca con él y se ve al elegir el producto en el cotizador y en
-- el mostrador, así que viaja a la tablet en las dos vistas que ella lee (al final, sin cambiar lo de antes).

alter table public.products add column description text
  check (description is null or (char_length(description) between 1 and 500));

-- Entra a la lista de columnas que el administrador puede editar (20261030110000_catalog_edit.sql).
grant update (description) on public.products to authenticated;

create or replace view public.sellable_products as
select
  id, code, name, category_id, kind, charge_unit, list_price_cents,
  is_tax_exempt, rule_id, rule_params, is_open_price, description
from public.products
where is_active and ((select private.is_admin()) or (select private.is_device()));

create or replace view public.catalog_products_for_device as
select
  id, code, name, category_id, kind, charge_unit, list_price_cents,
  is_tax_exempt, is_active, rule_id, rule_params, change_seq, is_open_price, description
from public.products
where (select private.is_admin()) or (select private.is_device());
