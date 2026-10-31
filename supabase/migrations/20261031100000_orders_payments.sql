-- S3-00 a S3-09 · Órdenes de trabajo, pagos y garantías [RF-M3-*, RN-08, RN-09, RN-10, RN-11, RN-14, RN-18,
-- RN-19, ADR-0016, ADR-0025, MODELO_DE_DATOS.md M3/M4].
--
-- Todo entra por `receive_operation` (operaciones CreateWorkOrder, UpdateWorkOrder, AdvanceWorkOrder,
-- DeliverWorkOrder, CancelWorkOrder, RegisterPayment). La tablet no escribe estas tablas.
--   - Una orden es una instantánea de la cotización aceptada (líneas y totales congelados).
--   - Los PAGOS SOLO SE AGREGAN: ni la aplicación ni nadie los actualiza o borra (disparador). El saldo
--     siempre se calcula: total − suma de pagos.
--   - El dinero recibido nunca se rechaza: si un pago excede el saldo o llega a una orden cancelada se
--     guarda igual y queda POR REVISAR con su motivo.
--   - Lo que ya ocurrió físicamente (entregar con saldo sin autorización, cancelar un cajero) se aplica y
--     queda POR REVISAR; nada se pierde ni se descarta [RN-18].

insert into public.business_settings (key, value, description) values
  ('require_deposit_to_start', 'true',
   'Pasar una orden a "en proceso" sin anticipo registrado exige autorización de un administrador [PD-39; valor de trabajo, por confirmar con Luis]'),
  ('public_base_url', 'null',
   'Dirección base de los enlaces de autofacturación en el QR [PD-10; sin definir: se usa un dominio de prueba]');

-- ---------- Bitácora: función de apoyo ----------
create function private.add_audit(
  p_user_id uuid, p_device_id uuid, p_action text, p_entity_type text, p_entity_id text,
  p_old jsonb, p_new jsonb, p_authorized_by uuid, p_op_id uuid
)
returns void
language sql
set search_path = ''
as $$
  insert into public.audit_log (id, occurred_at, user_id, device_id, action, entity_type, entity_id,
                                old_value, new_value, authorized_by, op_id)
  values (gen_random_uuid(), now(), p_user_id, p_device_id, p_action, p_entity_type, p_entity_id,
          p_old, p_new, p_authorized_by, p_op_id);
$$;

revoke all on function private.add_audit(uuid, uuid, text, text, text, jsonb, jsonb, uuid, uuid)
  from public, anon, authenticated;

-- ---------- Órdenes de trabajo ----------
create sequence public.work_order_change_seq;

create function private.stamp_work_order_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.change_seq := nextval('public.work_order_change_seq');
  return new;
end;
$$;

create table public.work_orders (
  id uuid primary key,
  temp_folio text not null check (temp_folio ~ '^T[0-9]+-[0-9]+$'),
  folio text unique check (folio ~ '^OT-[0-9]{4}-[0-9]{4,}$'),
  public_code text not null unique check (public_code ~ '^[A-Z2-9]{8}$'),
  status text not null default 'WAITING'
    check (status in ('WAITING', 'IN_PROCESS', 'READY', 'DELIVERED', 'CANCELLED')),
  customer_id uuid not null references public.customers (id),
  quote_id uuid references public.quotes (id),
  site_address text,
  description text,
  issued_at timestamptz not null,
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  -- Anticipo exigido: porcentaje configurado, redondeado hacia arriba [ADR-0011].
  deposit_percent_bps integer not null check (deposit_percent_bps between 0 and 10000),
  deposit_required_cents bigint not null check (deposit_required_cents >= 0),
  measured_by uuid,
  built_by uuid,
  installed_by uuid,
  estimated_delivery_date date,
  notes text,
  delivered_at timestamptz,
  delivered_with_balance boolean not null default false,
  delivery_reason text,
  delivery_authorized_by uuid,
  cancelled_at timestamptz,
  cancel_reason text,
  cancelled_by uuid,
  cancelled_from_status text,
  cancel_deposit_paid_cents bigint,
  device_id uuid not null references public.devices (id),
  user_id uuid not null,
  op_id uuid not null,
  review_reason text,
  change_seq bigint not null,
  created_at timestamptz not null default now(),
  check (total_cents = subtotal_cents + tax_cents),
  check (deposit_required_cents <= total_cents)
);

