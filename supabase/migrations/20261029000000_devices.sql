-- S0-16a · Dispositivos y códigos de registro [RF-M8-02, RN-19, ADR-0013].
-- Un administrador genera un código de un solo uso y vida corta; la tablet lo canjea una vez
-- (el canje lo hace una función de servidor con la llave de servicio, S0-16b); el administrador
-- puede revocar el dispositivo. Un dispositivo revocado deja de operar y de enviar.
--
-- Quién puede qué (docs/arquitectura/AUTENTICACION.md §3 y §6):
--   administradores → generan códigos, listan y revocan dispositivos (solo mediante las funciones)
--   dispositivos    → ven únicamente su propio renglón, aunque estén revocados, para enterarse
--   servidor        → canjea códigos (llave de servicio)
--   cualquier otro  → nada
-- Los cambios pasan por funciones que dejan su entrada de bitácora en el mismo paso [RN-19].

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  -- Serie de folios temporales del dispositivo: T1-0001, T2-0001… [RN-16].
  temp_series integer not null unique check (temp_series >= 1),
  -- Identidad de la tablet en Supabase Auth (rol DEVICE), creada por la función de servidor.
  auth_user_id uuid not null unique,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REVOKED')),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  revoked_at timestamptz,
  check ((status = 'REVOKED') = (revoked_at is not null))
);

comment on table public.devices is
  'Tablets registradas. Nunca se borran: se revocan [CLAUDE.md regla 4].';

create table public.device_registration_codes (
  id uuid primary key default gen_random_uuid(),
  -- Solo el hash: el texto del código se muestra una vez, al generarlo.
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_device uuid references public.devices (id),
  created_by uuid not null,
  created_at timestamptz not null default now()
);

comment on table public.device_registration_codes is
  'Códigos de registro de un solo uso. Se guarda el hash, nunca el código.';

alter table public.devices enable row level security;
alter table public.device_registration_codes enable row level security;

-- El administrador consulta la lista con list_devices(), que deja su entrada de bitácora.
create policy "el propio dispositivo ve su renglón"
  on public.devices
  for select
  to authenticated
  using (auth_user_id = (select auth.uid()));

-- Los códigos no se tocan desde la API: solo por las funciones de abajo.
revoke all on public.devices from anon, authenticated;
grant select on public.devices to authenticated;
revoke all on public.device_registration_codes from anon, authenticated;

-- Un dispositivo solo opera mientras esté activo: al revocarlo, todas las políticas que
-- piden is_device() lo dejan fuera.
create or replace function private.is_device()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'rol', '') = 'DEVICE'
    and exists (
      select 1 from public.devices d
      where d.auth_user_id = (select auth.uid()) and d.status = 'ACTIVE'
    )
$$;

-- ---------- Generar un código (administradores) ----------
create or replace function public.create_device_registration_code(p_validity_minutes integer)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Sin letras ni números que se confundan (0/O, 1/I): se teclea a mano en la tablet.
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_bytes bytea;
  v_expira timestamptz;
  i integer;
begin
  if not (select private.is_admin()) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_validity_minutes is null or p_validity_minutes <= 0 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  v_bytes := extensions.gen_random_bytes(8);
  for i in 0..7 loop
    -- 256 es múltiplo de 32: cada letra del alfabeto sale con la misma probabilidad.
    v_code := v_code || substr(alfabeto, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  v_expira := now() + make_interval(mins => p_validity_minutes);

  insert into public.device_registration_codes (code_hash, expires_at, created_by)
  values (encode(extensions.digest(v_code, 'sha256'), 'hex'), v_expira, (select auth.uid()));

  return query select v_code, v_expira;
end;
$$;

-- ---------- Canjear un código (solo el servidor) ----------
create or replace function public.redeem_device_registration_code(
  p_code text,
  p_name text,
  p_auth_user_id uuid
)
returns public.devices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo public.device_registration_codes;
  v_dispositivo public.devices;
begin
  if p_name is null or length(btrim(p_name)) = 0 or p_auth_user_id is null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  -- Bloquea el renglón: dos canjes a la vez del mismo código no pueden ganar los dos.
  select * into v_codigo
  from public.device_registration_codes
  where code_hash = encode(extensions.digest(upper(btrim(p_code)), 'sha256'), 'hex')
  for update;

  if not found or v_codigo.used_at is not null or v_codigo.expires_at <= now() then
    raise exception 'CODE_INVALID' using errcode = 'P0001';
  end if;

  -- Un solo canje a la vez para que dos tablets nuevas no reciban la misma serie.
  perform pg_advisory_xact_lock(hashtext('devices.temp_series'));

  insert into public.devices (name, temp_series, auth_user_id)
  values (
    btrim(p_name),
    (select coalesce(max(temp_series), 0) + 1 from public.devices),
    p_auth_user_id
  )
  returning * into v_dispositivo;

  update public.device_registration_codes
  set used_at = now(), used_by_device = v_dispositivo.id
  where id = v_codigo.id;

  insert into public.audit_log
    (id, occurred_at, recorded_by, device_id, action, entity_type, entity_id, old_value, new_value)
  values (
    gen_random_uuid(), now(), p_auth_user_id, v_dispositivo.id, 'DEVICE_REGISTERED', 'device',
    v_dispositivo.id::text, null,
    jsonb_build_object('nombre', v_dispositivo.name, 'estado', v_dispositivo.status)
  );

  return v_dispositivo;
end;
$$;

-- ---------- Listar dispositivos (administradores) ----------
create or replace function public.list_devices()
returns setof public.devices
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  insert into public.audit_log
    (id, occurred_at, recorded_by, user_id, action, entity_type, entity_id)
  values (gen_random_uuid(), now(), (select auth.uid()), (select auth.uid()), 'DEVICES_LISTED', 'device', 'list');

  return query select * from public.devices order by temp_series;
end;
$$;

-- ---------- Revocar un dispositivo (administradores) ----------
create or replace function public.revoke_device(p_device_id uuid)
returns public.devices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispositivo public.devices;
begin
  if not (select private.is_admin()) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  select * into v_dispositivo from public.devices where id = p_device_id for update;
  if not found then
    raise exception 'DEVICE_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Revocar a uno ya revocado no cambia nada ni deja otra entrada.
  if v_dispositivo.status = 'ACTIVE' then
    update public.devices
    set status = 'REVOKED', revoked_at = now()
    where id = p_device_id
    returning * into v_dispositivo;

    insert into public.audit_log
      (id, occurred_at, recorded_by, user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      gen_random_uuid(), now(), (select auth.uid()), (select auth.uid()), 'DEVICE_REVOKED', 'device',
      p_device_id::text, jsonb_build_object('estado', 'ACTIVE'), jsonb_build_object('estado', 'REVOKED')
    );
  end if;

  return v_dispositivo;
end;
$$;

-- Permisos de ejecución: por omisión PostgreSQL deja ejecutar a todos; aquí se cierra y se abre a quien toca.
revoke execute on function public.create_device_registration_code(integer) from public, anon;
grant execute on function public.create_device_registration_code(integer) to authenticated;
revoke execute on function public.list_devices() from public, anon;
grant execute on function public.list_devices() to authenticated;
revoke execute on function public.revoke_device(uuid) from public, anon;
grant execute on function public.revoke_device(uuid) to authenticated;
revoke execute on function public.redeem_device_registration_code(text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.redeem_device_registration_code(text, text, uuid) to service_role;
