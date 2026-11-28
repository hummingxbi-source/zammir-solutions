-- PP-40 · Unidades de venta sugeridas, editables en Configuración [RF-M1-11, ADR-0048].
--
-- Aprobada por Juanito el 2026-11-27. Al capturar un producto se sugieren estas unidades (más las que ya usa el
-- catálogo), para que todos escriban igual. Nace con la lista base del plan; un administrador la cambia en
-- Configuración. No es una regla de negocio: solo ayuda a escribir.

insert into public.business_settings (key, value, description)
values (
  'sale_unit_suggestions',
  '["rollo", "kilo", "juego", "par", "cartucho", "hoja", "tramo", "visita", "hora"]'::jsonb,
  'Unidades de venta que se sugieren al capturar un producto, una lista de textos de hasta 20 caracteres [RF-M1-11, PP-40]'
);