comment on table public.work_orders is
  'Órdenes de trabajo (instantánea de la cotización aceptada). Solo las escribe receive_operation.';

create index work_orders_customer_idx on public.work_orders (customer_id);
create index work_orders_status_idx on public.work_orders (status);
create unique index work_orders_change_seq_idx on public.work_orders (change_seq);
create trigger work_orders_stamp_change
  before insert or update on public.work_orders
  for each row execute function private.stamp_work_order_change();

alter table public.quotes add column converted_work_order_id uuid references public.work_orders (id);

-- Una cotización también cambia (aceptar, rechazar, convertir): se vuelve a marcar con su número de cambio.
create function private.stamp_quote_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.change_seq := nextval('public.quote_change_seq');
  return new;
end;
$$;
create trigger quotes_stamp_change
  before update on public.quotes
  for each row execute function private.stamp_quote_change();

create table public.work_order_lines (
  id uuid primary key,
  work_order_id uuid not null references public.work_orders (id),
  position integer not null check (position >= 1),
  product_id uuid,
  name text not null check (length(btrim(name)) > 0),
  charge_unit text not null check (charge_unit in ('SQUARE_METER', 'LINEAR_METER', 'PIECE', 'SERVICE')),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  catalog_price_cents bigint check (catalog_price_cents >= 0),
  rule_id text not null,
  rule_params jsonb not null default '{}'::jsonb,
  width_mm integer check (width_mm > 0),
  height_mm integer check (height_mm > 0),
  quantity integer not null check (quantity >= 1),
  line_total_cents bigint not null check (line_total_cents >= 0),
  base_cents bigint not null check (base_cents >= 0),
  tax_cents bigint not null check (tax_cents >= 0),
  is_tax_exempt boolean not null default false,
  detail text not null default '',
  display_unit text check (display_unit in ('cm', 'm')),
  unique (work_order_id, position),
  check (line_total_cents = base_cents + tax_cents)
);
create index work_order_lines_order_idx on public.work_order_lines (work_order_id);

create table public.work_order_status_events (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id),
  from_status text,
  to_status text not null,
  user_id uuid,
  device_id uuid,
  occurred_at timestamptz not null default now(),
  reason text,
  authorized_by uuid,
  op_id uuid
);
create index work_order_status_events_order_idx on public.work_order_status_events (work_order_id);

create table public.warranties (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null unique references public.work_orders (id),
  starts_on date not null,
  -- PD-06 sin respuesta: la duración no se inventa. Vacía hasta que se defina; editable.
  duration_months integer check (duration_months > 0),
  coverage text,
  exclusions text,
  created_at timestamptz not null default now()
);

-- ---------- Pagos: solo se agregan ----------
create sequence public.payment_change_seq;

create table public.payments (
  id uuid primary key,
  -- Un cobro mixto son varias filas con el mismo grupo [RN-10].
  group_id uuid not null,
  work_order_id uuid references public.work_orders (id),
  -- La venta de mostrador llega en una historia posterior (S3-11); aquí solo se reserva el destino.
  counter_sale_id uuid,
  kind text not null check (kind in ('DEPOSIT', 'BALANCE', 'SALE')),
  method text not null check (method in ('CASH', 'TRANSFER')),
  -- Lo que se APLICA a la orden o venta; el cambio de un pago en efectivo no cuenta.
  amount_cents bigint not null check (amount_cents > 0),
  cash_received_cents bigint,
  change_cents bigint,
  reference text,
  user_id uuid not null,
  device_id uuid not null references public.devices (id),
  paid_at timestamptz not null,
  cash_shift_id uuid,
  op_id uuid not null,
  change_seq bigint not null default nextval('public.payment_change_seq'),
  created_at timestamptz not null default now(),
  check ((work_order_id is not null) <> (counter_sale_id is not null)),
  check (
    (method = 'CASH' and cash_received_cents is not null and cash_received_cents >= amount_cents
       and change_cents = cash_received_cents - amount_cents)
    or (method = 'TRANSFER' and cash_received_cents is null and change_cents is null)
  )
);
create index payments_order_idx on public.payments (work_order_id);
create unique index payments_change_seq_idx on public.payments (change_seq);

