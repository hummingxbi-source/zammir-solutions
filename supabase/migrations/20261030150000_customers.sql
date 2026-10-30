-- S1-10 · Clientes [RF-M5-01, RF-M5-04, RNF-06, RN-18, RN-22, RF-M10-13].
--
-- Quién puede qué (docs/arquitectura/AUTENTICACION.md §6):
--   administradores → leen, dan de alta y corrigen clientes, con sus datos fiscales
--   dispositivos    → leen la vista customers_for_device (sin datos fiscales: la tablet no guarda los
--                     de todos los clientes, RNF-06) y DAN DE ALTA clientes nuevos sin datos fiscales
--   cualquier otro  → nada
-- TRANSITORIO: la tablet escribe directo en esta tabla (solo altas, solo sin datos fiscales) hasta que
-- exista la función de operaciones del Sprint 2 [ADR-0012]; entonces este permiso se retira.
-- Nada se borra: los datos personales se anonimizan (S1-12).

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  -- WhatsApp o teléfono, ya normalizado a 10 dígitos. NO es único: solo se avisa del duplicado.
  phone text not null check (phone ~ '^\d{10}$'),
  email text,
  notes text,
  fiscal_rfc text check (fiscal_rfc ~ '^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$'),
  fiscal_legal_name text,
  fiscal_zip text check (fiscal_zip ~ '^\d{5}$'),
  fiscal_regime text,
  fiscal_cfdi_use text,
  -- Versión del aviso de privacidad que se le informó [RF-M9-03]; la registra S1-13.
  privacy_notice_version integer check (privacy_notice_version >= 1),
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

comment on table public.customers is
  'Clientes de ZAMMIR. Nunca se borran: sus datos personales se anonimizan.';

create index customers_phone_idx on public.customers (phone);

alter table public.customers enable row level security;

create policy "solo administradores leen los clientes completos"
  on public.customers
  for select
  to authenticated
  using ((select private.is_admin()));

create policy "administradores y dispositivos dan de alta clientes"
  on public.customers
  for insert
  to authenticated
  with check (
    (select private.is_admin())
    or (
      (select private.is_device())
      and fiscal_rfc is null and fiscal_legal_name is null and fiscal_zip is null
      and fiscal_regime is null and fiscal_cfdi_use is null
      and anonymized_at is null
    )
  );

create policy "solo administradores corrigen clientes"
  on public.customers
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

revoke all on public.customers from anon, authenticated;
grant select, insert on public.customers to authenticated;
-- El id, el alta y la anonimización no se cambian por aquí (la anonimización va por su función).
grant update (
  name, phone, email, notes, fiscal_rfc, fiscal_legal_name, fiscal_zip, fiscal_regime,
  fiscal_cfdi_use, privacy_notice_version
) on public.customers to authenticated;

-- Lo que la tablet puede ver de un cliente: sin datos fiscales.
create view public.customers_for_device as
select id, name, phone, email, notes, privacy_notice_version, anonymized_at
from public.customers
where (select private.is_admin()) or (select private.is_device());

revoke all on public.customers_for_device from anon, authenticated;
grant select on public.customers_for_device to authenticated;
