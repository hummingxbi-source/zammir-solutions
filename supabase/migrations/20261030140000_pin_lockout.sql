-- S1-17 · Valores propuestos para el bloqueo por intentos fallidos de PIN [PD-22, RNF-09, ADR-0013].
-- Propuestos por el desarrollador (PD-22 es suyo, no de Luis); configurables sin tocar el código.
--   5 intentos fallidos seguidos y, desde ahí, bloqueo de 30 s que se duplica con cada intento fallido
--   más (30 s, 60 s, 120 s…) hasta un máximo de 15 min. Un acierto borra el contador.

update public.business_settings
set value = '5'::jsonb,
    description = 'Intentos fallidos seguidos de PIN antes de bloquear (PD-22: valor propuesto, configurable)'
where key = 'pin_max_failed_attempts';

update public.business_settings
set value = '30'::jsonb,
    description = 'Segundos del primer bloqueo por PIN fallido; se duplica con cada intento fallido más (PD-22: valor propuesto)'
where key = 'pin_lock_seconds';

insert into public.business_settings (key, value, description)
values ('pin_lock_max_seconds', '900'::jsonb,
        'Máximo de segundos que puede durar el bloqueo por PIN fallido (PD-22: valor propuesto)');