create function private.payments_are_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Los pagos solo se agregan: no se modifican ni se borran [RN-18]'
    using errcode = '42501';
end;
$$;
create trigger payments_append_only
  before update or delete on public.payments
  for each row execute function private.payments_are_append_only();

create trigger work_order_status_events_append_only
  before update or delete on public.work_order_status_events
  for each row execute function private.payments_are_append_only();

-- ---------- Permisos y lectura ----------
alter table public.work_orders enable row level security;
alter table public.work_order_lines enable row level security;
alter table public.work_order_status_events enable row level security;
alter table public.warranties enable row level security;
alter table public.payments enable row level security;

create policy "solo administradores leen las órdenes" on public.work_orders
  for select to authenticated using ((select private.is_admin()));
create policy "solo administradores leen las líneas de orden" on public.work_order_lines
  for select to authenticated using ((select private.is_admin()));
create policy "solo administradores leen los cambios de estado" on public.work_order_status_events
  for select to authenticated using ((select private.is_admin()));
create policy "solo administradores leen las garantías" on public.warranties
  for select to authenticated using ((select private.is_admin()));
create policy "solo administradores leen los pagos" on public.payments
  for select to authenticated using ((select private.is_admin()));

revoke all on public.work_orders, public.work_order_lines, public.work_order_status_events,
  public.warranties, public.payments from anon, authenticated;
grant select on public.work_orders, public.work_order_lines, public.work_order_status_events,
  public.warranties, public.payments to authenticated;
-- La garantía la completa un administrador (duración y cobertura) cuando se defina PD-06.
create policy "solo administradores corrigen las garantías" on public.warranties
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
grant update (duration_months, coverage, exclusions) on public.warranties to authenticated;

-- Lo que la tablet replica: sin datos fiscales, con número de cambio [SINCRONIZACION.md §7].
create view public.work_orders_for_device as
select
  o.id, o.temp_folio, o.folio, o.public_code, o.status, o.customer_id, o.quote_id, o.site_address,
  o.description, o.issued_at, o.subtotal_cents, o.tax_cents, o.total_cents, o.deposit_percent_bps,
  o.deposit_required_cents, o.measured_by, o.built_by, o.installed_by, o.estimated_delivery_date,
  o.notes, o.delivered_at, o.delivered_with_balance, o.delivery_reason, o.delivery_authorized_by,
  o.cancelled_at, o.cancel_reason, o.cancelled_by, o.cancelled_from_status, o.cancel_deposit_paid_cents,
  o.user_id, o.review_reason, o.change_seq,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'productId', l.product_id, 'name', l.name, 'chargeUnit', l.charge_unit,
      'unitPriceCents', l.unit_price_cents, 'catalogPriceCents', l.catalog_price_cents,
      'ruleId', l.rule_id, 'ruleParams', l.rule_params, 'widthMm', l.width_mm, 'heightMm', l.height_mm,
      'quantity', l.quantity, 'lineTotalCents', l.line_total_cents, 'baseCents', l.base_cents,
      'taxCents', l.tax_cents, 'isTaxExempt', l.is_tax_exempt, 'detail', l.detail,
      'displayUnit', l.display_unit) order by l.position)
    from public.work_order_lines l where l.work_order_id = o.id
  ), '[]'::jsonb) as lines
from public.work_orders o
where (select private.is_admin()) or (select private.is_device());

create view public.payments_for_device as
select id, group_id, work_order_id, counter_sale_id, kind, method, amount_cents, cash_received_cents,
       change_cents, reference, user_id, paid_at, cash_shift_id, change_seq
from public.payments
where (select private.is_admin()) or (select private.is_device());

revoke all on public.work_orders_for_device, public.payments_for_device from anon, authenticated;
grant select on public.work_orders_for_device, public.payments_for_device to authenticated;

-- ---------- Aplicación de cada operación ----------
create function private.work_order_paid_cents(p_order_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(amount_cents), 0)::bigint from public.payments where work_order_id = p_order_id;
$$;

