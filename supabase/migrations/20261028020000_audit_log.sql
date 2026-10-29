-- S0-15 · Bitácora de acciones sensibles [RN-19, RN-18, RF-M8-03].
-- Registra quién hizo qué, desde qué dispositivo, cuándo (UTC) y el valor anterior y el nuevo.
-- Solo se agrega: nadie la modifica ni la borra, ni siquiera quien administra la base
-- (un disparador lo impide) [CLAUDE.md regla 4].
--
-- Quién puede qué (docs/arquitectura/AUTENTICACION.md §6-7):
--   administradores y dispositivos → agregan entradas
--   administradores                → leen la bitácora
--   cualquier otro                 → nada

create table public.audit_log (
  id uuid primary key,
  -- Hora del hecho según el dispositivo, en UTC; recorded_at es la hora en que el servidor lo recibió.
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  -- Quién actuó y desde qué dispositivo (la persona con PIN, no la sesión del dispositivo).
  user_id uuid,
  device_id uuid,
  -- Quién subió el registro (la sesión de Supabase), para detectar un registro con identidad falsa.
  recorded_by uuid not null default auth.uid(),
  action text not null check (length(action) > 0),
  entity_type text not null check (length(entity_type) > 0),
  entity_id text not null check (length(entity_id) > 0),
  old_value jsonb,
  new_value jsonb,
  -- Operación de sincronización que originó el registro, si la hubo [ADR-0016].
  op_id uuid
);

comment on table public.audit_log is
  'Bitácora de acciones sensibles. Solo se agrega; nadie modifica ni borra entradas.';

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_occurred_at_idx on public.audit_log (occurred_at desc);

alter table public.audit_log enable row level security;

create policy "administradores y dispositivos agregan a la bitácora"
  on public.audit_log
  for insert
  to authenticated
  with check ((select private.is_admin()) or (select private.is_device()));

create policy "solo administradores leen la bitácora"
  on public.audit_log
  for select
  to authenticated
  using ((select private.is_admin()));

revoke all on public.audit_log from anon, authenticated;
grant select, insert on public.audit_log to authenticated;

-- Sin UPDATE ni DELETE ni TRUNCATE para nadie, tampoco para el dueño de la tabla.
create or replace function private.audit_log_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La bitácora no se modifica ni se borra' using errcode = 'P0001';
end;
$$;

create trigger audit_log_no_update
  before update or delete on public.audit_log
  for each row execute function private.audit_log_inmutable();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.audit_log_inmutable();
