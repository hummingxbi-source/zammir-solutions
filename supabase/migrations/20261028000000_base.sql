-- Migración base [S0-05].
-- pgcrypto: hash de códigos de registro de dispositivos y de otros secretos de un solo uso
-- (ver docs/arquitectura/AUTENTICACION.md §3). Las tablas llegan con sus historias.
create extension if not exists pgcrypto with schema extensions;