create function private.apply_create_work_order(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'id')::uuid;
  v_issued_at timestamptz := (p_payload->>'issuedAt')::timestamptz;
  v_quote_id uuid := nullif(p_payload->>'quoteId', '')::uuid;
  v_quote public.quotes;
  v_reason text;
  v_year integer;
  v_number bigint;
  v_folio text;
  v_line jsonb;
  v_position integer := 0;
begin
  if not exists (select 1 from public.customers where id = (p_payload->>'customerId')::uuid) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'CUSTOMER_NOT_FOUND');
  end if;

  if exists (select 1 from public.work_orders where public_code = p_payload->>'publicCode') then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'PUBLIC_CODE_CONFLICT');
  end if;

  if v_quote_id is not null then
    select * into v_quote from public.quotes where id = v_quote_id for update;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'QUOTE_NOT_FOUND');
    end if;
    -- La orden ya existe en la tablet: se guarda y se revisa, no se descarta.
    if v_quote.converted_work_order_id is not null then
      v_reason := 'QUOTE_ALREADY_CONVERTED';
    elsif v_quote.status <> 'ACCEPTED' then
      v_reason := 'QUOTE_NOT_ACCEPTED';
    end if;
  end if;

  insert into public.work_orders (
    id, temp_folio, public_code, customer_id, quote_id, site_address, description, issued_at,
    subtotal_cents, tax_cents, total_cents, deposit_percent_bps, deposit_required_cents,
    device_id, user_id, op_id, review_reason, change_seq
  ) values (
    v_id, p_payload->>'tempFolio', p_payload->>'publicCode', (p_payload->>'customerId')::uuid,
    v_quote_id, p_payload->>'siteAddress', p_payload->>'description', v_issued_at,
    (p_payload->>'subtotalCents')::bigint, (p_payload->>'taxCents')::bigint,
    (p_payload->>'totalCents')::bigint, (p_payload->>'depositPercentBps')::integer,
    (p_payload->>'depositRequiredCents')::bigint, p_device.id, p_user_id, p_op_id, v_reason, 0
  );

  for v_line in select * from jsonb_array_elements(p_payload->'lines') loop
    v_position := v_position + 1;
    insert into public.work_order_lines (
      id, work_order_id, position, product_id, name, charge_unit, unit_price_cents, catalog_price_cents,
      rule_id, rule_params, width_mm, height_mm, quantity, line_total_cents, base_cents, tax_cents,
      is_tax_exempt, detail, display_unit
    ) values (
      (v_line->>'id')::uuid, v_id, v_position, nullif(v_line->>'productId', '')::uuid,
      v_line->>'name', v_line->>'chargeUnit', (v_line->>'unitPriceCents')::bigint,
      coalesce((v_line->>'catalogPriceCents')::bigint, (v_line->>'unitPriceCents')::bigint),
      v_line->>'ruleId', coalesce(v_line->'ruleParams', '{}'::jsonb),
      nullif(v_line->>'widthMm', '')::integer, nullif(v_line->>'heightMm', '')::integer,
      (v_line->>'quantity')::integer, (v_line->>'lineTotalCents')::bigint,
      (v_line->>'baseCents')::bigint, (v_line->>'taxCents')::bigint,
      coalesce((v_line->>'isTaxExempt')::boolean, false), coalesce(v_line->>'detail', ''),
      nullif(v_line->>'displayUnit', '')
    );
  end loop;

  if v_quote_id is not null and v_reason is null then
    update public.quotes set converted_work_order_id = v_id where id = v_quote_id;
  end if;

  insert into public.work_order_status_events (work_order_id, from_status, to_status, user_id, device_id,
                                               occurred_at, op_id)
  values (v_id, null, 'WAITING', p_user_id, p_device.id, v_issued_at, p_op_id);

  -- El folio es el último paso: el bloqueo de su fila dura lo menos posible.
  v_year := private.folio_year(v_issued_at);
  v_number := private.next_folio('WORK_ORDER', v_year);
  v_folio := 'OT-' || v_year::text || '-' || lpad(v_number::text, 4, '0');
  update public.work_orders set folio = v_folio where id = v_id;

  perform private.add_audit(p_user_id, p_device.id, 'WORK_ORDER_CREATED', 'work_order', v_id::text, null,
    jsonb_build_object('folio', v_folio, 'tempFolio', p_payload->>'tempFolio',
                       'totalCents', (p_payload->>'totalCents')::bigint, 'quoteId', v_quote_id),
    null, p_op_id);

  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason,
                              'folio', v_folio, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_folio, 'documentId', v_id);
