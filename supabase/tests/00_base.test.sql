-- Prueba de la migración base [S0-05]: la extensión pgcrypto debe existir.
begin;
select plan(1);

select has_extension('pgcrypto', 'pgcrypto está instalada (hash de códigos de registro)');

select * from finish();
rollback;
