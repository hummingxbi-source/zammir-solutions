-- Revisión de seguridad [S5-07, RNF-08 a RNF-13, RN-18].
-- `invoice_requests` se creó con los permisos por omisión de Supabase: cualquier usuario con sesión tenía además
-- INSERT, UPDATE, DELETE y TRUNCATE sobre la tabla. RLS ya impedía escribir (solo hay una política de lectura para
-- administradores), pero TRUNCATE no pasa por RLS y nada contable debe poder borrarse [RN-18]. Solo el servidor
-- (service_role, con las funciones `invoice_*` y `portal_*`) escribe en esta tabla; los administradores solo la leen.
revoke all on table public.invoice_requests from anon, authenticated;
grant select on table public.invoice_requests to authenticated;
