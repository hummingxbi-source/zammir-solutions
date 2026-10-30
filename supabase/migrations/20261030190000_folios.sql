-- S2-04 · Folio definitivo sin huecos ni duplicados [RN-15, RN-16, ADR-0016].
--
-- Un contador por (tipo de documento, año). `private.next_folio` lo incrementa con UPDATE ... RETURNING:
--   - el UPDATE bloquea la fila, así que dos transacciones simultáneas se turnan y nunca obtienen
--     el mismo número;
--   - si la transacción que lo pidió se revierte, el incremento se revierte con ella: no hay huecos
--     (por eso NO se usan secuencias de Postgres: no se revierten);
--   - conviene llamarla como ÚLTIMO paso de la transacción, para mantener el bloqueo breve.
-- Nadie lee ni escribe la tabla directamente: solo las funciones del servidor.

create table public.folio_counters (
  doc_type text not null check (doc_type in ('QUOTE', 'WORK_ORDER', 'COUNTER_SALE', 'INVOICE')),
  year integer not null check (year between 2000 and 9999),
  last_value bigint not null default 0 check (last_value >= 0),
  primary key (doc_type, year)
);

comment on table public.folio_counters is
  'Último folio asignado por tipo de documento y año. Solo lo toca private.next_folio [ADR-0016].';

alter table public.folio_counters enable row level security;
revoke all on public.folio_counters from anon, authenticated;

create function private.next_folio(p_doc_type text, p_year integer)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_value bigint;
begin
  insert into public.folio_counters (doc_type, year, last_value)
  values (p_doc_type, p_year, 0)
  on conflict (doc_type, year) do nothing;

  update public.folio_counters
     set last_value = last_value + 1
   where doc_type = p_doc_type and year = p_year
  returning last_value into v_value;

  return v_value;
end;
$$;

revoke all on function private.next_folio(text, integer) from public, anon, authenticated;

-- Año del folio: el de la fecha de emisión en hora de México (PD-23, propuesta).
create function private.folio_year(p_issued_at timestamptz)
returns integer
language sql
immutable
set search_path = ''
as $$
  select extract(year from p_issued_at at time zone 'America/Mexico_City')::integer;
$$;

revoke all on function private.folio_year(timestamptz) from public, anon, authenticated;