end;
$$;

create function private.apply_update_work_order(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'id')::uuid;
  v_patch jsonb := p_payload->'patch';
  v_old public.work_orders;
  v_key text;
  v_old_values jsonb := '{}'::jsonb;
  v_new_values jsonb := '{}'::jsonb;
begin
  select * into v_old from public.work_orders where id = v_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'ORDER_NOT_FOUND');
  end if;

  -- Por campo gana el último que llega; el valor anterior queda en la bitácora [RNF-05, RN-19].
  if jsonb_exists(v_patch, 'measuredBy') then
    v_old_values := v_old_values || jsonb_build_object('measuredBy', v_old.measured_by);
    v_new_values := v_new_values || jsonb_build_object('measuredBy', v_patch->'measuredBy');
    update public.work_orders set measured_by = nullif(v_patch->>'measuredBy', '')::uuid where id = v_id;
  end if;
  if jsonb_exists(v_patch, 'builtBy') then
    v_old_values := v_old_values || jsonb_build_object('builtBy', v_old.built_by);
    v_new_values := v_new_values || jsonb_build_object('builtBy', v_patch->'builtBy');
    update public.work_orders set built_by = nullif(v_patch->>'builtBy', '')::uuid where id = v_id;
  end if;
  if jsonb_exists(v_patch, 'installedBy') then
    v_old_values := v_old_values || jsonb_build_object('installedBy', v_old.installed_by);
    v_new_values := v_new_values || jsonb_build_object('installedBy', v_patch->'installedBy');
    update public.work_orders set installed_by = nullif(v_patch->>'installedBy', '')::uuid where id = v_id;
  end if;
  if jsonb_exists(v_patch, 'estimatedDeliveryDate') then
    v_old_values := v_old_values || jsonb_build_object('estimatedDeliveryDate', v_old.estimated_delivery_date);
    v_new_values := v_new_values || jsonb_build_object('estimatedDeliveryDate', v_patch->'estimatedDeliveryDate');
    update public.work_orders
       set estimated_delivery_date = nullif(v_patch->>'estimatedDeliveryDate', '')::date where id = v_id;
  end if;
  if jsonb_exists(v_patch, 'notes') then
    v_old_values := v_old_values || jsonb_build_object('notes', v_old.notes);
    v_new_values := v_new_values || jsonb_build_object('notes', v_patch->'notes');
    update public.work_orders set notes = nullif(v_patch->>'notes', '') where id = v_id;
  end if;

  if v_new_values <> '{}'::jsonb then
    perform private.add_audit(p_user_id, p_device.id, 'WORK_ORDER_UPDATED', 'work_order', v_id::text,
                              v_old_values, v_new_values, null, p_op_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_old.folio, 'documentId', v_id);
end;
$$;

create function private.apply_advance_work_order(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_authorized_by uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'id')::uuid;
  v_to text := p_payload->>'to';
  v_order public.work_orders;
  v_reason text;
