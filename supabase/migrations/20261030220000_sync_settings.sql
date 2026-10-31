-- S2-06 · Aviso de documentos sin enviar [RF-UX-06, SINCRONIZACION.md §8].
-- Horas que puede llevar un documento guardado en la tablet sin enviarse antes de avisar a la persona.
-- Valor de trabajo propuesto por el desarrollador (6 h); se confirma con Luis en el cuestionario único.
insert into public.business_settings (key, value, description)
values ('sync_stale_hours', '6',
        'Horas sin enviar un documento antes de avisar en pantalla [S2-06; valor de trabajo, por confirmar con Luis]');
