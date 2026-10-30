-- S1-13 · Aviso de privacidad y términos versionados [RF-M9-01, RF-M9-02, RF-M9-03, RN-18, RN-19].
--
-- Las versiones solo se agregan: editar el aviso es publicar una versión nueva con su fecha de vigencia,
-- y las anteriores se conservan intactas (incluso para el dueño de la tabla).
--
-- Quién puede qué (docs/arquitectura/AUTENTICACION.md §6):
--   administradores → leen y publican versiones
--   dispositivos    → leen (la tablet necesita el aviso vigente para informarlo al capturar un cliente)
--   cualquier otro  → nada

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('PRIVACY_NOTICE', 'TERMS')),
  -- Lo asigna la base (siguiente al más alto del tipo); nadie la manda.
  version integer not null check (version >= 1),
  -- Desde cuándo rige. Una versión con fecha futura todavía no es la vigente.
  effective_from timestamptz not null default now(),
  body text not null check (length(btrim(body)) > 0),
  edited_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (type, version)
);

comment on table public.legal_documents is
  'Aviso de privacidad y términos, por versión. Solo se agrega; nadie modifica ni borra versiones.';

alter table public.legal_documents enable row level security;

create policy "administradores y dispositivos leen los documentos legales"
  on public.legal_documents
  for select
  to authenticated
  using ((select private.is_admin()) or (select private.is_device()));

create policy "solo administradores publican documentos legales"
  on public.legal_documents
  for insert
  to authenticated
  with check ((select private.is_admin()));

revoke all on public.legal_documents from anon, authenticated;
grant select, insert on public.legal_documents to authenticated;

-- El número de versión lo pone la base: así dos publicaciones a la vez no repiten versión.
create or replace function private.legal_documents_asignar_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('legal_documents.' || new.type));
  select coalesce(max(version), 0) + 1 into new.version
  from public.legal_documents where type = new.type;
  return new;
end;
$$;

create trigger legal_documents_asignar_version
  before insert on public.legal_documents
  for each row execute function private.legal_documents_asignar_version();

-- Nadie modifica ni borra versiones, ni el dueño de la tabla.
create or replace function private.legal_documents_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Las versiones de los documentos legales no se modifican ni se borran' using errcode = 'P0001';
end;
$$;

create trigger legal_documents_no_update
  before update or delete on public.legal_documents
  for each row execute function private.legal_documents_inmutable();

create trigger legal_documents_no_truncate
  before truncate on public.legal_documents
  for each statement execute function private.legal_documents_inmutable();

-- Cada publicación deja su entrada de bitácora (las del sistema, sin persona, como la inicial, no).
create or replace function private.legal_documents_registrar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    insert into public.audit_log
      (id, occurred_at, recorded_by, user_id, action, entity_type, entity_id, old_value, new_value)
    values (
      gen_random_uuid(), now(), (select auth.uid()), (select auth.uid()), 'LEGAL_DOCUMENT_PUBLISHED',
      'legal_document', new.id::text,
      case when new.version > 1 then jsonb_build_object('version', new.version - 1) else null end,
      jsonb_build_object('tipo', new.type, 'version', new.version)
    );
  end if;
  return new;
end;
$$;

create trigger legal_documents_registrar
  after insert on public.legal_documents
  for each row execute function private.legal_documents_registrar();

-- Borrador inicial del aviso de privacidad (PD-12): lo entrega HummingX y el texto final lo valida ZAMMIR
-- con su asesor. Es un borrador genérico, sin datos reales; los campos entre corchetes se llenan al definir
-- los datos del negocio (PD-11).
insert into public.legal_documents (type, effective_from, body) values (
  'PRIVACY_NOTICE',
  '2026-10-30T00:00:00Z',
  E'BORRADOR — pendiente de revisión por el asesor de ZAMMIR (PD-12)\n\n'
  'AVISO DE PRIVACIDAD SIMPLIFICADO\n\n'
  'Responsable: ZAMMIR, Soluciones en Vidrio y Aluminio, [domicilio del negocio por definir].\n\n'
  'Datos que recabamos: tu nombre, tu teléfono o WhatsApp y, si lo proporcionas, tu correo, la dirección de '
  'la obra y, solo cuando pides factura, tus datos fiscales (RFC, razón social, código postal, régimen y uso '
  'del CFDI).\n\n'
  'Para qué los usamos: elaborar cotizaciones y órdenes de trabajo, contactarte sobre tu pedido, cobrar, '
  'dar garantía y emitir tu factura.\n\n'
  'Con quién los compartimos: cuando pides factura, tus datos fiscales se envían a nuestro proveedor '
  'autorizado de certificación (PAC) para timbrarla. No los vendemos.\n\n'
  'Tus derechos: puedes pedir acceso, corrección, cancelación u oposición al uso de tus datos escribiendo a '
  '[canal de contacto por definir]. También puedes pedir que anonimicemos tus datos personales; conservaremos '
  'solo los registros contables y fiscales que la ley nos obliga a guardar.'
);
