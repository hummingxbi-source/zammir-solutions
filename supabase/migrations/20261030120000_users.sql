-- S1-14 · Usuarios del mostrador con PIN [RF-M8-01, RF-M8-04, RN-18, RN-19, ADR-0013].
--
-- Del PIN solo existe su verificador (PBKDF2 con sal propia); el PIN en claro no está en ninguna
-- columna ni en la bitácora. Nada se borra: los usuarios se desactivan.
--
-- Quién puede qué (docs/arquitectura/AUTENTICACION.md §6):
--   administradores → leen, dan de alta y editan usuarios
--   dispositivos    → leen únicamente la vista login_users (lo que la tablet necesita para pedir el
--                     PIN sin internet; riesgo aceptado en ADR-0013 punto 3), no la tabla
--   cualquier otro  → nada

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  role text not null check (role in ('ADMIN', 'STAFF')),
  is_active boolean not null default true,
  pin_salt text not null check (length(pin_salt) > 0),
  pin_iterations integer not null check (pin_iterations > 0),
  pin_hash text not null check (length(pin_hash) > 0),
  pin_version integer not null default 1 check (pin_version >= 1),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

comment on table public.app_users is
  'Empleados que entran con PIN en la tablet. Solo el verificador del PIN; nunca se borran.';

-- Se elige a la persona por su nombre en la tablet: no puede haber dos iguales.
create unique index app_users_name_unique on public.app_users (lower(btrim(name)));

alter table public.app_users enable row level security;

create policy "solo administradores leen los usuarios"
  on public.app_users
  for select
  to authenticated
  using ((select private.is_admin()));

create policy "solo administradores dan de alta usuarios"
  on public.app_users
  for insert
  to authenticated
  with check ((select private.is_admin()));

create policy "solo administradores editan usuarios"
  on public.app_users
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.app_users from anon, authenticated;
grant select, insert on public.app_users to authenticated;
grant update (name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version)
  on public.app_users to authenticated;

-- Lo que la tablet necesita para pedir el PIN. Incluye a los desactivados para que la tablet
-- borre sus verificadores locales en la siguiente conexión.
create view public.login_users as
select id, name, role, is_active, pin_salt, pin_iterations, pin_hash, pin_version
from public.app_users
where (select private.is_admin()) or (select private.is_device());

revoke all on public.login_users from anon, authenticated;
grant select on public.login_users to authenticated;

-- Cada cambio deja su entrada de bitácora en el mismo paso, sin guardar el verificador.
create or replace function private.app_users_registrar_cambios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log
      (id, occurred_at, recorded_by, user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      gen_random_uuid(), now(), (select auth.uid()), (select auth.uid()), 'USER_CREATED', 'user',
      new.id::text, null,
      jsonb_build_object('nombre', new.name, 'rol', new.role, 'activo', new.is_active)
    );
    return new;
  end if;

  if new.name is distinct from old.name or new.role is distinct from old.role then
    insert into public.audit_log
      (id, occurred_at, recorded_by, user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      gen_random_uuid(), now(), (select auth.uid()), (select auth.uid()), 'USER_UPDATED', 'user',
      new.id::text,
      jsonb_build_object('nombre', old.name, 'rol', old.role),
      jsonb_build_object('nombre', new.name, 'rol', new.role)
    );
  end if;

  if new.is_active is distinct from old.is_active then
    insert into public.audit_log
      (id, occurred_at, recorded_by, user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      gen_random_uuid(), now(), (select auth.uid()), (select auth.uid()),
      case when new.is_active then 'USER_ACTIVATED' else 'USER_DEACTIVATED' end, 'user',
      new.id::text,
      jsonb_build_object('activo', old.is_active),
      jsonb_build_object('activo', new.is_active)
    );
  end if;

  if new.pin_hash is distinct from old.pin_hash then
    insert into public.audit_log
      (id, occurred_at, recorded_by, user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      gen_random_uuid(), now(), (select auth.uid()), (select auth.uid()), 'USER_PIN_RESET', 'user',
      new.id::text, null, jsonb_build_object('pin', 'restablecido')
    );
  end if;

  return new;
end;
$$;

create trigger app_users_registrar_cambios
  after insert or update on public.app_users
  for each row execute function private.app_users_registrar_cambios();

-- Configuración nueva: valores propuestos por el desarrollador, configurables (ADR-0013).
insert into public.business_settings (key, value, description) values
  ('admin_pin_min_digits', '6'::jsonb,
   'Mínimo de dígitos del PIN de un administrador (propuesta de ADR-0013 punto 4)'),
  ('pin_pbkdf2_iterations', '600000'::jsonb,
   'Vueltas de PBKDF2-HMAC-SHA256 al guardar un PIN; se ajusta tras medir en la tablet real (ADR-0013)');
