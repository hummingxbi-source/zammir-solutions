-- S1-17 · Quién autorizó con su PIN una acción restringida [RN-19, ADR-0013].
-- Es la persona (administrador) que tecleó su PIN en la tablet; `user_id` sigue siendo quien actuó.
alter table public.audit_log add column authorized_by uuid;

comment on column public.audit_log.authorized_by is
  'Administrador que autorizó con su PIN una acción restringida de otra persona; null si no hizo falta.';
