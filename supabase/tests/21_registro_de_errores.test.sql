-- Registro de errores sin datos personales [S4-28, RNF-34]: solo el servidor escribe, solo un administrador lee,
-- hay tope por minuto y la tabla no admite textos sin acotar.
begin;
select plan(14);

-- ---------- Nadie desde el navegador escribe ----------
set local role anon;
select throws_ok($$ select public.error_log_record('CLIENT', 'E', 'm', '', '/', '1') $$, '42501', null,
  'un anónimo no escribe en el registro');
select throws_ok($$ select * from public.error_log $$, '42501', null, 'ni lo lee');
select throws_ok($$ select * from public.admin_error_log() $$, '42501', null, 'ni por la función de administrador');
reset role;

select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"STAFF"}}', true);
set local role authenticated;
select throws_ok($$ select public.error_log_record('CLIENT', 'E', 'm', '', '/', '1') $$, '42501', null,
  'un usuario con sesión tampoco escribe');
select throws_ok($$ select * from public.admin_error_log() $$, '42501', null, 'un cajero no ve el registro');
select is((select count(*)::int from public.error_log), 0, 'ni lo lee directo (la política es solo de administradores)');
reset role;

-- ---------- El servidor registra y recorta ----------
set local role service_role;
select is(public.error_log_record('CLIENT', 'TypeError', 'Falló', 'pila', '/clientes', '1.0.0'), true,
  'el servidor registra un error');
select is(
  (select length(message) from public.error_log where name = 'TypeError'), 5, 'guarda el mensaje');
select is(public.error_log_record('SERVER', repeat('n', 300), repeat('m', 900), repeat('s', 3000), repeat('r', 400),
  repeat('v', 100)), true, 'un reporte demasiado grande se recorta en vez de fallar');
select is((select length(message) from public.error_log where source = 'SERVER'), 500, 'el mensaje se acota a 500');
select throws_ok($$ select public.error_log_record('OTRO', 'E', 'm', '', '/', '1') $$, '23514', null,
  'solo acepta CLIENT o SERVER');
select is(public.health_check(), true, 'la comprobación de salud responde');

-- ---------- Tope por minuto ----------
select is(public.error_log_record('CLIENT', 'E', 'm', '', '/', '1', 2), false,
  'con el tope alcanzado ya no guarda más');

-- ---------- Un administrador lo lee ----------
reset role;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"rol":"ADMIN"}}', true);
set local role authenticated;
select is((select count(*)::int from public.admin_error_log()), 2, 'un administrador ve los errores guardados');
reset role;

select * from finish();
rollback;
