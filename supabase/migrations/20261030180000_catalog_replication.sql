-- S1-09 · Réplica del catálogo en la tablet [RNF sin internet, ADR-0013].
--
-- Cada alta o cambio de un producto recibe un número de cambio que solo crece. La tablet
-- guarda el último que recibió y pide "lo que cambió después": así no baja todo cada vez y los
-- cambios de precio llegan sin duplicar productos. Los productos desactivados también viajan (con su
-- marca) para que la tablet deje de ofrecerlos.

create sequence public.catalog_change_seq;

create function private.stamp_product_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.change_seq := nextval('public.catalog_change_seq');
  return new;
end;
$$;

alter table public.products add column change_seq bigint;

update public.products set change_seq = nextval('public.catalog_change_seq');

alter table public.products alter column change_seq set not null;

create unique index products_change_seq_idx on public.products (change_seq);

create trigger products_stamp_change
  before insert or update on public.products
  for each row execute function private.stamp_product_change();

-- Lo que la tablet replica: igual que sellable_products, pero con los desactivados y su número de cambio.
create view public.catalog_products_for_device as
select
  id, code, name, category_id, kind, charge_unit, list_price_cents,
  is_tax_exempt, is_active, rule_id, rule_params, change_seq
from public.products
where (select private.is_admin()) or (select private.is_device());

revoke all on public.catalog_products_for_device from anon, authenticated;
grant select on public.catalog_products_for_device to authenticated;