begin
  select * into v_order from public.work_orders where id = v_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'ORDER_NOT_FOUND');
  end if;

  -- Transición no válida (otra tablet ya la cambió): se registra y queda por revisar, sin tocar la orden.
  if not ((v_order.status = 'WAITING' and v_to = 'IN_PROCESS')
       or (v_order.status = 'IN_PROCESS' and v_to = 'READY')) then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'INVALID_TRANSITION',
                              'folio', v_order.folio, 'documentId', v_id);
  end if;

  -- PD-39: empezar sin anticipo registrado exige autorización de un administrador (configurable).
  if v_to = 'IN_PROCESS'
     and coalesce((select (value)::boolean from public.business_settings where key = 'require_deposit_to_start'), true)
     and private.work_order_paid_cents(v_id) = 0
     and p_authorized_by is null then
    v_reason := 'STARTED_WITHOUT_DEPOSIT';
  end if;

  update public.work_orders set status = v_to where id = v_id;
  insert into public.work_order_status_events (work_order_id, from_status, to_status, user_id, device_id,
                                               reason, authorized_by, op_id)
  values (v_id, v_order.status, v_to, p_user_id, p_device.id, p_payload->>'reason', p_authorized_by, p_op_id);
  perform private.add_audit(p_user_id, p_device.id, 'WORK_ORDER_STATUS_CHANGED', 'work_order', v_id::text,
    jsonb_build_object('estado', v_order.status), jsonb_build_object('estado', v_to),
    p_authorized_by, p_op_id);

  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason,
                              'folio', v_order.folio, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_order.folio, 'documentId', v_id);
end;
$$;

create function private.apply_deliver_work_order(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_authorized_by uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'id')::uuid;
  v_order public.work_orders;
  v_balance bigint;
  v_reason text;
  v_text text := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  v_months integer;
  v_now timestamptz := now();
begin
  select * into v_order from public.work_orders where id = v_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'ORDER_NOT_FOUND');
  end if;
  if v_order.status <> 'READY' then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'INVALID_TRANSITION',
                              'folio', v_order.folio, 'documentId', v_id);
  end if;

  v_balance := v_order.total_cents - private.work_order_paid_cents(v_id);
  -- Entregar con saldo: solo con autorización de un administrador y motivo. Si ya ocurrió sin ellas, se
  -- aplica y se revisa [RN-09, RF-M3-04].
  if v_balance > 0 and (p_authorized_by is null or v_text is null) then
    v_reason := 'DELIVERED_WITH_BALANCE_WITHOUT_AUTHORIZATION';
  end if;

  update public.work_orders
     set status = 'DELIVERED', delivered_at = v_now, delivered_with_balance = v_balance > 0,
         delivery_reason = case when v_balance > 0 then v_text end,
         delivery_authorized_by = case when v_balance > 0 then p_authorized_by end
   where id = v_id;
  insert into public.work_order_status_events (work_order_id, from_status, to_status, user_id, device_id,
                                               reason, authorized_by, op_id)
  values (v_id, 'READY', 'DELIVERED', p_user_id, p_device.id, v_text, p_authorized_by, p_op_id);

  -- Garantía escrita [RN-14]: la duración sale de la configuración y, si no está definida, queda vacía.
  select (value)::integer into v_months from public.business_settings where key = 'warranty_months_default'
     and value <> 'null'::jsonb;
  insert into public.warranties (work_order_id, starts_on, duration_months)
  values (v_id, (v_now at time zone 'America/Mexico_City')::date, v_months)
  on conflict (work_order_id) do nothing;

  perform private.add_audit(p_user_id, p_device.id, 'WORK_ORDER_DELIVERED', 'work_order', v_id::text,
    jsonb_build_object('estado', 'READY'),
    jsonb_build_object('estado', 'DELIVERED', 'saldoCentavos', v_balance, 'motivo', v_text),
    p_authorized_by, p_op_id);

  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason,
                              'folio', v_order.folio, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_order.folio, 'documentId', v_id);
end;
$$;

