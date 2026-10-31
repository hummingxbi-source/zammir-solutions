-- Pruebas del folio definitivo [S2-04].
begin;
select plan(13);

select has_table('public', 'folio_counters', 'existe la tabla de contadores');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.folio_counters'::regclass),
  'los contadores tienen RLS'
);

-- Empieza en 1 y avanza de uno en uno
select is(private.next_folio('QUOTE', 2090), 1::bigint, 'el primer folio del año es 1');
select is(private.next_folio('QUOTE', 2090), 2::bigint, 'el siguiente es 2');
select is(private.next_folio('QUOTE', 2090), 3::bigint, 'y luego 3');

-- Cada tipo y año llevan su cuenta
select is(private.next_folio('WORK_ORDER', 2090), 1::bigint, 'otro tipo empieza en 1');
select is(private.next_folio('QUOTE', 2091), 1::bigint, 'otro año empieza en 1');

-- Una transacción revertida no consume folio (savepoint como transacción interna)
savepoint antes;
select private.next_folio('QUOTE', 2090);
select private.next_folio('QUOTE', 2090);
rollback to savepoint antes;
select is(private.next_folio('QUOTE', 2090), 4::bigint, 'tras revertir, el siguiente folio no deja huecos');

-- El año del folio es el de México, no el de UTC
select is(private.folio_year('2027-01-01T05:59:59Z'), 2026, '31 dic 23:59:59 en México sigue siendo 2026');
select is(private.folio_year('2027-01-01T06:00:00Z'), 2027, 'un segundo después ya es 2027');
select is(private.folio_year('2026-01-01T03:00:00Z'), 2025, 'en UTC ya es enero, pero en México todavía no');

-- Nadie fuera del servidor toca los contadores
set local role authenticated;
select throws_ok(
  $$ select * from public.folio_counters $$,
  '42501', null, 'un usuario autenticado no lee los contadores'
);
select throws_ok(
  $$ select private.next_folio('QUOTE', 2090) $$,
  '42501', null, 'un usuario autenticado no puede pedir folios directamente'
);

select * from finish();
rollback;
