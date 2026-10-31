-- S2-03 · Cotizaciones emitidas y sus líneas [RF-M2-07, RN-03, ADR-0011, MODELO_DE_DATOS.md M2].
--
-- Solo se crean desde la función `receive_operation` (operación IssueQuote): la tablet no escribe estas
-- tablas directamente. Una cotización emitida es una instantánea: totales, líneas y folio no cambian
-- (el estado sí, con las transiciones válidas). Nada se borra [RN-18].

create sequence public.quote_change_seq;

create table public.quotes (
  id uuid primary key,
  -- Folio provisional del dispositivo (T1-0004) y definitivo (COT-2026-0012) [RN-16].
  temp_folio text not null check (temp_folio ~ '^T[0-9]+-[0-9]+$'),
  folio text unique check (folio ~ '^COT-[0-9]{4}-[0-9]{4,}$'),
  public_code text not null unique check (public_code ~ '^[A-Z2-9]{8}$'),
  status text not null default 'SENT' check (status in ('SENT', 'ACCEPTED', 'REJECTED')),
  customer_id uuid not null references public.customers (id),
  site_address text,
  issued_at timestamptz not null,
  valid_until date not null,
  conditions_text text not null,
  privacy_notice_version integer,
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  -- Versión del catálogo con la que se cotizó; permite avisar, sin bloquear, que el precio ya cambió.
  catalog_version bigint,
  device_id uuid not null references public.devices (id),
  user_id uuid not null,
  authorized_by uuid,
  op_id uuid not null,
  review_reason text,
  change_seq bigint not null default nextval('public.quote_change_seq'),
  created_at timestamptz not null default now(),
  check (total_cents = subtotal_cents + tax_cents)
);

comment on table public.quotes is
  'Cotizaciones emitidas (instantánea). Solo las crea receive_operation [ADR-0016].';

create index quotes_customer_idx on public.quotes (customer_id);
create index quotes_device_idx on public.quotes (device_id);
create unique index quotes_change_seq_idx on public.quotes (change_seq);

create table public.quote_lines (
  id uuid primary key,
  quote_id uuid not null references public.quotes (id),
  position integer not null check (position >= 1),
  product_id uuid,
  name text not null check (length(btrim(name)) > 0),
  charge_unit text not null check (charge_unit in ('SQUARE_METER', 'LINEAR_METER', 'PIECE', 'SERVICE')),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  rule_id text not null,
  rule_params jsonb not null default '{}'::jsonb,
  width_mm integer check (width_mm > 0),
  height_mm integer check (height_mm > 0),
  quantity integer not null check (quantity >= 1),
  line_total_cents bigint not null check (line_total_cents >= 0),
  base_cents bigint not null check (base_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  is_tax_exempt boolean not null default false,
  -- Cálculo tal como se mostró al usuario ("120 cm × 80 cm × 2 = 1.92 m² × $280.00").
  detail text not null default '',
  unique (quote_id, position),
  check (line_total_cents = base_cents + tax_cents)
);

create index quote_lines_quote_idx on public.quote_lines (quote_id);

alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;

create policy "solo administradores leen las cotizaciones"
  on public.quotes for select to authenticated
  using ((select private.is_admin()));
create policy "solo administradores leen las líneas de cotización"
  on public.quote_lines for select to authenticated
  using ((select private.is_admin()));

revoke all on public.quotes from anon, authenticated;
revoke all on public.quote_lines from anon, authenticated;
grant select on public.quotes to authenticated;
grant select on public.quote_lines to authenticated;

-- Una cotización emitida no cambia: ni totales, ni folio provisional, ni líneas. El folio definitivo
-- se asigna una sola vez (null → valor) y el estado solo avanza por transiciones válidas.
create function private.quotes_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Las cotizaciones no se borran' using errcode = 'P0001';
  end if;
  if new.id is distinct from old.id
     or new.temp_folio is distinct from old.temp_folio
     or new.public_code is distinct from old.public_code
     or new.customer_id is distinct from old.customer_id
     or new.issued_at is distinct from old.issued_at
     or new.valid_until is distinct from old.valid_until
     or new.conditions_text is distinct from old.conditions_text
     or new.subtotal_cents is distinct from old.subtotal_cents
     or new.tax_cents is distinct from old.tax_cents
     or new.total_cents is distinct from old.total_cents
     or new.device_id is distinct from old.device_id
     or new.op_id is distinct from old.op_id then
    raise exception 'Una cotización emitida no se modifica' using errcode = 'P0001';
  end if;
  if old.folio is not null and new.folio is distinct from old.folio then
    raise exception 'El folio definitivo no cambia' using errcode = 'P0001';
  end if;
  if new.status is distinct from old.status and not (
       (old.status = 'SENT' and new.status in ('ACCEPTED', 'REJECTED'))) then
    raise exception 'Transición de estado no permitida: % a %', old.status, new.status
      using errcode = 'P0001';
  end if;
  new.change_seq := nextval('public.quote_change_seq');
  return new;
end;
$$;

create trigger quotes_proteger
  before update or delete on public.quotes
  for each row execute function private.quotes_proteger();

create function private.quote_lines_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Las líneas de una cotización emitida no se modifican ni se borran'
    using errcode = 'P0001';
end;
$$;

create trigger quote_lines_proteger
  before update or delete on public.quote_lines
  for each row execute function private.quote_lines_proteger();