create function private.apply_cancel_work_order(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_authorized_by uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := (p_payload->>'id')::uuid;
  v_order public.work_orders;
  v_text text := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  v_reason text;
  v_admin boolean;
  v_paid bigint;
begin
  select * into v_order from public.work_orders where id = v_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'ORDER_NOT_FOUND');
  end if;
  if v_order.status in ('DELIVERED', 'CANCELLED') then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', 'INVALID_TRANSITION',
                              'folio', v_order.folio, 'documentId', v_id);
  end if;

  select exists (select 1 from public.app_users where id = coalesce(p_authorized_by, p_user_id)
                   and role = 'ADMIN' and is_active) into v_admin;
  if not v_admin or v_text is null then
    v_reason := 'CANCEL_WITHOUT_AUTHORIZATION';
  end if;

  -- PD-07 sin respuesta: solo se registra cuánto anticipo había; no hay devolución automática.
  v_paid := private.work_order_paid_cents(v_id);
  update public.work_orders
     set status = 'CANCELLED', cancelled_at = now(), cancel_reason = v_text, cancelled_by = p_user_id,
         cancelled_from_status = v_order.status, cancel_deposit_paid_cents = v_paid
   where id = v_id;
  insert into public.work_order_status_events (work_order_id, from_status, to_status, user_id, device_id,
                                               reason, authorized_by, op_id)
  values (v_id, v_order.status, 'CANCELLED', p_user_id, p_device.id, v_text, p_authorized_by, p_op_id);
  perform private.add_audit(p_user_id, p_device.id, 'WORK_ORDER_CANCELLED', 'work_order', v_id::text,
    jsonb_build_object('estado', v_order.status),
    jsonb_build_object('estado', 'CANCELLED', 'motivo', v_text, 'anticipoCentavos', v_paid),
    p_authorized_by, p_op_id);

  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason,
                              'folio', v_order.folio, 'documentId', v_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_order.folio, 'documentId', v_id);
end;
$$;

