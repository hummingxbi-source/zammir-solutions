-- S2-18 · Condiciones por defecto de la cotización, editables por un administrador [RN-13, RF-M2-05].
-- Un renglón por condición. Al emitir una cotización se COPIAN: cambiar el texto aquí no cambia las
-- cotizaciones ya emitidas. Solo un administrador cambia el valor (política de business_settings).
insert into public.business_settings (key, value, description)
values (
  'quote_conditions',
  to_jsonb(
    'Se requiere el 50% de anticipo para iniciar fabricación o apartar material.' || E'\n' ||
    'El saldo se liquida contra entrega o instalación.' || E'\n' ||
    'El tiempo de entrega está sujeto a disponibilidad de material y a la medición física final en obra.'
  ),
  'Condiciones por defecto de las cotizaciones, una por renglón [RN-13]'
);
