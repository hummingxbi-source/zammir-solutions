-- S4-28 · Registro de errores sin datos personales [RNF-34, ADR-0034].
-- Los errores del navegador y de las funciones de servidor llegan ya limpios (el núcleo quita correos, teléfonos,
-- RFC, claves y la consulta de las direcciones) y aquí se guardan acotados. No se guarda IP, usuario ni cuerpo de
-- peticiones. Solo los administradores los leen; nada de esto es contable, así que se purga a los 90 días.

create table public.error_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  source text not null check (source in ('CLIENT', 'SERVER')),
  name text not null check (length(name) <= 100),
  message text not null check (length(message) <= 500),
  stack text not null default '' check (length(stack) <= 2000),
  route text not null default '/' check (length(route) <= 200),
  app_version text not null default 'desconocida' check (length(app_version) <= 40)
);

create index error_log_ocurrido_idx on public.error_log (occurred_at desc);

alter table public.error_log enable row level security;

create policy error_log_admin_select on public.error_log
  for select to authenticated
  using ((select private.is_admin()));

-- Registra un error. Tope global por minuto para que un ciclo de fallas no llene la tabla; devuelve si se guardó.
create or replace function public.error_log_record(
  p_source text,
  p_name text,
  p_message text,
  p_stack text,
  p_route text,
  p_app_version text,
  p_max_per_minute integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.error_log where occurred_at > now() - interval '1 minute') >= p_max_per_minute then
    return false;
  end if;
  insert into public.error_log (source, name, message, stack, route, app_version)
  values (p_source, left(p_name, 100), left(p_message, 500), left(coalesce(p_stack, ''), 2000),
          left(coalesce(p_route, '/'), 200), left(coalesce(p_app_version, 'desconocida'), 40));
  return true;
end;
$$;

-- Los errores recientes para que el administrador los revise.
create or replace function public.admin_error_log(p_limit integer default 100)
returns setof public.error_log
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'Solo los administradores ven el registro de errores' using errcode = '42501';
  end if;
  return query
  select * from public.error_log order by occurred_at desc limit least(greatest(p_limit, 1), 500);
end;
$$;

-- Borra lo anterior a 90 días; lo llama el mantenimiento programado (S4-26).
create or replace function public.error_log_purge(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  borrados integer;
begin
  delete from public.error_log where occurred_at < now() - make_interval(days => p_days);
  get diagnostics borrados = row_count;
  return borrados;
end;
$$;

-- Comprobación de salud: la base responde y el registro se puede leer. La usa la función pública `salud`.
create or replace function public.health_check()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from (select 1 from public.error_log limit 1) t) >= 0;
$$;

revoke all on function public.error_log_record(text, text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.error_log_purge(integer) from public, anon, authenticated;
revoke all on function public.health_check() from public, anon, authenticated;
revoke all on function public.admin_error_log(integer) from public, anon;
grant execute on function public.error_log_record(text, text, text, text, text, text, integer) to service_role;
grant execute on function public.error_log_purge(integer) to service_role;
grant execute on function public.health_check() to service_role;
grant execute on function public.admin_error_log(integer) to authenticated;
revoke all on table public.error_log from anon, authenticated;
grant select on table public.error_log to authenticated;
