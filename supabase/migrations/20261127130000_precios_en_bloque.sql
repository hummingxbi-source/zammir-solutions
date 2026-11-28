-- CE-06 · Precios en bloque [RF-M1-15, ADR-0048, RN-19].
--
-- La importación para actualizar por código y el "subir o bajar por porcentaje" de una categoría cambian
-- varios productos a la vez. Tiene que ser todo o nada: o cambian todos o ninguno. Esta función los cambia en
-- una sola transacción, con los permisos de quien la llama (security invoker): pasan las mismas políticas y los
-- mismos permisos por columna que una edición normal, y el trigger de siempre deja el historial de precios y la
-- bitácora de cada producto (20261030110000_catalog_edit.sql).
--
-- Solo cambia el nombre, el precio y la descripción. Lo demás del producto no se toca desde aquí.

create or replace function public.update_products_in_bulk(p_changes jsonb)
returns setof public.products
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_change jsonb;
  v_product public.products;
begin
  if not (select private.is_admin()) then
    raise exception 'solo un administrador cambia precios en bloque' using errcode = '42501';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'p_changes debe ser un arreglo' using errcode = '22023';
  end if;

  for v_change in select value from jsonb_array_elements(p_changes) loop
    update public.products
       set name = v_change->>'name',
           list_price_cents = (v_change->>'listPriceCents')::bigint,
           description = nullif(v_change->>'description', '')
     where id = (v_change->>'id')::uuid
    returning * into v_product;
    -- Un producto que no existe cancela todo el lote: no queda ningún cambio a medias.
    if not found then
      raise exception 'el producto % no existe', v_change->>'id' using errcode = 'P0002';
    end if;
    return next v_product;
  end loop;
end;
$$;

revoke all on function public.update_products_in_bulk(jsonb) from public, anon;
grant execute on function public.update_products_in_bulk(jsonb) to authenticated;
