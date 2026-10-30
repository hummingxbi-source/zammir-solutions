-- Valores iniciales propuestos por el desarrollador para dos pendientes, a petición de Juanito
-- (29 oct 2026). Son configurables: se cambian en business_settings sin tocar el código.
--   PD-21: la sesión de un administrador (en computadora) se cierra tras 30 min sin actividad.
--   PD-48: el código de registro de una tablet sirve 15 min; se sugiere al generarlo y se puede cambiar.
-- Pendientes de confirmar con Luis; no cambian ninguna regla de negocio del cliente.

update public.business_settings
set value = '30'::jsonb,
    description = 'Minutos de inactividad para cerrar la sesión de un administrador (PD-21: valor propuesto, por confirmar)'
where key = 'admin_idle_logout_minutes';

insert into public.business_settings (key, value, description)
values (
  'device_code_validity_minutes', '15'::jsonb,
  'Minutos que sirve un código de registro de tablet (PD-48: valor propuesto, por confirmar)'
);
