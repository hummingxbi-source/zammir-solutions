-- S0-13 · Configuración del negocio e interruptores [RNF-36, ADR-0015].
-- Los porcentajes, plazos e interruptores viven aquí y no en el código. Los valores [POR DEFINIR]
-- se crean vacíos (JSON null) y su descripción cita el pendiente que los define: nunca se inventan
-- [CLAUDE.md regla 1].
--
-- Quién puede qué (docs/arquitectura/AUTENTICACION.md §6):
--   administradores (app_metadata.rol = 'ADMIN')  → leen y cambian el valor de un ajuste
--   dispositivos    (app_metadata.rol = 'DEVICE') → solo leen
--   anónimos                                      → nada
-- Los ajustes no se crean ni se borran desde la API: los agrega una migración.

create schema if not exists private;

create or replace function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'rol', '') = 'ADMIN'
$$;

create or replace function private.is_device()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) -> 'app_metadata' ->> 'rol', '') = 'DEVICE'
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_device() to authenticated;

create table public.business_settings (
  key text primary key,
  value jsonb not null,
  description text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.business_settings is
  'Ajustes del negocio. Las claves en inglés; un valor JSON null significa "por definir" (ver description).';

alter table public.business_settings enable row level security;

create policy "administradores y dispositivos leen los ajustes"
  on public.business_settings
  for select
  to authenticated
  using ((select private.is_admin()) or (select private.is_device()));

create policy "solo administradores cambian el valor de un ajuste"
  on public.business_settings
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Nadie entra por la API sin permiso explícito, y solo se puede cambiar el valor.
revoke all on public.business_settings from anon, authenticated;
grant select on public.business_settings to authenticated;
grant update (value) on public.business_settings to authenticated;

create or replace function private.touch_business_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger business_settings_touch
  before update on public.business_settings
  for each row execute function private.touch_business_settings();

insert into public.business_settings (key, value, description) values
  -- Conocidos
  ('tax_rate_bps', '1600', 'Tasa de IVA en puntos base (1600 = 16 %) [RN-06]'),
  ('deposit_percent_bps', '5000', 'Porcentaje de anticipo en puntos base (5000 = 50 %) [RN-08]'),
  ('quote_validity_days', '15', 'Vigencia de una cotización en días naturales [RN-12]'),
  ('idle_lock_minutes', '5', 'Minutos sin actividad antes de bloquear la tablet [RF-M4-08]'),
  ('receivable_aging_threshold_days', '10', 'Días a partir de los cuales se resalta una cuenta por cobrar [RF-M6-01, PD-33]'),
  ('deposit_tax_treatment', '"a"', 'Tratamiento fiscal de anticipos: "a" un CFDI al liquidar; "b" CFDI de anticipo y final [RN-27, PD-27]'),
  ('self_invoicing_deadline_rule', '"end_of_month"', 'Regla del plazo de autofacturación [RN-26, PD-09]'),
  ('sales_basis', '"cash_received"', 'Base de "ventas" en reportes: efectivo recibido [RN-20, PD-08]'),
  ('stamps_warning_percent', '80', 'Porcentaje del límite de timbres en que se avisa [RF-M10-20]'),
  -- Interruptores de lo que el cliente puede activar: apagados por defecto
  ('feature_p1', 'false', 'Interruptor P1: portal de seguimiento para el cliente final [ALCANCE §3, PD-13]'),
  ('feature_p2', 'false', 'Interruptor P2: existencias de piezas estándar [ALCANCE §3, PD-14]'),
  -- POR DEFINIR: vacíos hasta que se resuelva su pendiente
  ('admin_idle_logout_minutes', 'null', 'POR DEFINIR (PD-21): minutos de inactividad para cerrar la sesión de un administrador'),
  ('pin_max_failed_attempts', 'null', 'POR DEFINIR (PD-22): intentos fallidos de PIN antes de bloquear'),
  ('pin_lock_seconds', 'null', 'POR DEFINIR (PD-22): duración base del bloqueo tras los intentos fallidos'),
  ('warranty_months_default', 'null', 'POR DEFINIR (PD-06): duración de la garantía en meses'),
  ('self_invoicing_legend', 'null', 'POR DEFINIR (PD-09): leyenda del plazo de autofacturación en tickets y comprobantes'),
  ('stamps_yearly_limit', 'null', 'POR DEFINIR (PD-26): límite anual de timbres del paquete'),
  ('business_name', 'null', 'POR DEFINIR (PD-11): nombre comercial de ZAMMIR en documentos'),
  ('business_phone', 'null', 'POR DEFINIR (PD-11): teléfono de ZAMMIR en documentos'),
  ('business_address', 'null', 'POR DEFINIR (PD-11): domicilio de ZAMMIR en documentos'),
  ('business_logo_url', 'null', 'POR DEFINIR (PD-11): logotipo de ZAMMIR en documentos'),
  ('local_retention_days', 'null', 'POR DEFINIR (Fase 3, con Luis): días de historial que baja a la tablet');
