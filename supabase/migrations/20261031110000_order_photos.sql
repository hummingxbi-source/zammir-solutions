-- S3-03 · Fotos de la medición de una orden [RF-M3-01, SINCRONIZACION.md §9].
-- Las sube la tablet cuando hay conexión, aparte de las operaciones: una foto que tarda nunca bloquea
-- una orden. Ruta: <id de la orden>/<id de la foto>.jpg (nada personal). Privadas: las tablets suben y
-- leen, los administradores leen; nadie las actualiza ni las borra desde la aplicación [RN-18].
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-photos', 'order-photos', false, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

create policy "las tablets suben fotos de medición" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'order-photos' and (select private.is_device()));

create policy "tablets y administradores leen las fotos de medición" on storage.objects
  for select to authenticated
  using (bucket_id = 'order-photos' and ((select private.is_device()) or (select private.is_admin())));