create function private.apply_register_payment(
  p_op_id uuid, p_device public.devices, p_user_id uuid, p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_order_id uuid := nullif(p_payload#>>'{target,id}', '')::uuid;
  v_order public.work_orders;
  v_row jsonb;
  v_applied bigint := 0;
  v_balance bigint;
  v_reason text;
  v_paid_at timestamptz := (p_payload->>'paidAt')::timestamptz;
begin
  if p_payload#>>'{target,type}' <> 'WORK_ORDER' then
    -- Las ventas de mostrador llegan con su historia (S3-11).
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'TARGET_NOT_SUPPORTED');
  end if;
  select * into v_order from public.work_orders where id = v_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PAYLOAD', 'detail', 'ORDER_NOT_FOUND');
  end if;

  for v_row in select * from jsonb_array_elements(p_payload->'rows') loop
    v_applied := v_applied + (v_row->>'amountCents')::bigint;
  end loop;
  v_balance := v_order.total_cents - private.work_order_paid_cents(v_order_id);
  -- El dinero recibido nunca se rechaza: se guarda y, si no cuadra, se revisa.
  if v_applied > v_balance then
    v_reason := 'PAYMENT_EXCEEDS_BALANCE';
  elsif v_order.status = 'CANCELLED' then
    v_reason := 'ORDER_CANCELLED';
  end if;

  for v_row in select * from jsonb_array_elements(p_payload->'rows') loop
    insert into public.payments (
      id, group_id, work_order_id, kind, method, amount_cents, cash_received_cents, change_cents,
      reference, user_id, device_id, paid_at, op_id
    ) values (
      (v_row->>'id')::uuid, (p_payload->>'groupId')::uuid, v_order_id, p_payload->>'kind',
      v_row->>'method', (v_row->>'amountCents')::bigint,
      nullif(v_row->>'cashReceivedCents', '')::bigint,
      case when v_row->>'method' = 'CASH'
           then (v_row->>'cashReceivedCents')::bigint - (v_row->>'amountCents')::bigint end,
      nullif(v_row->>'reference', ''), p_user_id, p_device.id, v_paid_at, p_op_id
    );
  end loop;

  perform private.add_audit(p_user_id, p_device.id, 'PAYMENT_REGISTERED', 'work_order', v_order_id::text,
    jsonb_build_object('saldoCentavos', v_balance),
    jsonb_build_object('aplicadoCentavos', v_applied, 'tipo', p_payload->>'kind'), null, p_op_id);

  if v_reason is not null then
    return jsonb_build_object('ok', true, 'status', 'TO_REVIEW', 'reason', v_reason,
                              'folio', v_order.folio, 'documentId', v_order_id);
  end if;
  return jsonb_build_object('ok', true, 'status', 'APPLIED', 'folio', v_order.folio, 'documentId', v_order_id);
end;
$$;

revoke all on function private.work_order_paid_cents(uuid) from public, anon, authenticated;
revoke all on function private.apply_create_work_order(uuid, public.devices, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.apply_update_work_order(uuid, public.devices, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.apply_advance_work_order(uuid, public.devices, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.apply_deliver_work_order(uuid, public.devices, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.apply_cancel_work_order(uuid, public.devices, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.apply_register_payment(uuid, public.devices, uuid, jsonb)
  from public, anon, authenticated;

create or replace function public.receive_operation(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op_id uuid := (p->>'opId')::uuid;
  v_device_id uuid := (p->>'deviceId')::uuid;
  v_seq bigint := (p->>'seq')::bigint;
  v_type text := p->>'type';
  v_user_id uuid := nullif(p->>'userId', '')::uuid;
  v_authorized_by uuid := nullif(p->>'authorizedBy', '')::uuid;
  v_payload jsonb := p->'payload';
  v_device public.devices;
  v_existing jsonb;
  v_result jsonb;
  v_status text;
  v_reason text;
begin
  select * into v_device
    from public.devices
   where id = v_device_id and auth_user_id = (select auth.uid()) and status = 'ACTIVE'
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'DEVICE_REVOKED');
  end if;

  select result into v_existing from public.operations where op_id = v_op_id;
  if found then
    return v_existing;
  end if;

  if v_seq <> v_device.last_seq + 1 then
    return jsonb_build_object('ok', false, 'code', 'OUT_OF_ORDER', 'expectedSeq', v_device.last_seq + 1);
  end if;

  v_status := 'APPLIED';
  if v_user_id is null or not exists (
       select 1 from public.app_users where id = v_user_id and is_active
     ) then
    v_status := 'TO_REVIEW';
    v_reason := 'USER_INACTIVE';
  end if;

  case v_type
    when 'IssueQuote' then
      v_result := private.apply_issue_quote(v_op_id, v_device, v_user_id, v_authorized_by, v_payload);
    when 'MarkQuoteAccepted' then
      v_result := private.apply_mark_quote(v_op_id, v_device, v_user_id, v_payload, 'ACCEPTED');
    when 'MarkQuoteRejected' then
      v_result := private.apply_mark_quote(v_op_id, v_device, v_user_id, v_payload, 'REJECTED');
    when 'UpsertCustomer' then
      v_result := private.apply_upsert_customer(v_op_id, v_device, v_user_id, v_payload);
    when 'CreateWorkOrder' then
      v_result := private.apply_create_work_order(v_op_id, v_device, v_user_id, v_payload);
    when 'UpdateWorkOrder' then
      v_result := private.apply_update_work_order(v_op_id, v_device, v_user_id, v_payload);
    when 'AdvanceWorkOrder' then
      v_result := private.apply_advance_work_order(v_op_id, v_device, v_user_id, v_authorized_by, v_payload);
    when 'DeliverWorkOrder' then
      v_result := private.apply_deliver_work_order(v_op_id, v_device, v_user_id, v_authorized_by, v_payload);
    when 'CancelWorkOrder' then
      v_result := private.apply_cancel_work_order(v_op_id, v_device, v_user_id, v_authorized_by, v_payload);
    when 'RegisterPayment' then
      v_result := private.apply_register_payment(v_op_id, v_device, v_user_id, v_payload);
    else
      return jsonb_build_object('ok', false, 'code', 'UNKNOWN_TYPE');
  end case;

  if not (v_result->>'ok')::boolean then
    return v_result;
  end if;
  if v_result->>'status' = 'TO_REVIEW' then
    v_status := 'TO_REVIEW';
    v_reason := coalesce(v_result->>'reason', v_reason);
  end if;

  v_result := v_result || jsonb_build_object('status', v_status)
              || case when v_reason is null then '{}'::jsonb else jsonb_build_object('reason', v_reason) end;

  insert into public.operations (
    op_id, device_id, seq, type, schema_version, payload, user_id, authorized_by,
    client_created_at, status, reason, result
  ) values (
    v_op_id, v_device_id, v_seq, v_type, (p->>'schemaVersion')::integer, v_payload, v_user_id,
    v_authorized_by, (p->>'clientCreatedAt')::timestamptz, v_status, v_reason, v_result
  );

  update public.devices set last_seq = v_seq, last_sent_at = now() where id = v_device_id;

  return v_result;
end;
$$;
